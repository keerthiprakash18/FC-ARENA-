#!/usr/bin/env python3
"""Private Windows backup receiver with DPAPI-protected recovery key material."""
import argparse
import base64
import ctypes
from contextlib import ExitStack
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import time

NAME=re.compile(r'fcarena-\d{8}T\d{6}Z-[0-9a-f]{6}\.bundle\.gpg\Z')
def gpg_path(path):
    path=Path(path).resolve()
    return '/'+path.drive[0].lower()+path.as_posix()[2:] if os.name=='nt' else str(path)
def digest(path):
    with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def dpapi(value,decode=False):
    assert os.name=='nt'
    class Blob(ctypes.Structure):_fields_=[('size',ctypes.c_uint32),('data',ctypes.POINTER(ctypes.c_ubyte))]
    buffer=ctypes.create_string_buffer(value);source=Blob(len(value),ctypes.cast(buffer,ctypes.POINTER(ctypes.c_ubyte)));target=Blob()
    crypto=ctypes.windll.crypt32
    ok=crypto.CryptUnprotectData(ctypes.byref(source),None,None,None,None,1,ctypes.byref(target)) if decode else \
       crypto.CryptProtectData(ctypes.byref(source),'FC Arena backup recovery',None,None,None,1,ctypes.byref(target))
    if not ok:raise ctypes.WinError()
    try:return ctypes.string_at(target.data,target.size)
    finally:ctypes.windll.kernel32.LocalFree(target.data)

def initialize(root):
    root=root.resolve();assert '.tmp-release/recovery/' in root.as_posix() and os.name=='nt'
    root.mkdir(mode=0o700,parents=True,exist_ok=True)
    config_path=root/'operator-config.private.json';assert not config_path.exists(),'Never overwrite recovery keys/configuration'
    account=os.environ['USERDOMAIN']+'\\'+os.environ['USERNAME']
    subprocess.run(['icacls',str(root),'/inheritance:r','/grant:r',account+':(OI)(CI)F','SYSTEM:(OI)(CI)F','Administrators:(OI)(CI)F'],stdout=subprocess.DEVNULL,check=True)
    gpg=Path('C:/Program Files/Git/usr/bin/gpg.exe');assert gpg.is_file()
    gpg_home=root/'gnupg';gpg_home.mkdir(mode=0o700,exist_ok=True)
    password_file=root/'recovery-password.dpapi'
    password=dpapi(password_file.read_bytes(),True) if password_file.exists() else secrets.token_urlsafe(40).encode()
    if not password_file.exists():password_file.write_bytes(dpapi(password))
    with (root/'key-setup.private.log').open('wb') as log:
        subprocess.run([str(gpg),'--homedir',gpg_path(gpg_home),'--batch','--pinentry-mode','loopback','--passphrase-fd','0',
          '--quick-generate-key','FC Arena Private Recovery <fcarena-recovery@example.invalid>','rsa3072','encr','2y'],
          input=password+b'\n',stdout=log,stderr=log,check=True,timeout=180)
        listed=subprocess.check_output([str(gpg),'--homedir',gpg_path(gpg_home),'--batch','--with-colons','--list-keys'],stderr=log).decode()
        fingerprint=next(line.split(':')[9] for line in listed.splitlines() if line.startswith('fpr:'))
        with (root/'backup-public.asc').open('wb') as out:
            subprocess.run([str(gpg),'--homedir',gpg_path(gpg_home),'--batch','--armor','--export',fingerprint],stdout=out,stderr=log,check=True)
        with (root/'backup-secret.private.asc').open('wb') as out:
            subprocess.run([str(gpg),'--homedir',gpg_path(gpg_home),'--batch','--pinentry-mode','loopback','--passphrase-fd','0','--armor','--export-secret-keys',fingerprint],input=password+b'\n',stdout=out,stderr=log,check=True)
        ssh_key=root/'backup_download_ed25519'
        subprocess.run(['C:/Windows/System32/OpenSSH/ssh-keygen.exe','-q','-t','ed25519','-N','','-C','fcarena-encrypted-backup-reader','-f',str(ssh_key)],stdout=log,stderr=log,check=True)
    (root/'archives').mkdir(mode=0o700)
    config={'privateDirectory':str(root),'gpg':str(gpg),'gpgHome':gpg_path(gpg_home),'recipient':fingerprint,
      'ssh':'C:/Windows/System32/OpenSSH/ssh.exe','sshKey':str(ssh_key),'host':'45.129.87.8','user':'root',
      'knownHosts':str(Path.home()/'.ssh/known_hosts'),'pgBin':'C:/Program Files/PostgreSQL/18/bin'}
    config_path.write_text(json.dumps(config,indent=2))
    shutil.copyfile(Path(__file__),root/'pc_backup.py')
    print(json.dumps({'status':'KEYS_READY','recipient':fingerprint,'privateKeyUploaded':False}))

