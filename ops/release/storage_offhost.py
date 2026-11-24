#!/usr/bin/env python3
"""PC-side archive escrow. Copy/hash first; server independently rechecks before cleanup."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

REMOTE = '/var/lib/fcarena-release-storage/'
GUARD = '/opt/fcarena-ops/release/storage_retention.py'
SOURCE = re.compile(r'/root/fcarena-audit-improvements/artifacts/([0-9a-f]{40})/(fcarena-(?:runtime-[0-9a-f]{40}\.tar\.gz|vcl-runtime-[0-9a-f]{40}\.zip))$')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def archive_target(item, destination):
    match = SOURCE.fullmatch(item['path'])
    if not match or match[1] not in match[2] or not re.fullmatch('[0-9a-f]{64}', item['sha256']):
        raise ValueError('Unexpected archive path/checksum')
    return destination / match[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--identity', required=True)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--cycle', action='store_true', help='Uses previously installed owner-approved server policy')
    args = parser.parse_args()
    destination = Path(args.directory).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    common = ['-i', args.identity, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15']

    def ssh(command):
        subprocess.run(['ssh', *common, args.host, command], check=True, timeout=1800)

    def scp(source, target):
        subprocess.run(['scp', '-q', *common, source, target], check=True, timeout=1800)

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
            partial = target.with_suffix(target.suffix + '.partial')
            scp(args.host + ':' + item['path'], str(partial))
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
