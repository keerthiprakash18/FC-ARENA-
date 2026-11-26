#!/usr/bin/env python3
"""Guarded release storage. Never deletes release roots, source, env, media or DB."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import time
import urllib.request

RELEASES = Path('/opt/fcarena-deployments')
ARTIFACTS = Path('/root/fcarena-audit-improvements/artifacts')
STATE = Path('/var/lib/fcarena-release-storage')
POLICY = Path('/etc/fcarena/release-storage-policy.json')
PATTERN = re.compile(r'/opt/fcarena-deployments/([^/\s\"\x27;]+)')
ARCHIVE = re.compile(r'(?:fcarena-(?:vcl-runtime-[0-9a-f]{40}\.zip|runtime-[0-9a-f]{40}\.tar\.gz)|runtime-artifact\.zip)$')
RELATIVE = tuple(prefix + suffix for prefix in ('', 'source/', 'candidate/', 'runtime/')
                 for suffix in ('node_modules', 'apps/web/node_modules', 'apps/web/.next/cache'))
CONFIG_ROOTS = ('/etc/systemd/system', '/etc/fcarena', '/etc/cron.d', '/etc/cron.daily',
                '/etc/cron.hourly', '/etc/cron.weekly', '/etc/cron.monthly', '/etc/nginx',
                '/var/spool/cron', '/opt/fcarena-ops', '/usr/local/bin', '/usr/local/sbin')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def canonical(path):
    path = Path(path)
    return path.is_absolute() and path.resolve() == path and not any(
        parent.is_symlink() for parent in (path, *path.parents))


def mount_paths():
    return {Path(re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), line.split()[4]))
            for line in Path('/proc/self/mountinfo').read_text().splitlines()}


def process_paths():
    paths = set()
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        for leaf in ('cwd', 'exe'):
            try:
                paths.add(os.readlink(proc / leaf))
            except (FileNotFoundError, ProcessLookupError):
                pass
        try:
            for fd in (proc / 'fd').iterdir():
                try:
                    paths.add(os.readlink(fd))
                except (FileNotFoundError, ProcessLookupError):
                    pass
        except (FileNotFoundError, ProcessLookupError):
            pass
    return paths


def referenced_releases(root=RELEASES):
    refs = {}

    def add(text, why):
        for name in PATTERN.findall(text):
            if (root / name).is_dir():
                refs.setdefault(name, set()).add(why)

    for start in CONFIG_ROOTS:
        folder = Path(start)
        if not folder.exists():
            continue
        for path in folder.rglob('*'):
            if path.is_file():
                require(path.stat().st_size < 1024**2, 'Oversized config; review manually: ' + str(path))
                add(path.read_text(errors='ignore'), str(path))
    for text in process_paths():
        add(text, 'live process/open descriptor')
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        for leaf in ('cmdline', 'environ', 'maps'):
            try:
                add((proc / leaf).read_text(errors='ignore'), 'live process')
            except (FileNotFoundError, ProcessLookupError):
                pass
    for path in mount_paths():
        add(str(path), 'mount')
    roots = [str(p) for p in (root, Path('/opt/fcarena'), Path('/opt/fcarena-ops'),
                              Path('/etc/fcarena'), Path('/var/backups')) if p.exists()]
    links = subprocess.check_output(['find', *roots, '-type', 'l', '-printf', r'%p\t%l\0'])
    for entry in links.decode().split('\0'):
        if entry:
            link, target = entry.split('\t', 1)
            resolved = (Path(link).parent / target).resolve()
            # pnpm internal links do not make an unused release live.
            if PATTERN.findall(link) != PATTERN.findall(str(resolved)):
                add(str(resolved), 'external symlink')
    state = json.loads(Path('/etc/fcarena/managed-release/current.json').read_text())
    current = Path(state['runtime'])
    require(current.parent.parent == root and canonical(current), 'Invalid current runtime')
    rollback = json.loads((current.parent / 'managed-rollback.private.json').read_text())['previousManaged']
    previous = Path(rollback['runtime'])
    require(previous.parent.parent == root and canonical(previous) and previous.is_dir(), 'Invalid rollback')
    add(str(current), 'current managed release')
    add(str(previous), 'verified rollback')
    for name in ('playoff-visual-v11-2433159e0d5c', 'fcarena-v12-stage-154b8440b92c'):
        refs.setdefault(name, set()).add('protected historic baseline')
    return refs, state, rollback


def candidates(root, artifact_root, protected, mounts=(), opened=()):
    out = []

    def safe(path):
        return canonical(path) and not any(path == m or m.is_relative_to(path) for m in mounts) and not any(
            Path(p.removesuffix(' (deleted)')).is_relative_to(path) for p in opened)

    for release in sorted(root.iterdir()):
        if not release.is_dir() or not canonical(release) or release.name in protected:
            continue
        for relative in RELATIVE:
            path = release / relative
            if path.is_dir() and safe(path) and not any(path.is_relative_to(Path(i['path'])) for i in out):
                out.append({'path': str(path), 'kind': 'rebuildable-directory'})
    if artifact_root.exists() and canonical(artifact_root):
        for path in sorted(artifact_root.glob('*/*')):
            if (path.is_file() and safe(path) and ARCHIVE.fullmatch(path.name)
                    and re.fullmatch('[0-9a-f]{40}', path.parent.name)):
                out.append({'path': str(path), 'kind': 'downloaded-archive'})
    return out


def fingerprint(path):
    stat = Path(path).stat()
    return {'device': stat.st_dev, 'inode': stat.st_ino, 'mtime_ns': stat.st_mtime_ns}


def seal(report):
    report['planId'] = hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest()
    return report


def plan():
    refs, state, rollback = referenced_releases()
    items = candidates(RELEASES, ARTIFACTS, refs, mount_paths(), process_paths())
    for item in items:
        path = Path(item['path'])
        item['fingerprint'] = fingerprint(path)
        item['bytes'] = int(subprocess.check_output(['du', '-s', '-B1', '--', str(path)]).split()[0])
        if item['kind'] == 'downloaded-archive':
            item['sha256'] = digest(path)
    return seal({'version': 2, 'current': state, 'rollback': rollback,
                 'protected': {k: sorted(v) for k, v in refs.items()}, 'candidates': items,
                 'reclaimBytes': sum(i['bytes'] for i in items), 'approvalRequired': True})


def private_json(path):
    path = Path(path)
    stat = path.stat()
    require(canonical(path) and stat.st_uid == 0 and stat.st_mode & 0o077 == 0, 'Private root-owned file required')
    return json.loads(path.read_text())


def healthy(expected):
    for port in (3000, 3001, 4000, 4001):
        web = port < 4000
        with urllib.request.urlopen('http://127.0.0.1:' + str(port) + ('/web-release' if web else '/api/health'), timeout=10) as response:
            body = json.load(response)
        if web:
            require(body['release'] == expected, 'Web release changed')
        else:
            data = body['data']
            require(body['success'] and data['database'] == data['redis'] == 'connected'
                    and data['runtime']['release'] == expected, 'API not healthy at expected release')


def apply(path, approval, receipt_path=None):
    reviewed = private_json(path)
    require(reviewed['planId'] == approval and len(approval) == 64, 'Exact owner-approved plan ID required')
    expected = dict(reviewed)
    expected.pop('planId')
    require(seal(expected)['planId'] == approval, 'Plan hash invalid')
    fresh = plan()
    require(fresh['current'] == reviewed['current'] and fresh['rollback'] == reviewed['rollback'], 'Live/rollback changed')
    allowed = {i['path']: i for i in fresh['candidates']}
    receipt = private_json(receipt_path) if receipt_path else {'files': []}
    copies = {i['source']: i for i in receipt['files'] if i.get('verified') is True}
    # Validate every candidate before deleting any of them.
    for item in reviewed['candidates']:
        require(allowed.get(item['path']) == item, 'Changed or referenced candidate: ' + item['path'])
        if item['kind'] == 'downloaded-archive':
            require(copies.get(item['path'], {}).get('sha256') == item['sha256'], 'No checksum-verified private PC archive')
        require(fingerprint(item['path']) == item['fingerprint'], 'Candidate changed')
    healthy(reviewed['current']['release'])
    before = shutil.disk_usage(RELEASES).free
    removed = []
    for item in reviewed['candidates']:
        require(canonical(Path(item['path'])) and fingerprint(item['path']) == item['fingerprint'], 'Candidate changed during cleanup')
        if item['kind'] == 'downloaded-archive':
            Path(item['path']).unlink()
        else:
            shutil.rmtree(item['path'])
        removed.append(item['path'])
    healthy(reviewed['current']['release'])
    return {'status': 'PASS', 'removed': removed,
            'removedDirectories': sum(i['kind'] == 'rebuildable-directory' for i in reviewed['candidates']),
            'removedArchives': sum(i['kind'] == 'downloaded-archive' for i in reviewed['candidates']),
            'freeBeforeBytes': before, 'freeAfterBytes': shutil.disk_usage(RELEASES).free, 'userDataTouched': False,
            'release': reviewed['current']['release'], 'verifiedAt': dt.datetime.now(dt.timezone.utc).isoformat()}


def save(path, value):
    require(not path.is_symlink(), 'Symlink output refused')
    partial = path.with_suffix(path.suffix + '.partial')
    require(not partial.exists(), 'Stale partial output; inspect manually')
    with partial.open('x', encoding='utf-8') as stream:
        os.chmod(partial, 0o600)
        json.dump(value, stream, indent=2)
    partial.replace(path)


def select_policy(report, policy, receipt, now=None):
    require(policy.get('approvedBy') == 'owner' and policy.get('scope') == 'unreferenced-packages-cache-and-pc-verified-archives-v1', 'Standing owner policy required')
    age, limit = policy['minimumAgeHours'], policy['maxCycleGiB']
    require(24 <= age <= 720 and 0 < limit <= 10, 'Policy bounds invalid')
    now = time.time() if now is None else now
    copies = {i['source']: i for i in receipt['files'] if i.get('verified') is True
              and -300 <= now - dt.datetime.fromisoformat(i['verifiedAt']).timestamp() <= 48 * 3600}
    selected = [i for i in report['candidates'] if now - i['fingerprint']['mtime_ns'] / 1e9 >= age * 3600
                and (i['kind'] != 'downloaded-archive' or copies.get(i['path'], {}).get('sha256') == i['sha256'])]
    require(sum(i['bytes'] for i in selected) <= limit * 1024**3, 'Cycle exceeds approved budget; manual review required')
    value = {k: v for k, v in report.items() if k != 'planId'}
    value.update(candidates=selected, reclaimBytes=sum(i['bytes'] for i in selected))
    return seal(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'apply', 'cycle', 'preflight'])
    for option in ('output', 'plan', 'approved-plan', 'offhost-receipt'):
        parser.add_argument('--' + option)
    args = parser.parse_args()
    require(os.geteuid() == 0 and socket.gethostname().split('.')[0] == 'fcarena-prod', 'Wrong host or user')
    require(RELEASES.is_dir() and canonical(RELEASES), 'Invalid release root')
    # Read-only admission also runs inside managed_runtime's activation lock.
    # Do not reacquire that lock in the child process.
    if args.action == 'preflight':
        healthy(json.loads(Path('/etc/fcarena/managed-release/current.json').read_text())['release'])
        free = shutil.disk_usage(RELEASES).free
        require(free >= 12 * 1024**3, 'Less than 12 GiB free: cleanup required before staging')
        print(json.dumps({'status': 'PASS', 'freeBytes': free, 'requiredFreeGiB': 12}))
        return
    import fcntl
    with open('/run/lock/fcarena-release.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.action == 'apply':
            require(args.plan and args.approved_plan, 'Reviewed plan and approval required')
            result = apply(args.plan, args.approved_plan, args.offhost_receipt)
        elif args.action == 'cycle':
            receipt_path = STATE / 'offhost-receipt.json'
            receipt = private_json(receipt_path) if receipt_path.exists() else {'files': []}
            report = select_policy(plan(), private_json(POLICY), receipt)
            save(STATE / 'cycle-plan.json', report)
            result = apply(STATE / 'cycle-plan.json', report['planId'], receipt_path if receipt_path.exists() else None)
        else:
            report = plan()
            if args.output:
                save(Path(args.output), report)
            result = {'action': 'READ_ONLY_PLAN', 'planId': report['planId'], 'current': report['current']['release'],
                      'protectedReleases': len(report['protected']), 'candidates': len(report['candidates']),
                      'reclaimGiB': round(report['reclaimBytes'] / 1024**3, 2), 'productionChanged': False}
        if args.action in ('apply', 'cycle'):
            STATE.mkdir(mode=0o700, exist_ok=True)
            save(STATE / 'last-cleanup.json', result)
        print(json.dumps(result))


if __name__ == '__main__':
    main()
