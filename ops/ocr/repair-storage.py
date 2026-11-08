#!/usr/bin/env python3
"""Check, or repair with --apply, the legacy production OCR storage access."""
import argparse
import datetime
import json
import os
from pathlib import Path
import pwd
import stat
import subprocess
import time
import urllib.request

ROOT = Path('/opt/fcarena/storage/match-results')
PARENT = ROOT.parent
DROPIN = Path('/etc/systemd/system/fcarena-api.service.d/ocr-storage.conf')
BACKUPS = Path('/opt/fcarena-deployments')
CONFIG = '[Service]\nReadWritePaths=/opt/fcarena/storage/match-results\n'


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()


def metadata(path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode):
        raise RuntimeError('Refusing to change symlink permissions: ' + str(path))
    return dict(path=str(path), uid=info.st_uid, gid=info.st_gid, mode=stat.S_IMODE(info.st_mode))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    account = pwd.getpwnam('fcarena-api')
    if ROOT.resolve() != ROOT or PARENT.resolve() != PARENT or not ROOT.is_dir():
        raise RuntimeError('Expected the existing, real legacy OCR directory.')
    paths = [PARENT, ROOT]
    for directory, folders, files in os.walk(ROOT, followlinks=False):
        paths.extend(Path(directory) / name for name in folders + files)
    before = [metadata(path) for path in paths]
    print(json.dumps(dict(root=str(ROOT), paths=len(before), user=account.pw_name,
                         changes=['API-group traversal of parent', 'API ownership of OCR artifacts',
                                  'OCR path added to existing systemd write allowlist'])))
    if not args.apply:
        return
    if os.geteuid() != 0:
        raise RuntimeError('--apply requires root.')
    backup = BACKUPS / ('ocr-storage-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    if BACKUPS.resolve() != BACKUPS or not BACKUPS.is_dir():
        raise RuntimeError('Expected the existing deployment backup directory.')
    backup.mkdir(mode=0o700)
    old_config = DROPIN.read_bytes() if DROPIN.exists() else None
    if DROPIN.is_symlink() or DROPIN.parent.is_symlink():
        raise RuntimeError('Refusing a symlinked systemd drop-in.')
    (backup / 'permissions.json').write_text(json.dumps(before, indent=2))
    (backup / 'dropin.json').write_text(json.dumps(dict(existed=old_config is not None,
                                                       contents=old_config.decode() if old_config else '')))
    try:
        os.chown(PARENT, -1, account.pw_gid)
        os.chmod(PARENT, before[0]['mode'] | stat.S_IXGRP)
        for item in before[1:]:
            path = Path(item['path'])
            os.chown(path, account.pw_uid, account.pw_gid, follow_symlinks=False)
        DROPIN.parent.mkdir(parents=True, exist_ok=True)
        DROPIN.write_text(CONFIG)
        run('systemctl', 'daemon-reload')
        # Probe a temporary file under the same user and read-only filesystem
        # sandbox. No application result, screenshot or database row is changed.
        probe = 'import tempfile; f=tempfile.TemporaryFile(dir="' + str(ROOT) + '"); f.write(b"ocr-check"); f.close()'
        run('systemd-run', '--wait', '--pipe', '--collect', '--quiet',
            '-p', 'User=fcarena-api', '-p', 'Group=fcarena-api',
            '-p', 'ProtectSystem=strict', '-p', 'ReadWritePaths=' + str(ROOT),
            '/usr/bin/python3', '-c', probe)
        run('systemctl', 'restart', 'fcarena-api')
        for attempt in range(30):
            try:
                with urllib.request.urlopen('http://127.0.0.1:4000/api/health', timeout=2) as response:
                    health = json.load(response)
                if health.get('success') is True and health.get('data', {}).get('status') != 'unhealthy':
                    break
            except (OSError, ValueError):
                pass
            time.sleep(0.5)
        else:
            raise RuntimeError('API did not become healthy.')
        report = dict(status='repaired', storageProbe='passed', apiHealth='passed', backup=str(backup))
        (backup / 'verification.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
    except Exception:
        for item in reversed(before):
            os.chown(item['path'], item['uid'], item['gid'], follow_symlinks=False)
            os.chmod(item['path'], item['mode'])
        if old_config is None:
            DROPIN.unlink(missing_ok=True)
        else:
            DROPIN.write_bytes(old_config)
        run('systemctl', 'daemon-reload')
        run('systemctl', 'restart', 'fcarena-api')
        raise


if __name__ == '__main__':
    main()
