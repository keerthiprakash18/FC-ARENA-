#!/usr/bin/env python3
"""PC-side archive escrow. Copy/hash first; server independently rechecks before cleanup."""
import argparse
import base64
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import time

REMOTE = '/var/lib/fcarena-release-storage/'
GUARD = '/opt/fcarena-ops/release/storage_retention.py'
SOURCE = re.compile(r'/root/fcarena-audit-improvements/artifacts/([0-9a-f]{40})/(fcarena-(?:runtime-[0-9a-f]{40}\.tar\.gz|vcl-runtime-[0-9a-f]{40}\.zip)|runtime-artifact\.zip)$')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def archive_target(item, destination):
    match = SOURCE.fullmatch(item['path'])
    if not match or (match[2] != 'runtime-artifact.zip' and match[1] not in match[2]) or not re.fullmatch('[0-9a-f]{64}', item['sha256']):
        raise ValueError('Unexpected archive path/checksum')
    name = match[1] + '-runtime-artifact.zip' if match[2] == 'runtime-artifact.zip' else match[2]
    return destination / name


def reconstruct_stored_zip(item, target, recipe):
    """Reuse an already verified inner tarball; the complete outer ZIP must still hash identically."""
    match = SOURCE.fullmatch(item['path'])
    if not match or match[2] != 'runtime-artifact.zip':
        return False
    expected_name = 'fcarena-runtime-' + match[1] + '.tar.gz'
    source = target.parent / expected_name
    if (recipe.get('name') != expected_name or not source.is_file() or source.is_symlink()
            or source.stat().st_size != recipe.get('bytes')):
        return False
    head, tail = (base64.b64decode(recipe[key], validate=True) for key in ('head', 'tail'))
    if len(head) > 65536 or len(tail) > 65536:
        raise ValueError('Unexpected ZIP metadata bounds')
    partial = target.with_name(target.name + '.reconstruct.partial')
    try:
        with partial.open('xb') as out, source.open('rb') as stream:
            out.write(head)
            shutil.copyfileobj(stream, out, 1024 * 1024)
            out.write(tail)
        if digest(partial) != item['sha256']:
            return False
        partial.replace(target)
        return True
    finally:
        if partial.exists():
            partial.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--identity', required=True)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--cycle', action='store_true', help='Uses previously installed owner-approved server policy')
    args = parser.parse_args()
    destination = Path(args.directory).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    common = ['-i', args.identity, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
              '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4']

    def ssh(command):
        subprocess.run(['ssh', *common, args.host, command], check=True, timeout=1800)

    def scp(source, target):
        for attempt in range(3):
            result = subprocess.run(['scp', '-q', *common, source, target], timeout=1800)
            if result.returncode == 0:
                return
            if attempt < 2:
                time.sleep(2)
        result.check_returncode()

    def resume_archive(source, target):
        batch = destination / 'archive-transfer.private.batch'
        escaped_target = target.as_posix().replace('"', '\\"')
        batch.write_text('reget "' + source + '" "' + escaped_target + '"\n')
        for attempt in range(6):
            result = subprocess.run(['sftp', '-q', '-b', str(batch), '-R', '8', *common, args.host], timeout=1800)
            if result.returncode == 0:
                return
            if attempt < 5:
                time.sleep(2)
        result.check_returncode()

    def reuse_inner_archive(item, target):
        match = SOURCE.fullmatch(item['path'])
        if not match or match[2] != 'runtime-artifact.zip':
            return False
        # The source path is restricted to a literal SHA directory and fixed basename.
        code = '''import base64,json,pathlib,struct,zipfile
p=pathlib.Path(SOURCE_PATH)
name='fcarena-runtime-'+p.parent.name+'.tar.gz'
with zipfile.ZipFile(p) as z:
 i=z.getinfo(name)
 assert i.compress_type==zipfile.ZIP_STORED and i.file_size==i.compress_size
 with p.open('rb') as f:
  f.seek(i.header_offset);h=f.read(30)
  assert h[:4]==b'PK\\x03\\x04'
  filename,extra=struct.unpack('<HH',h[26:30]);offset=i.header_offset+30+filename+extra
  remaining=p.stat().st_size-offset-i.file_size
  assert 0<=offset<=65536 and 0<=remaining<=65536
  f.seek(0);head=f.read(offset);f.seek(offset+i.file_size);tail=f.read(remaining)
 print(json.dumps({'name':name,'bytes':i.file_size,'head':base64.b64encode(head).decode(),'tail':base64.b64encode(tail).decode()}))
'''.replace('SOURCE_PATH', repr(item['path']))
        result = subprocess.run(['ssh', *common, args.host, 'python3 -'], input=code, text=True,
                                capture_output=True, timeout=60)
        if result.returncode != 0:
            return False
        return reconstruct_stored_zip(item, target, json.loads(result.stdout))

    ssh('python3 ' + GUARD + ' plan --output ' + REMOTE + 'pc-plan.json')
    plan_path = destination / 'pc-plan.private.json'
    scp(args.host + ':' + REMOTE + 'pc-plan.json', str(plan_path))
    report = json.loads(plan_path.read_text())
    expected = report.pop('planId')
    if hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest() != expected:
        raise ValueError('Server plan hash mismatch')
    receipt_path = destination / 'offhost-receipt.private.json'
    old = json.loads(receipt_path.read_text()) if receipt_path.exists() else {'files': []}
    # Re-hash old local escrow files as well; a stale receipt cannot authorize cleanup.
    copies = {i['source']: i for i in old['files'] if Path(i['localPath']).is_file()
              and Path(i['localPath']).resolve().parent == destination
              and digest(Path(i['localPath'])) == i['sha256']}
    for item in report['candidates']:
        if item['kind'] != 'downloaded-archive':
            continue
        target = archive_target(item, destination)
        if not target.exists() or digest(target) != item['sha256']:
            if shutil.disk_usage(destination).free < item['bytes'] + 1024**3:
                raise ValueError('Insufficient private PC space')
            if not reuse_inner_archive(item, target):
                partial = target.with_suffix(target.suffix + '.partial')
                resume_archive(item['path'], partial)
                if digest(partial) != item['sha256']:
                    raise ValueError('PC archive checksum mismatch')
                partial.replace(target)
        copies[item['path']] = {'source': item['path'], 'localPath': str(target), 'sha256': digest(target),
                                'bytes': target.stat().st_size, 'verified': True,
                                'verifiedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
        print('PC_ARCHIVE_VERIFIED=' + target.name, flush=True)
    receipt_path.write_text(json.dumps({'version': 1, 'files': list(copies.values())}, indent=2))
    scp(str(receipt_path), args.host + ':' + REMOTE + 'offhost-receipt.incoming.json')
    ssh('chmod 600 ' + REMOTE + 'offhost-receipt.incoming.json && mv ' + REMOTE + 'offhost-receipt.incoming.json ' + REMOTE + 'offhost-receipt.json')
    if args.cycle:
        ssh('python3 ' + GUARD + ' cycle')
    print('PRIVATE_PC_ESCROW=PASS')


if __name__ == '__main__':
    main()
