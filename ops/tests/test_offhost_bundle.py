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
                name, link, *kind = entry
                info = tarfile.TarInfo(name)
                info.type = kind[0] if kind else tarfile.SYMTYPE
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

    def test_rejects_symlink_ancestor_in_both_orders(self):
        link = ("node_modules/example", "../apps/web")
        child = "node_modules/example/unexpected.js"
        for pair in ([link, child], [child, link]):
            with self.subTest(pair=pair):
                bundle(self.root, entries=REQUIRED + pair)
                with self.assertRaisesRegex(module.UnsafeBundle, "non-directory archive ancestor"):
                    module.verify(self.root, RELEASE)

    def test_rejects_regular_file_as_parent(self):
        bundle(self.root, entries=REQUIRED + ["node_modules/file", "node_modules/file/child"])
        with self.assertRaisesRegex(module.UnsafeBundle, "non-directory archive ancestor"):
            module.verify(self.root, RELEASE)

    def test_rejects_symlink_in_place_of_required_runtime_file(self):
        entries = [entry for entry in REQUIRED if entry != "apps/web/.next/BUILD_ID"]
        bundle(self.root, entries=entries + [("apps/web/.next/BUILD_ID", "../../../package.json")])
        with self.assertRaisesRegex(module.UnsafeBundle, "regular files required"):
            module.verify(self.root, RELEASE)

    def test_rejects_missing_or_symlink_hardlink_target(self):
        for target in ("node_modules/missing", "node_modules/link"):
            with self.subTest(target=target):
                bundle(self.root, entries=REQUIRED + [
                    ("node_modules/link", "../package.json"),
                    ("node_modules/hard", target, tarfile.LNKTYPE),
                ])
                with self.assertRaisesRegex(module.UnsafeBundle, "hardlink target"):
                    module.verify(self.root, RELEASE)

    def test_allows_internal_regular_hardlink(self):
        bundle(self.root, entries=REQUIRED + [
            ("node_modules/hard", "package.json", tarfile.LNKTYPE),
        ])
        self.assertEqual(module.verify(self.root, RELEASE), 5)

    def test_allows_workspace_relative_symlink(self):
        bundle(self.root, entries=REQUIRED + [("node_modules/example", "../package-lock.json")])
        self.assertEqual(module.verify(self.root, RELEASE), 5)


if __name__ == "__main__":
    unittest.main()
