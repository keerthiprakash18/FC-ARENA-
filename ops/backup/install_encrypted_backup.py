#!/usr/bin/env python3
"""Prepare a new encrypted producer; retain previous backup files and units."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
from urllib.parse import urlsplit

def run(args):return subprocess.check_output(args,stderr=subprocess.PIPE,timeout=120).decode().strip()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','activate','refresh']);parser.add_argument('--public-key');parser.add_argument('--download-public-key');parser.add_argument('--recipient');args=parser.parse_args()
    assert os.geteuid()==0 and socket.gethostname().split('.')[0]=='fcarena-prod'
    config_path=Path('/etc/fcarena/backup-encrypted.json');backup=Path('/var/backups/fcarena-encrypted')
    if args.action=='activate':
        state=json.loads((backup/'latest.json').read_text());receipt=json.loads((backup/'offhost-receipt.json').read_text())
        assert state['encrypted'] is True and receipt['file']==state['latestFile'] and receipt['sha256']==state['latestSha256'] and receipt.get('lastVerifiedRestoreAt')
        run(['systemctl','enable','--now','fcarena-encrypted-backup.timer'])
        for timer in ['fcarena-backup.timer','fcarena-restore-verify.timer']:
            subprocess.run(['systemctl','disable','--now',timer],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
        print('ENCRYPTED_PRODUCER_AND_VERIFIED_PC_RECOVERY_SCHEDULE=ACTIVE; legacy archives preserved');return
    pid=run(['systemctl','show','fcarena-api','--property=MainPID','--value'])
    env=dict(row.split('=',1) for row in Path('/proc',pid,'environ').read_text().split('\0') if '=' in row)
    start=run(['systemctl','show','fcarena-api','--property=ExecStart','--value'])
    match=re.search(r'(/opt/[^ ;]+/apps/api/dist/main\.js)',start)
    if match:
        runtime=Path(match.group(1)).parents[3]
        script="const fs=require('node:fs');const parse=require(process.argv[1]+'/node_modules/dotenv').parse;let file={};try{file=parse(fs.readFileSync(process.argv[2]));}catch{};const env={...file,...process.env};let cloud=env.CLOUDINARY_CLOUD_NAME;try{cloud=cloud||new URL(env.CLOUDINARY_URL).hostname;}catch{};process.stdout.write(JSON.stringify({cloud:cloud||null}));"
        info=json.loads(subprocess.check_output(['/usr/bin/node','--input-type=commonjs','-e',script,str(runtime),env.get('DOTENV_CONFIG_PATH','/opt/fcarena/apps/api/.env')],env=env,stderr=subprocess.PIPE,timeout=15))
        if info['cloud']:env['CLOUDINARY_CLOUD_NAME']=info['cloud']
    if args.action=='refresh':
        config=json.loads(config_path.read_text());config['cloudName']=env.get('CLOUDINARY_CLOUD_NAME')
        config_path.write_text(json.dumps(config,indent=2));config_path.chmod(0o600)
        config.pop('reportTokenFile',None);config_path.write_text(json.dumps(config,indent=2))
        folder=Path('/opt/fcarena-ops/backup')
        for name in ['encrypted_bundle.py','backup_transfer.py','install_encrypted_backup.py']:
            source=Path(__file__).resolve().parent/name;target=folder/name
            if source!=target:shutil.copyfile(source,target)
            target.chmod(0o644)
        health=Path('/var/lib/fcarena-backup-state');health.mkdir(mode=0o750,exist_ok=True)
        shutil.chown(health,user='root',group='fcarena-api')
        unit=Path('/etc/systemd/system/fcarena-encrypted-backup.service')
        unit.write_text(unit.read_text().replace('ReadWritePaths=/run/fcarena-encrypted-backup /var/backups/fcarena-encrypted /var/lib/fcarena-backup-public',
          'ReadWritePaths=/run/fcarena-encrypted-backup /var/backups/fcarena-encrypted /var/lib/fcarena-backup-public /var/lib/fcarena-backup-state'))
        run(['systemctl','daemon-reload'])
        print(json.dumps({'providerExportConfigured':bool(config['cloudName']),'privateKeysOnServer':False}));return
    assert re.fullmatch('[0-9A-Fa-f]{40}',args.recipient or '') and not config_path.exists()
    folder=Path('/opt/fcarena-ops/backup');folder.mkdir(parents=True,exist_ok=True,mode=0o755)
    for name in ['encrypted_bundle.py','backup_transfer.py','install_encrypted_backup.py']:
        source=Path(__file__).resolve().parent/name;target=folder/name
        if source!=target:shutil.copyfile(source,target)
        target.chmod(0o644)
    for path in [backup,Path('/var/lib/fcarena-backup-public'),Path('/run/fcarena-encrypted-backup')]:path.mkdir(mode=0o700,parents=True,exist_ok=True);path.chmod(0o700)
    health=Path('/var/lib/fcarena-backup-state');health.mkdir(mode=0o750,exist_ok=True)
    shutil.chown(health,user='root',group='fcarena-api')
    home='/var/lib/fcarena-backup-public'
    run(['gpg','--homedir',home,'--batch','--import',str(Path(args.public_key).resolve())])
    keys=run(['gpg','--homedir',home,'--batch','--with-colons','--list-secret-keys'])
    assert not any(line.startswith('sec:') for line in keys.splitlines()),'Private recovery keys must never reside on production'
    public=run(['gpg','--homedir',home,'--batch','--with-colons','--list-keys',args.recipient])
    assert args.recipient.upper() in public
    roots=['/var/lib/fcarena/storage','/opt/fcarena/storage','/opt/fcarena/apps/api/storage','/opt/fcarena/apps/api/uploads']
    for key in ['OCR_UPLOAD_DIR','ARENA_MEDIA_DIR','CARD_EXPORT_DIR','TOURNAMENT_REPORT_EXPORT_DIR']:
        raw=env.get(key)
        if raw and Path(raw).is_absolute() and raw.startswith(('/var/lib/fcarena/','/opt/fcarena/')):roots.append(raw)
    roots=sorted(set(str(Path(path).resolve()) for path in roots if Path(path).is_dir()))
    assert roots and all(path.startswith(('/var/lib/fcarena/','/opt/fcarena/')) for path in roots)
    cloud=env.get('CLOUDINARY_CLOUD_NAME')
    if not cloud and env.get('CLOUDINARY_URL'):cloud=urlsplit(env['CLOUDINARY_URL']).hostname
    config={'backupDirectory':str(backup),'gpgHome':home,'recipient':args.recipient.upper(),'postgresContainer':'fc-arena-postgres',
      'mediaRoots':roots,'cloudName':cloud}
    config_path.write_text(json.dumps(config,indent=2));config_path.chmod(0o600)
    authorized=Path('/root/.ssh/authorized_keys');existing=authorized.read_text()
    public_key=Path(args.download_public_key).read_text().strip();assert re.fullmatch(r'ssh-ed25519 [A-Za-z0-9+/=]+(?: [^\r\n]+)?',public_key)
    line='restrict,command="/usr/bin/python3 /opt/fcarena-ops/backup/backup_transfer.py" '+public_key
    snapshot=Path('/root/fcarena-safety/authorized-keys-before-encrypted-backup.private');assert not snapshot.exists()
    snapshot.write_text(existing);snapshot.chmod(0o600)
    assert public_key not in existing;authorized.write_text(existing.rstrip('\n')+'\n'+line+'\n');authorized.chmod(0o600)
    timers={}
    for name in ['fcarena-backup.timer','fcarena-restore-verify.timer']:
        timers[name]={key:subprocess.run(['systemctl',key,name],capture_output=True,text=True).stdout.strip() for key in ['is-enabled','is-active']}
    baseline=Path('/etc/fcarena/backup-before-encryption.private.json');baseline.write_text(json.dumps(timers,indent=2));baseline.chmod(0o600)
    service='''[Unit]
Description=FC Arena encrypted database and media backup
After=docker.service network-online.target
Requires=docker.service
[Service]
Type=oneshot
User=root
UMask=0077
ExecStart=/usr/bin/python3 /opt/fcarena-ops/backup/encrypted_bundle.py --config /etc/fcarena/backup-encrypted.json
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/run/fcarena-encrypted-backup /var/backups/fcarena-encrypted /var/lib/fcarena-backup-public /var/lib/fcarena-backup-state
CPUQuota=50%
MemoryMax=512M
Nice=10
TimeoutStartSec=1800
'''
    timer='''[Unit]
Description=Daily FC Arena encrypted backup
[Timer]
OnCalendar=*-*-* 02:00:00 UTC
RandomizedDelaySec=300
Persistent=true
[Install]
WantedBy=timers.target
'''
    for name,content in [('fcarena-encrypted-backup.service',service),('fcarena-encrypted-backup.timer',timer)]:
        path=Path('/etc/systemd/system')/name;assert not path.exists();path.write_text(content);path.chmod(0o644)
    run(['systemctl','daemon-reload'])
    print(json.dumps({'status':'PREPARED','privateRecoveryKeysOnServer':False,'mediaRoots':len(roots),'cloudinaryExportConfigured':bool(cloud),'scheduleActivated':False}))
if __name__=='__main__':main()
