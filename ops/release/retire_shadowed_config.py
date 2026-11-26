#!/usr/bin/env python3
"""Retire overridden release paths without changing effective service configuration."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import socket
import subprocess

STATE = Path('/var/lib/fcarena-release-storage/retired-config-20261126-v2')
UNITS = ('fcarena-api', 'fcarena-web')
SHADOWED = {'ExecStart', 'EnvironmentFile', 'WorkingDirectory'}
PROVENANCE = Path('/etc/fcarena/runtime-env/v12-20261119T131653Z/manifest.json')
PROPERTIES = ('ExecStart', 'ExecStartPre', 'ExecStartPost', 'ExecStop', 'ExecStopPost',
              'WorkingDirectory', 'EnvironmentFiles', 'Environment', 'ReadWritePaths',
              'ReadOnlyPaths', 'InaccessiblePaths', 'BindPaths', 'BindReadOnlyPaths',
              'User', 'Group', 'UMask', 'NoNewPrivileges', 'PrivateTmp', 'PrivateDevices',
              'ProtectSystem', 'ProtectHome', 'ProtectKernelTunables', 'ProtectKernelModules',
              'ProtectControlGroups', 'RestrictSUIDSGID', 'LockPersonality',
              'CapabilityBoundingSet', 'RestrictAddressFamilies', 'MemoryHigh', 'MemoryMax',
              'CPUWeight', 'LimitNOFILE', 'Slice', 'Restart', 'RestartUSec', 'MainPID')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def strip_shadowed(text):
    """Only drop complete Service directives reset by the final managed override."""
    lines = text.splitlines(keepends=True)
    out, section, index = [], '', 0
    while index < len(lines):
        group = [lines[index]]
        index += 1
        while group[-1].rstrip('\r\n').endswith('\\') and index < len(lines):
            group.append(lines[index])
            index += 1
        first = group[0].strip()
        if first.startswith('[') and first.endswith(']'):
            section = first
        key = first.split('=', 1)[0].strip() if '=' in first else ''
        if section != '[Service]' or key not in SHADOWED:
            out.extend(group)
    return ''.join(out)


def show(unit, *keys):
    return subprocess.check_output(['systemctl', 'show',
                                   *['--property=' + key for key in keys], '--', unit], text=True)


def stable_properties(text):
    values = dict(line.split('=', 1) for line in text.splitlines() if '=' in line)
    for key in values:
        if key.startswith('Exec'):
            # daemon-reload clears systemd's invocation metadata, without executing the command.
            # Keep executable, argv and ignore_errors; MainPID is checked independently.
            values[key] = re.sub(r' ; start_time=[^}]*', ' ', values[key])
    return values


def snapshot():
    return {unit: stable_properties(show(unit, *PROPERTIES)) for unit in UNITS}


def private_save(path, value):
    require(not path.exists() and not path.is_symlink(), 'Existing state must be reviewed')
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        json.dump(value, stream, indent=2)


def guard():
    spec = importlib.util.spec_from_file_location('retention', '/opt/fcarena-ops/release/storage_retention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare():
    r = guard()
    state = json.loads(Path('/etc/fcarena/managed-release/current.json').read_text())
    r.healthy(state['release'])
    files = []
    for unit in UNITS:
        paths = show(unit, 'DropInPaths').strip().split('=', 1)[1].split()
        require(paths, 'Missing managed drop-ins')
        final = Path(paths[-1])
        text = final.read_text()
        require(final.name.endswith('-managed.conf') and 'EnvironmentFile=\n' in text
                and 'ExecStart=\n' in text and '\nWorkingDirectory=' in text,
                'Final managed override must reset every retired directive')
        for raw in paths[:-1]:
            path = Path(raw)
            require(path.parent == Path('/etc/systemd/system') / (unit + '.service.d')
                    and r.canonical(path), 'Unexpected drop-in path')
            original = path.read_bytes()
            replacement = strip_shadowed(original.decode()).encode()
            if original != replacement:
                files.append({'path': raw, 'sha256': sha(original),
                              'original': base64.b64encode(original).decode(),
                              'replacement': base64.b64encode(replacement).decode(),
                              'mode': path.stat().st_mode & 0o777})
    require(r.canonical(PROVENANCE), 'Unexpected provenance path')
    provenance = PROVENANCE.read_bytes()
    data = json.loads(provenance)
    require(set(data) == {'expected_release', 'mode', 'services'}, 'Unknown provenance format')
    # Fail if a loaded service property actually uses this historical inventory file.
    all_units = subprocess.check_output(['systemctl', 'list-units', '--all', '--plain',
                                        '--no-legend', '--no-pager'], text=True)
    for line in all_units.splitlines():
        unit = line.split()[0]
        require(str(PROVENANCE) not in show(unit, *PROPERTIES), 'Provenance file is in use')
    report = {'current': state, 'before': snapshot(), 'files': files,
              'provenance': {'path': str(PROVENANCE), 'sha256': sha(provenance),
                             'original': base64.b64encode(provenance).decode()}}
    report['planId'] = sha(json.dumps(report, sort_keys=True).encode())
    STATE.mkdir(mode=0o700, parents=True)
    private_save(STATE / 'plan.private.json', report)
    print(json.dumps({'planId': report['planId'], 'shadowedFiles': len(files),
                      'productionConfigChanged': False}))


def replace(path, data, mode):
    temporary = path.with_name('.storage-recovery-' + sha(str(path).encode())[:16] + '.partial')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(data)
    temporary.replace(path)


def apply(approved):
    r = guard()
    report = r.private_json(STATE / 'plan.private.json')
    expected = dict(report)
    require(expected.pop('planId') == approved and sha(json.dumps(expected, sort_keys=True).encode()) == approved,
            'Reviewed plan hash required')
    require(snapshot() == report['before'], 'Effective service configuration changed')
    require(json.loads(Path('/etc/fcarena/managed-release/current.json').read_text()) == report['current'],
            'Live release changed')
    for item in [*report['files'], report['provenance']]:
        require(r.canonical(Path(item['path'])) and sha(Path(item['path']).read_bytes()) == item['sha256'],
                'Reviewed file changed')
    r.healthy(report['current']['release'])
    changed = []
    provenance = report['provenance']
    try:
        for item in report['files']:
            replace(Path(item['path']), base64.b64decode(item['replacement']), item['mode'])
            changed.append(item)
        # Keep the original provenance bytes privately; this is historical evidence, not runtime config.
        PROVENANCE.rename(STATE / 'historical-runtime-env-manifest.private.json')
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        require(snapshot() == report['before'], 'Effective configuration mismatch; reverting')
        r.healthy(report['current']['release'])
    except BaseException:
        for item in changed:
            replace(Path(item['path']), base64.b64decode(item['original']), item['mode'])
        saved = STATE / 'historical-runtime-env-manifest.private.json'
        if saved.exists() and not PROVENANCE.exists():
            saved.rename(PROVENANCE)
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        raise
    result = {'status': 'PASS', 'shadowedFiles': len(changed),
              'effectiveConfigIdentical': True, 'pidsUnchanged': True,
              'applicationRestarted': False, 'dataTouched': False,
              'release': report['current']['release']}
    private_save(STATE / 'result.json', result)
    print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'apply'])
    parser.add_argument('--approved-plan')
    args = parser.parse_args()
    require(os.geteuid() == 0 and socket.gethostname().split('.')[0] == 'fcarena-prod', 'Wrong host')
    import fcntl
    with open('/run/lock/fcarena-release.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        prepare() if args.action == 'plan' else apply(args.approved_plan)


if __name__ == '__main__':
    main()
