#!/usr/bin/env python3
"""Forced SSH command: expose encrypted archives only, never a general shell."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import sys
import secrets

NAME=re.compile(r'fcarena-\d{8}T\d{6}Z-[0-9a-f]{6}\.bundle\.gpg\Z')
def validate_name(root,name):
    if not NAME.fullmatch(name):raise ValueError('Invalid backup filename')
    path=root/name
    if path.is_symlink() or not path.is_file() or path.resolve().parent!=root.resolve():raise ValueError('Not a regular encrypted archive')
    return path
def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def write_json(path,value,mode=0o600):
    temporary=path.with_name(path.name+'.'+secrets.token_hex(4)+'.partial')
    with temporary.open('x') as stream:json.dump(value,stream,indent=2)
    temporary.chmod(mode);temporary.replace(path)
def update_health(root,target):
    import fcntl
    import grp
    target.parent.mkdir(mode=0o750,parents=True,exist_ok=True)
    group=grp.getgrnam('fcarena-api').gr_gid
    os.chown(target.parent,0,group);target.parent.chmod(0o750)
    with (target.parent/'health.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        local=json.loads((root/'latest.json').read_text())
        receipt=json.loads((root/'offhost-receipt.json').read_text()) if (root/'offhost-receipt.json').exists() else {}
        state={'encrypted':local['encrypted'],'lastLocalBackupAt':local['lastLocalBackupAt'],
          'lastOffhostCopyAt':receipt.get('lastOffhostCopyAt'),'lastVerifiedRestoreAt':receipt.get('lastVerifiedRestoreAt'),
          'latestCopied':receipt.get('file')==local['latestFile'],'unavailableProviderAssets':local.get('unavailableProviderAssets',0)}
        write_json(target,state,0o640);os.chown(target,0,group)
def serve(root,words,output):
    if words==['manifest']:
        state=json.loads((root/'latest.json').read_text())
        path=validate_name(root,state['latestFile']);actual=digest(path)
        if actual!=state['latestSha256']:raise ValueError('Archive integrity failed')
        output.write(json.dumps({'format':'fc-arena-encrypted-transfer-v1','file':path.name,'sha256':actual,'bytes':path.stat().st_size,
          'createdAt':state['lastLocalBackupAt']}).encode());return
    if len(words) in (2,4) and words[0]=='fetch':
        path=validate_name(root,words[1])
        offset=0;remaining=path.stat().st_size
        if len(words)==4:
            if not all(re.fullmatch('[0-9]{1,12}',word) for word in words[2:]):raise ValueError('Invalid bounded range')
            offset,length=map(int,words[2:])
            if not 0<=offset<remaining or not 0<length<=4*1024**2:raise ValueError('Invalid bounded range')
            remaining=min(length,remaining-offset)
        with path.open('rb') as stream:
            stream.seek(offset)
            while remaining:
                block=stream.read(min(65536,remaining))
                if not block:raise ValueError('Incomplete encrypted archive')
                output.write(block);remaining-=len(block)
        return
    if len(words) in (3,4) and words[0]=='ack' and (len(words)==3 or words[3]=='verified'):
        path=validate_name(root,words[1])
        if not re.fullmatch('[0-9a-f]{64}',words[2]) or digest(path)!=words[2]:raise ValueError('Receipt checksum mismatch')
        previous=json.loads((root/'offhost-receipt.json').read_text()) if (root/'offhost-receipt.json').exists() else {}
        previous.update({'file':path.name,'sha256':words[2],'lastOffhostCopyAt':dt.datetime.now(dt.timezone.utc).isoformat()})
        if len(words)==4:previous['lastVerifiedRestoreAt']=dt.datetime.now(dt.timezone.utc).isoformat()
        target=root/'offhost-receipt.json';write_json(target,previous)
        output.write(b'RECEIPT_ACCEPTED\n');return
    raise ValueError('Only manifest/fetch/verified receipts are allowed')
def main():
    assert os.geteuid()==0
    try:
        words=shlex.split(os.environ.get('SSH_ORIGINAL_COMMAND',''));root=Path('/var/backups/fcarena-encrypted')
        serve(root,words,sys.stdout.buffer)
        if words and words[0]=='ack':update_health(root,Path('/var/lib/fcarena-backup-state/health.json'))
    except Exception:print('Backup transfer denied.',file=sys.stderr);raise SystemExit(2)
if __name__=='__main__':main()
