"""Synthetic-only tests for the offline runtime bundle verifier."""
import hashlib
import importlib.util
from io import BytesIO
from pathlib import Path
import tarfile
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "verify-offhost-runtime-bundle.py"
spec = importlib.util.spec_from_file_location("offhost_bundle", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
RELEASE = "a" * 40
REQUIRED = ["package.json", "package-lock.json", "apps/api/dist/main.js",
            "apps/web/.next/BUILD_ID"]


def bundle(root, entries=None, release=RELEASE):
    entries = REQUIRED if entries is None else entries
    path = root / f"fcarena-runtime-{RELEASE}.tar.gz"
    with tarfile.open(path, "w:gz") as tar:
        for entry in entries:
            if isinstance(entry, tuple):
                name, link = entry
                info = tarfile.TarInfo(name)
                info.type = tarfile.SYMTYPE
                info.linkname = link
                tar.addfile(info)
            else:
                body = b"test"
                info = tarfile.TarInfo(entry)
                info.size = len(body)
                tar.addfile(info, BytesIO(body))
    root.joinpath("RELEASE_SHA.txt").write_text(release + "\n")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    root.joinpath("SHA256SUMS").write_text(f"{digest}  {path.name}\n")


class TestBundleGate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_valid_disposable_bundle(self):
        bundle(self.root)
        self.assertEqual(module.verify(self.root, RELEASE), 4)

    def test_commit_identity_mismatch(self):
        bundle(self.root, release="b" * 40)
        with self.assertRaisesRegex(module.UnsafeBundle, "release SHA mismatch"):
            module.verify(self.root, RELEASE)

    def test_checksum_mismatch(self):
        bundle(self.root)
        (self.root / f"fcarena-runtime-{RELEASE}.tar.gz").write_bytes(b"broken")
        with self.assertRaisesRegex(module.UnsafeBundle, "checksum mismatch"):
            module.verify(self.root, RELEASE)

    def test_rejects_private_env(self):
        bundle(self.root, entries=REQUIRED + ["apps/api/.env.production"])
        with self.assertRaisesRegex(module.UnsafeBundle, "env bundled"):
            module.verify(self.root, RELEASE)

    def test_rejects_user_uploads(self):
        bundle(self.root, entries=REQUIRED + ["apps/api/storage/arena-talk/image.webp"])
        with self.assertRaisesRegex(module.UnsafeBundle, "persistent data"):
            module.verify(self.root, RELEASE)

    def test_rejects_path_escape(self):
        bundle(self.root, entries=REQUIRED + ["apps/web/../../etc/passwd"])
        with self.assertRaisesRegex(module.UnsafeBundle, "unsafe archive path"):
            module.verify(self.root, RELEASE)

    def test_rejects_escaping_symlink(self):
        bundle(self.root, entries=REQUIRED + [("node_modules/example", "../../../../etc/passwd")])
        with self.assertRaisesRegex(module.UnsafeBundle, "escaping archive link"):
            module.verify(self.root, RELEASE)

    def test_allows_workspace_relative_symlink(self):
        bundle(self.root, entries=REQUIRED + [("node_modules/example", "../package-lock.json")])
        self.assertEqual(module.verify(self.root, RELEASE), 5)


if __name__ == "__main__":
    unittest.main()