def ssh(config,command,limit,output=None):
    args=[config['ssh'],'-n','-T','-i',config['sshKey'],'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
      '-o','UserKnownHostsFile='+config['knownHosts'],'-o','IPQoS=none','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2',
      config['user']+'@'+config['host'],command]
    process=subprocess.Popen(args,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0)
    timer=threading.Timer(600 if output else 30,process.kill);timer.start();body=bytearray();count=0
    try:
        while chunk:=process.stdout.read(65536):
            count+=len(chunk)
            if count>limit:raise ValueError('Backup transfer exceeded advertised bounds')
            if output:output.write(chunk)
            else:body.extend(chunk)
        if process.wait(timeout=5)!=0:raise RuntimeError('Private encrypted backup transfer failed')
        return bytes(body)
    finally:
        timer.cancel()
        if process.poll() is None:process.kill();process.wait()
        process.stdout.close()

def verify(config,encrypted):
    root=Path(config['privateDirectory']).resolve();password=dpapi((root/'recovery-password.dpapi').read_bytes(),True)
    with tempfile.TemporaryDirectory(prefix='verify-',dir=root) as raw, ExitStack() as handles:
        work=Path(raw);assert work.resolve().parent==root
        archive=work/'decrypted.tar.gz';log=handles.enter_context((work/'recovery.private.log').open('wb'))
        subprocess.run([config['gpg'],'--homedir',config['gpgHome'],'--batch','--pinentry-mode','loopback','--passphrase-fd','0',
          '--output',gpg_path(archive),'--decrypt',gpg_path(encrypted)],input=password+b'\n',stdout=log,stderr=log,check=True,timeout=180)
        with tarfile.open(archive,'r:gz') as bundle:
            manifest=json.load(bundle.extractfile('manifest.json'));assert manifest['format']=='fc-arena-recovery-v1'
            expected={row['path']:row for row in manifest['files']};assert len(expected)==len(manifest['files'])
            total=0;count=0;seen=set()
            for member in bundle:
                assert member.name not in seen;seen.add(member.name)
                path=Path(member.name)
                assert member.isfile() and not path.is_absolute() and '..' not in path.parts and '\\' not in member.name
                total+=member.size;assert total<=4*1024**3 and count<=100000
                if member.name=='manifest.json':continue
                assert member.name in expected
                with bundle.extractfile(member) as stream:
                    sha=hashlib.sha256();copied=0
                    out=(work/'database.dump').open('xb') if member.name=='database.dump' else None
                    try:
                        while block:=stream.read(65536):
                            sha.update(block);copied+=len(block)
                            if out:out.write(block)
                    finally:
                        if out:out.close()
                assert sha.hexdigest()==expected[member.name]['sha256'] and copied==expected[member.name]['bytes']
                count+=1
            assert count==len(expected)
        pg=Path(config['pgBin']);cluster=work/'postgres';pw=work/'postgres-password.private';pw.write_text(secrets.token_urlsafe(32))
        with socket.socket() as reservation:reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
        env={**os.environ,'PGPASSWORD':pw.read_text()};connection=['-h','127.0.0.1','-p',str(port),'-U','postgres'];database='fcarena_backup_verify_test'
        def run(name,*args):subprocess.run([str(pg/(name+'.exe')),*map(str,args)],env=env,stdout=log,stderr=log,check=True,timeout=120)
        started=False
        try:
            run('initdb','-D',cluster,'-U','postgres','--encoding=UTF8','--locale=C','--auth-local=trust','--auth-host=scram-sha-256','--pwfile',pw)
            run('pg_ctl','-D',cluster,'-l',work/'postgres.private.log','-w','-t','60','-o',f'-h 127.0.0.1 -p {port} -c shared_buffers=64MB -c max_connections=10 -c fsync=off','start');started=True
            run('createdb',*connection,database)
            run('pg_restore',*connection,'-d',database,'--no-owner','--no-privileges','--exit-on-error',work/'database.dump')
            def query(sql):return subprocess.check_output([str(pg/'psql.exe'),*connection,'-d',database,'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],env=env,stderr=log,timeout=30).decode().strip()
            tables=int(query("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"))
            migrations=int(query('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'))
            unresolved=int(query('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL'))
            assert tables>=67 and migrations>=49 and unresolved==0 and query('SELECT EXISTS(SELECT 1 FROM users)')=='t'
            report={'status':'PASS','verifiedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'restoredTables':tables,'finishedMigrations':migrations,
              'unresolvedMigrations':unresolved,'verifiedMediaFiles':count-1,'providerAssets':len(manifest.get('providerAssets',[])),
              'unavailableProviderAssets':manifest.get('unavailableProviderAssets',0),'archiveSha256':digest(encrypted)}
        finally:
            if started:run('pg_ctl','-D',cluster,'-w','-t','60','-m','fast','stop')
            log.close()
    (root/'last-verified-restore.json').write_text(json.dumps(report,indent=2));return report

def pull(config,force_verify=False):
    root=Path(config['privateDirectory']).resolve();assert os.name=='nt' and root.is_dir()
    manifest=json.loads(ssh(config,'manifest',65536));name=manifest['file']
    assert NAME.fullmatch(name) and re.fullmatch('[0-9a-f]{64}',manifest['sha256'])
    size=manifest['bytes'];assert isinstance(size,int) and 0<size<=2*1024**3
    target=root/'archives'/name;assert target.resolve().parent==(root/'archives').resolve() and not target.is_symlink()
    if not target.exists():
        assert shutil.disk_usage(root).free>size+512*1024**2
        temporary=target.with_name(name+'.'+secrets.token_hex(4)+'.partial')
        try:
            with temporary.open('xb') as out:
                for offset in range(0,size,4*1024**2):
                    length=min(4*1024**2,size-offset)
                    ssh(config,f'fetch {name} {offset} {length}',length,out)
            assert temporary.stat().st_size==size and digest(temporary)==manifest['sha256']
            temporary.rename(target)
        finally:
            if temporary.exists():temporary.unlink()
    assert digest(target)==manifest['sha256']
    last=json.loads((root/'last-verified-restore.json').read_text()) if (root/'last-verified-restore.json').exists() else None
    due=not last or dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(last['verifiedAt'])>=dt.timedelta(days=7)
    if force_verify or due:verify(config,target)
    verified=force_verify or due
    ssh(config,'ack '+name+' '+manifest['sha256']+(' verified' if verified else ''),65536)
    state={'status':'PASS','copiedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'encrypted':True,'file':name,'sha256':manifest['sha256'],'restoreVerifiedThisRun':verified}
    (root/'last-pull.json').write_text(json.dumps(state,indent=2));print(json.dumps(state))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['init','pull','verify']);parser.add_argument('--private-directory',required=True);args=parser.parse_args()
    root=Path(args.private_directory)
    if args.action=='init':initialize(root)
    else:pull(json.loads((root/'operator-config.private.json').read_text()),args.action=='verify')
if __name__=='__main__':main()
