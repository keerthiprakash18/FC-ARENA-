#!/usr/bin/env python3
"""Explicit, receipt-gated relocation of unreferenced historical release roots."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import socket
import stat
import subprocess
import sys
import tempfile

ROOT = Path('/opt/fcarena-deployments')
ROOTS = {'deployments': ROOT, 'releases': Path('/opt/fcarena-releases'),
         'staging': Path('/opt/fcarena-staging')}
STATE = Path('/var/lib/fcarena-release-storage/whole-release-escrow-20261126')
POLICY = Path('/etc/fcarena/release-escrow-policy.json')
AUTOMATIC = False
NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,180}\Z')


def require(ok, why):
    if not ok:
        raise ValueError(why)


def digest_json(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def guard():
    spec = importlib.util.spec_from_file_location('retention', '/opt/fcarena-ops/release/storage_retention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def backup_ready():
    health = json.loads(Path('/var/lib/fcarena-backup-state/health.json').read_text())
    now = dt.datetime.now(dt.timezone.utc)
    require(health['encrypted'] and health['latestCopied'] and health['unavailableProviderAssets'] == 0,
            'Verified complete off-host recovery required')
    for key in ('lastLocalBackupAt', 'lastOffhostCopyAt', 'lastVerifiedRestoreAt'):
        age = now - dt.datetime.fromisoformat(health[key])
        require(dt.timedelta(minutes=-5) <= age <= dt.timedelta(hours=24), 'Recovery proof is stale')


def database_references():
    # Private pipe: no dump or user record is printed or written into the plan.
    raw = subprocess.check_output(['docker', 'exec', 'fc-arena-postgres', 'sh', '-ec',
                                  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only'],
                                 stderr=subprocess.PIPE, timeout=120)
    return set(re.findall(re.escape(str(ROOT).encode()) + rb'/([A-Za-z0-9_.-]+)', raw))


def legacy_references(r, root):
    """The retired pre-managed roots need the same config/process/link reference safeguards."""
    pattern = re.compile(re.escape(str(root)) + r'/([^/\s\"\x27;]+)')
    refs = {}

    def add(text, why):
        for name in pattern.findall(text):
            if (root / name).is_dir():
                refs.setdefault(name, set()).add(why)

    for start in r.CONFIG_ROOTS:
        if Path(start).exists():
            for path in Path(start).rglob('*'):
                if path.is_file():
                    require(path.stat().st_size < 1024**2, 'Oversized configuration needs review')
                    add(path.read_text(errors='ignore'), str(path))
    for text in r.process_paths():
        add(text, 'live process/open descriptor')
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        for leaf in ('cmdline', 'environ', 'maps'):
            try:
                add((proc / leaf).read_text(errors='ignore'), 'live process')
            except (FileNotFoundError, ProcessLookupError):
                pass
    for path in r.mount_paths():
        add(str(path), 'mount')
    roots = [str(p) for p in (Path('/opt'), Path('/etc/fcarena'), Path('/var/backups')) if p.exists()]
    links = subprocess.check_output(['find', *roots, '-type', 'l', '-printf', r'%p\t%l\0'])
    for entry in links.decode().split('\0'):
        if entry:
            link, target = entry.split('\t', 1)
            resolved = (Path(link).parent / target).resolve()
            if pattern.findall(link) != pattern.findall(str(resolved)):
                add(str(resolved), 'external symlink')
    return refs


def tree_fingerprint(path):
    """Bound the complete tree, including empty folders, hardlinks and symlinks; never follow links."""
    rows, pending = [], [path]
    device = path.stat().st_dev
    while pending:
        current = pending.pop()
        info = current.lstat()
        require(info.st_dev == device, 'Nested filesystem refused')
        require(stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode),
                'Special file in historical release')
        rows.append((str(current.relative_to(path)), info.st_mode, info.st_size, info.st_mtime_ns,
                     info.st_ino, info.st_dev, info.st_uid, info.st_gid, info.st_nlink,
                     os.readlink(current) if stat.S_ISLNK(info.st_mode) else ''))
        if stat.S_ISDIR(info.st_mode):
            pending.extend(current.iterdir())
    return {'treeSha256': digest_json(sorted(rows)), 'entries': len(rows)}


def admission(r):
    backup_ready()
    refs, current, rollback = r.referenced_releases()
    if ROOT != ROOTS['deployments']:
        refs = legacy_references(r, ROOT)
    r.healthy(current['release'])
    for name in database_references():
        refs.setdefault(name.decode(), set()).add('database file reference')
    return refs, current, rollback


def prepare(r):
    refs, current, rollback = admission(r)
    items = []
    cycle_bytes = 0
    if AUTOMATIC:
        policy = r.private_json(POLICY)
        require(policy.get('approvedBy') == 'owner'
                and policy.get('scope') == 'pc-verified-unreferenced-release-roots-v1'
                and policy.get('minimumAgeHours') == 24 and policy.get('maxCycleGiB') == 10,
                'Standing owner relocation policy required')
    for path in sorted(ROOT.iterdir()):
        if not path.is_dir() or not r.canonical(path) or path.name in refs:
            continue
        if not NAME.fullmatch(path.name):
            refs.setdefault(path.name, set()).add('unexpected historical name; manual review')
            continue
        if dt.datetime.now().timestamp() - path.stat().st_mtime < 24 * 3600:
            continue
        if AUTOMATIC:
            size = int(subprocess.check_output(['du', '-s', '-B1', '--', str(path)]).split()[0])
            if len(items) >= 10 or cycle_bytes + size > 10 * 1024**3:
                continue
            cycle_bytes += size
        items.append({'name': path.name, **tree_fingerprint(path)})
    report = {'root': str(ROOT), 'current': current, 'rollback': rollback, 'releases': items,
              'protected': sorted(refs), 'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'automatic': AUTOMATIC}
    report['planId'] = digest_json(report)
    STATE.mkdir(mode=0o700)
    r.save(STATE / 'plan.private.json', report)
    print(json.dumps({'action': 'READ_ONLY_PLAN', 'planId': report['planId'],
                      'releaseCount': len(items), 'protectedCount': len(refs), 'dataChanged': False}), flush=True)


def reviewed(r, approved):
    report = r.private_json(STATE / 'plan.private.json')
    value = dict(report)
    require(value.pop('planId') == approved and digest_json(value) == approved, 'Exact reviewed plan required')
    require(report.get('root', str(ROOT)) == str(ROOT), 'Plan belongs to another deployment root')
    require(report['releases'], 'Empty plan')
    if report.get('automatic'):
        policy = r.private_json(POLICY)
        require(AUTOMATIC and policy.get('approvedBy') == 'owner'
                and policy.get('scope') == 'pc-verified-unreferenced-release-roots-v1'
                and policy.get('minimumAgeHours') == 24 and policy.get('maxCycleGiB') == 10,
                'Standing relocation policy was removed or changed')
    refs, current, rollback = admission(r)
    require(current == report['current'] and rollback == report['rollback'], 'Active release or rollback changed')
    mounts = r.mount_paths()
    for item in report['releases']:
        name = item['name']
        require(NAME.fullmatch(name) and name not in refs, 'Release acquired a protected reference')
        path = ROOT / name
        require(path.parent == ROOT and r.canonical(path) and path.is_dir(), 'Invalid release root')
        require(not any(m == path or m.is_relative_to(path) for m in mounts), 'Mounted release refused')
        require(tree_fingerprint(path) == {key: item[key] for key in ('treeSha256', 'entries')},
                'Historical release tree changed')
    return report


def stream(r, approved):
    report = reviewed(r, approved)
    names = [item['name'] for item in report['releases']]
    require(not (STATE / 'stream.json').exists(), 'Existing stream evidence must be reviewed')
    digest, total = hashlib.sha256(), 0
    with tempfile.TemporaryFile() as error:
        tar = subprocess.Popen(['nice', '-n', '15', 'tar', '--one-file-system', '--numeric-owner',
                                '-C', str(ROOT), '-cf', '-', '--', *names], stdout=subprocess.PIPE, stderr=error)
        compression = subprocess.Popen(['nice', '-n', '15', 'gzip', '-1'], stdin=tar.stdout,
                                       stdout=subprocess.PIPE, stderr=error)
        tar.stdout.close()
        try:
            while block := compression.stdout.read(1024 * 1024):
                sys.stdout.buffer.write(block)
                digest.update(block)
                total += len(block)
            sys.stdout.buffer.flush()
            require(compression.wait() == 0 and tar.wait() == 0, 'Archive source changed or compression failed')
        finally:
            compression.stdout.close()
            for process in (compression, tar):
                if process.poll() is None:
                    process.kill()
                process.wait()
    # Archive streaming changed no source bytes. Revalidate on apply, after the PC checks its copy.
    value = {'planId': approved, 'sha256': digest.hexdigest(), 'bytes': total,
             'completedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
    r.save(STATE / 'stream.json', value)
    print(json.dumps({'archiveStreamed': True, 'bytes': total, 'sha256': value['sha256']}), file=sys.stderr, flush=True)


def apply(r, approved):
    streamed = r.private_json(STATE / 'stream.json')
    receipt = r.private_json(STATE / 'pc-receipt.json')
    require(streamed['planId'] == receipt['planId'] == approved and receipt['verified'] is True,
            'PC verification receipt required')
    require(all(streamed[key] == receipt[key] for key in ('sha256', 'bytes')), 'Off-host archive mismatch')
    age = dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(receipt['verifiedAt'])
    require(dt.timedelta(minutes=-5) <= age <= dt.timedelta(hours=2), 'PC verification is stale')
    report = reviewed(r, approved)  # Recheck references and every tree before deleting anything.
    require(set(receipt['releaseNames']) == {item['name'] for item in report['releases']}, 'PC archive inventory differs')
    before = shutil.disk_usage(ROOT).free
    removed = []
    for item in report['releases']:
        path = ROOT / item['name']
        require(r.canonical(path) and tree_fingerprint(path)['treeSha256'] == item['treeSha256'],
                'Historical release changed immediately before deletion')
        shutil.rmtree(path)
        removed.append(item['name'])
    r.healthy(report['current']['release'])
    result = {'status': 'PASS', 'removedReleases': removed, 'freeBeforeBytes': before,
              'freeAfterBytes': shutil.disk_usage(ROOT).free, 'offhostArchiveSha256': receipt['sha256'],
              'release': report['current']['release'], 'applicationRestarted': False,
              'liveDatabaseOrUploadsTouched': False}
    r.save(STATE / 'result.json', result)
    print(json.dumps(result), flush=True)


def main():
    global STATE, AUTOMATIC, ROOT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'stream', 'apply'])
    parser.add_argument('--approved-plan')
    parser.add_argument('--state-id')
    parser.add_argument('--root', choices=tuple(ROOTS), default='deployments')
    args = parser.parse_args()
    require(os.geteuid() == 0 and socket.gethostname().split('.')[0] == 'fcarena-prod', 'Wrong host')
    ROOT = ROOTS[args.root]
    require(ROOT.is_dir() and ROOT.resolve() == ROOT and not ROOT.is_symlink(), 'Invalid deployment root')
    if args.root != 'deployments':
        require(not args.state_id, 'Standing policy is limited to the managed deployment root')
        STATE = STATE.with_name(STATE.name + '-' + args.root)
    if args.state_id:
        require(re.fullmatch(r'[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}', args.state_id), 'Invalid cycle identifier')
        STATE = Path('/var/lib/fcarena-release-storage/release-escrow') / args.state_id
        STATE.parent.mkdir(mode=0o700, exist_ok=True)
        AUTOMATIC = True
    r = guard()
    import fcntl
    with open('/run/lock/fcarena-release.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        {'plan': lambda: prepare(r), 'stream': lambda: stream(r, args.approved_plan),
         'apply': lambda: apply(r, args.approved_plan)}[args.action]()


if __name__ == '__main__':
    main()
