#!/usr/bin/env python3
"""Archive Arena Talk images alongside the existing daily database backup."""
import hashlib
import fcntl
import json
import os
from pathlib import Path
import re
import tarfile
import time

MEDIA = Path(os.environ.get('ARENA_MEDIA_DIR', '/opt/fcarena/apps/api/storage/arena-talk')).resolve()
BACKUPS = Path(os.environ.get('FC_ARENA_ARENA_BACKUP_DIR', '/opt/fcarena/backups/arena-talk')).resolve()
RETENTION = int(os.environ.get('FC_ARENA_BACKUP_RETENTION_DAYS', '14'))
if RETENTION < 1 or BACKUPS == MEDIA or MEDIA in BACKUPS.parents or BACKUPS in MEDIA.parents:
    raise RuntimeError('Invalid media backup configuration')
BACKUPS.mkdir(mode=0o700, parents=True, exist_ok=True)
lock = (BACKUPS / '.backup.lock').open('a')
fcntl.flock(lock, fcntl.LOCK_EX)
stamp = time.strftime('%Y%m%d_%H%M%S', time.gmtime())
target = BACKUPS / ('arena-talk_' + stamp + '.tar.gz')
temporary = BACKUPS / ('.arena-talk_' + stamp + '.partial')
count = 0
try:
    with tarfile.open(temporary, 'x:gz') as archive:
        if MEDIA.is_dir():
            for image in sorted(MEDIA.iterdir()):
                if image.is_symlink() or not image.is_file() or not re.fullmatch(r'[0-9a-f-]{36}\.webp', image.name):
                    continue
                try:
                    archive.add(image, arcname=image.name, recursive=False)
                    count += 1
                except FileNotFoundError:
                    # A removed post's retention cleanup can finish during a backup.
                    continue
    temporary.chmod(0o600)
    with temporary.open('rb') as contents:
        checksum = hashlib.file_digest(contents, 'sha256').hexdigest()
    temporary.replace(target)
    signature = target.with_name(target.name + '.sha256')
    signature.write_text(checksum + '  ' + target.name + '\n')
    signature.chmod(0o600)
    # Remove only this helper's expired archives inside its resolved backup root.
    cutoff = time.time() - RETENTION * 86400
    for old in BACKUPS.iterdir():
        if (old.is_symlink() or not old.is_file() or old.resolve().parent != BACKUPS
                or not re.fullmatch(r'arena-talk_\d{8}_\d{6}\.tar\.gz(?:\.sha256)?', old.name)):
            continue
        if old.stat().st_mtime < cutoff:
            old.unlink()
    print(json.dumps({'arena_media_backup': 'complete', 'files': count, 'bytes': target.stat().st_size, 'retention_days': RETENTION}))
finally:
    if temporary.is_file():
        temporary.unlink()
