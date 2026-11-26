#!/usr/bin/env python3
"""Receive historical releases directly on the PC; publish a receipt only after full verification."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import secrets
import subprocess
import tarfile

REMOTE_STATE = '/var/lib/fcarena-release-storage/whole-release-escrow-20261126/'
REMOTE_HELPER = '/root/fcarena-awards-complete-tools/release-escrow-20261126.py'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--identity', required=True)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--plan-id')
    parser.add_argument('--cycle', action='store_true')
    args = parser.parse_args()
    assert bool(args.plan_id) != args.cycle, 'Choose one exact manual plan or the standing owner cycle'
    destination = Path(args.directory).resolve()
    common = ['-i', args.identity, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
              '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4']
    remote_state, remote_helper, suffix = REMOTE_STATE, REMOTE_HELPER, ''
    if args.cycle:
        cycle = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + secrets.token_hex(4)
        remote_state = '/var/lib/fcarena-release-storage/release-escrow/' + cycle + '/'
        remote_helper = '/opt/fcarena-ops/release/release_escrow.py'
        suffix = ' --state-id ' + cycle
        result = subprocess.check_output(['ssh', *common, args.host, 'python3 ' + remote_helper + ' plan' + suffix], timeout=1800)
        summary = json.loads(result)
        if summary['releaseCount'] == 0:
            print(json.dumps({'status': 'PASS', 'retiredReleases': 0}), flush=True)
            return
        args.plan_id = summary['planId']
        destination = destination / cycle
    assert len(args.plan_id) == 64 and all(c in '0123456789abcdef' for c in args.plan_id)
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)

    def read(name):
        return json.loads(subprocess.check_output(['ssh', *common, args.host, 'cat ' + remote_state + name], timeout=60))

    plan = read('plan.private.json')
    expected = dict(plan)
    assert expected.pop('planId') == args.plan_id
    assert hashlib.sha256(json.dumps(expected, sort_keys=True).encode()).hexdigest() == args.plan_id
    (destination / 'plan.private.json').write_text(json.dumps(plan, indent=2))
    target = destination / ('historical-deployments-' + args.plan_id[:16] + '.tar.gz')
    partial = target.with_name(target.name + '.partial')
    if not target.exists():
        assert shutil.disk_usage(destination).free >= 20 * 1024**3
        assert not partial.exists(), 'Review incomplete transfer before retrying'
        with partial.open('xb') as out, (destination / 'transfer.private.log').open('xb') as log:
            subprocess.run(['ssh', *common, args.host,
                            'python3 ' + remote_helper + ' stream --approved-plan ' + args.plan_id + suffix],
                           stdout=out, stderr=log, check=True, timeout=7200)
        streamed = read('stream.json')
        assert streamed['planId'] == args.plan_id and streamed['bytes'] == partial.stat().st_size
        assert digest(partial) == streamed['sha256'], 'Server and PC stream checksums differ'
        partial.replace(target)
    streamed = read('stream.json')
    assert target.stat().st_size == streamed['bytes'] and digest(target) == streamed['sha256']
    counts = {item['name']: 0 for item in plan['releases']}
    with tarfile.open(target, 'r|gz', bufsize=1024 * 1024) as archive:
        for member in archive:
            name = Path(member.name)
            assert not name.is_absolute() and '..' not in name.parts and '\\' not in member.name
            assert name.parts and name.parts[0] in counts
            counts[name.parts[0]] += 1
    assert counts == {item['name']: item['entries'] for item in plan['releases']}, 'Incomplete archive inventory'
    receipt = {'planId': args.plan_id, 'sha256': streamed['sha256'], 'bytes': streamed['bytes'],
               'releaseNames': sorted(counts), 'verified': True,
               'verifiedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'localPath': str(target)}
    receipt_path = destination / 'pc-receipt.private.json'
    receipt_path.write_text(json.dumps(receipt, indent=2))
    subprocess.run(['scp', '-q', *common, str(receipt_path), args.host + ':' + remote_state + 'pc-receipt.incoming.json'], check=True)
    subprocess.run(['ssh', *common, args.host, 'chmod 600 ' + remote_state + 'pc-receipt.incoming.json && mv '
                    + remote_state + 'pc-receipt.incoming.json ' + remote_state + 'pc-receipt.json'], check=True)
    print(json.dumps({'status': 'PC_ARCHIVE_VERIFIED', 'archive': str(target), 'bytes': streamed['bytes'],
                      'releaseCount': len(counts), 'verifiedEntries': sum(counts.values()), 'sha256': streamed['sha256']}), flush=True)
    if args.cycle:
        subprocess.run(['ssh', *common, args.host, 'python3 ' + remote_helper + ' apply --approved-plan '
                        + args.plan_id + suffix], check=True, timeout=1800)


if __name__ == '__main__':
    main()
