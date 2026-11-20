"""Synthetic, offline-only FC ARENA media backup and recovery rehearsal.

Does NOT access the live VCL server, production files, or database.
All fixture media and backup archives stay in OS temporary directories.
"""
from hashlib import sha256
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest

HELPER = Path(__file__).with_name("arena-media-backup.py")
IMAGES = {
    "00000000-0000-4000-8000-000000000001.webp": b"RIFF" + b"A" * 72 + b"WEBP",
    "00000000-0000-4000-8000-000000000002.webp": b"RIFF" + b"B" * 119 + b"WEBP",
}


def invoke(media: Path, backups: Path, retention="14"):
    env = dict(os.environ)
    env.update({
        "ARENA_MEDIA_DIR": str(media),
        "FC_ARENA_ARENA_BACKUP_DIR": str(backups),
        "FC_ARENA_BACKUP_RETENTION_DAYS": retention,
    })
    return subprocess.run(
        [sys.executable, str(HELPER)],
        capture_output=True, text=True, env=env, timeout=20, check=False,
    )


class TestArenaMediaOffHostRecovery(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fcarena-media-fixture-")
        self.root = Path(self.temp.name)
        self.media = self.root / "fake-live-media"
        self.backups = self.root / "fake-local-backups"
        self.offhost = self.root / "fake-offhost"
        self.restore = self.root / "disposable-restore"
        self.media.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def archive(self):
        files = list(self.backups.glob("arena-talk_*.tar.gz"))
        self.assertEqual(len(files), 1)
        archive = files[0]
        sidecar = archive.with_name(archive.name + ".sha256")
        self.assertTrue(sidecar.is_file())
        self.assertEqual(
            sidecar.read_text().strip(),
            f"{sha256(archive.read_bytes()).hexdigest()}  {archive.name}",
        )
        return archive, sidecar

    def test_archive_offhost_copy_restore_and_exact_data_parity(self):
        for name, data in IMAGES.items():
            (self.media / name).write_bytes(data)
        (self.media / "not-an-image.txt").write_bytes(b"excluded")
        (self.media / "nested").mkdir()
        (self.media / "nested" / "ignore.webp").write_bytes(b"excluded")
        (self.media / "11111111-1111-4111-8111-111111111111.webp").symlink_to(
            self.media / "not-an-image.txt"
        )
        before = {name: (self.media / name).read_bytes() for name in IMAGES}
        outcome = invoke(self.media, self.backups)
        self.assertEqual(outcome.returncode, 0, outcome.stderr)
        archive, sidecar = self.archive()
        self.offhost.mkdir()
        copied = self.offhost / archive.name
        shutil.copy2(archive, copied)
        shutil.copy2(sidecar, self.offhost / sidecar.name)
        self.assertEqual(sha256(copied.read_bytes()).digest(), sha256(archive.read_bytes()).digest())
        self.restore.mkdir()
        with tarfile.open(copied, "r:gz") as bundle:
            self.assertEqual(sorted(bundle.getnames()), sorted(IMAGES))
            bundle.extractall(self.restore, filter="data")
        self.assertEqual(
            {path.name: path.read_bytes() for path in self.restore.iterdir()},
            before,
        )
        self.assertEqual(
            {name: (self.media / name).read_bytes() for name in IMAGES},
            before,
        )

    def test_empty_media_is_a_valid_empty_archive_not_recovery_evidence_for_images(self):
        outcome = invoke(self.media, self.backups)
        self.assertEqual(outcome.returncode, 0, outcome.stderr)
        archive, _ = self.archive()
        with tarfile.open(archive, "r:gz") as bundle:
            self.assertEqual(bundle.getmembers(), [])
        self.assertTrue(self.media.is_dir())

    def test_unsafe_backup_root_refused_without_touching_media(self):
        name, body = next(iter(IMAGES.items()))
        (self.media / name).write_bytes(body)
        outcome = invoke(self.media, self.media)
        self.assertNotEqual(outcome.returncode, 0)
        self.assertEqual((self.media / name).read_bytes(), body)
        self.assertEqual(sorted(p.name for p in self.media.iterdir()), [name])

    def test_retention_cannot_delete_user_media_or_unrelated_backup_files(self):
        name, body = next(iter(IMAGES.items()))
        (self.media / name).write_bytes(body)
        self.backups.mkdir()
        old = self.backups / "arena-talk_20250101_010101.tar.gz"
        old.write_bytes(b"old synthetic archive")
        age = time.time() - 32 * 86400
        os.utime(old, (age, age))
        keep = self.backups / "important.txt"
        keep.write_bytes(b"do not delete")
        outcome = invoke(self.media, self.backups)
        self.assertEqual(outcome.returncode, 0, outcome.stderr)
        self.assertFalse(old.exists())
        self.assertEqual(keep.read_bytes(), b"do not delete")
        self.assertEqual((self.media / name).read_bytes(), body)


if __name__ == "__main__":
    unittest.main()
