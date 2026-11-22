#!/usr/bin/env python3
"""Encrypt PostgreSQL + persistent media; never retains a plaintext archive."""
import argparse
import datetime as dt
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tarfile
import tempfile
from urllib.parse import urlsplit

def digest(path):
    with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def media_entries(roots):
    entries=[];seen=set()
    for raw in roots:
        root=Path(raw).resolve(strict=True)
        if not root.is_dir():raise ValueError('Persistent root must be a directory')
        for path in sorted(root.rglob('*')):
            if path.is_symlink() or not path.is_file():continue
            resolved=path.resolve(strict=True)
            if not resolved.is_relative_to(root) or resolved in seen:continue
            seen.add(resolved)
            entries.append((path,'media/'+path.as_posix().lstrip('/')))
    return entries

def write_archive(stream,database,entries,extra):
    files=[{'path':'database.dump','sha256':digest(database),'bytes':database.stat().st_size}]
    files.extend({'path':name,'sha256':digest(path),'bytes':path.stat().st_size} for path,name in entries)
    manifest={'format':'fc-arena-recovery-v1','createdAt':dt.datetime.now(dt.timezone.utc).isoformat(),'files':files,**extra}
    with tarfile.open(fileobj=stream,mode='w|gz') as archive:
        archive.add(database,arcname='database.dump',recursive=False)
        for path,name in entries:archive.add(path,arcname=name,recursive=False)
        body=json.dumps(manifest,ensure_ascii=False).encode()
        info=tarfile.TarInfo('manifest.json');info.size=len(body);info.mode=0o600
        archive.addfile(info,io.BytesIO(body))
    return manifest

def cloudinary_asset(url,cloud_name,destination):
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname!='res.cloudinary.com' or parsed.port not in (None,443) or \
       parsed.username or parsed.password or not parsed.path.startswith('/'+cloud_name+'/image/upload/'):
        return False
    connection=http.client.HTTPSConnection('res.cloudinary.com',timeout=15)
    try:
        connection.request('GET',parsed.path+('?' + parsed.query if parsed.query else ''))
        response=connection.getresponse()
        if response.status!=200:raise RuntimeError('Referenced provider image unavailable')
        total=0
        with destination.open('xb') as output:
            while block:=response.read(65536):
                total+=len(block)
                if total>16*1024*1024:raise RuntimeError('Provider image exceeds backup bound')
                output.write(block)
    finally:connection.close()
    return True

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--config',required=True);args=parser.parse_args()
    assert os.geteuid()==0 and socket.gethostname().split('.')[0]=='fcarena-prod'
    config=json.loads(Path(args.config).read_text())
    backup=Path(config['backupDirectory']).resolve();backup.mkdir(mode=0o700,parents=True,exist_ok=True)
    assert backup==Path('/var/backups/fcarena-encrypted') and not backup.is_symlink()
    assert shutil.disk_usage(backup).free>=8*1024**3,'Stop before endangering production disk capacity'
    container=config['postgresContainer'];assert container=='fc-arena-postgres'
    recipient=config['recipient'];assert len(recipient)==40 and all(c in '0123456789ABCDEFabcdef' for c in recipient)
    started=dt.datetime.now(dt.timezone.utc).isoformat()
    name='fcarena-'+dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+secrets.token_hex(3)+'.bundle.gpg'
    final=backup/name;partial=backup/(name+'.partial');assert not final.exists() and not partial.exists()
    runtime=Path('/run/fcarena-encrypted-backup');runtime.mkdir(mode=0o700,exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix='capture-',dir=runtime) as raw:
            work=Path(raw);database=work/'database.dump'
            with database.open('xb') as output:
                subprocess.run(['docker','exec',container,'sh','-ec','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],
                  stdout=output,stderr=subprocess.PIPE,check=True,timeout=120)
            with database.open('rb') as source:
                subprocess.run(['docker','exec','-i',container,'pg_restore','--list'],stdin=source,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True,timeout=60)
            entries=media_entries(config['mediaRoots'])
            extra={'databaseFormat':'postgresql-custom','mediaRoots':config['mediaRoots'],'providerAssets':[],'unavailableProviderAssets':0}
            cloud=config.get('cloudName')
            if cloud:
                sql='SELECT DISTINCT url FROM (SELECT "profileImageUrl" AS url FROM players UNION ALL SELECT "logoUrl" FROM leagues UNION ALL SELECT "logoUrl" FROM tournaments UNION ALL SELECT "entryLogoUrl" FROM tournament_registrations) q WHERE url IS NOT NULL'
                urls=subprocess.check_output(['docker','exec',container,'sh','-ec','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -Atq -c "$1"','backup-urls',sql],stderr=subprocess.PIPE,timeout=30).decode().splitlines()
                for url in sorted(set(urls)):
                    if len(extra['providerAssets'])>=2000:raise RuntimeError('Provider export bound requires operator review')
                    name='provider-assets/'+hashlib.sha256(url.encode()).hexdigest()+'.bin';file=work/Path(name).name
                    try:
                        if cloudinary_asset(url,cloud,file):entries.append((file,name));extra['providerAssets'].append({'url':url,'path':name})
                    except Exception:extra['unavailableProviderAssets']+=1
            command=['gpg','--homedir',config['gpgHome'],'--batch','--no-tty','--trust-model','always','--cipher-algo','AES256',
              '--compress-algo','none','--recipient',recipient,'--encrypt','--output',str(partial)]
            with (work/'gpg.private.log').open('wb') as log:
                process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log)
                try:manifest=write_archive(process.stdin,database,entries,extra)
                finally:process.stdin.close()
                assert process.wait(timeout=120)==0,'Encryption failed'
            assert partial.is_file() and partial.stat().st_size>0
            partial.chmod(0o600);partial.rename(final)
            checksum=digest(final);sidecar=backup/(final.name+'.sha256')
            sidecar.write_text(checksum+'  '+final.name+'\n');sidecar.chmod(0o600)
            state={'encrypted':True,'lastLocalBackupAt':dt.datetime.now(dt.timezone.utc).isoformat(),
              'latestFile':final.name,'latestSha256':checksum,'mediaFiles':len(manifest['files'])-1,
              'providerAssets':len(extra['providerAssets']),'unavailableProviderAssets':extra['unavailableProviderAssets']}
            from backup_transfer import update_health,write_json
            write_json(backup/'latest.json',state)
            update_health(backup,Path('/var/lib/fcarena-backup-state/health.json'))
            print(json.dumps({'status':'PASS','encrypted':True,'file':final.name,'sha256':checksum,'mediaFiles':state['mediaFiles'],
              'providerAssets':state['providerAssets'],'unavailableProviderAssets':state['unavailableProviderAssets']}),flush=True)
    except BaseException:
        if partial.exists():partial.unlink()
        raise

if __name__=='__main__':main()
