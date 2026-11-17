"""Regression tests for safe, bounded systemd release override management."""
import importlib.util
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'tournament-production-release.py'
spec = importlib.util.spec_from_file_location('tournament_production_release', SCRIPT)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ManagedReleaseDropinTests(unittest.TestCase):
    def test_reuses_one_managed_dropin_and_restores_both_levels(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            directory = base / 'api.service.d'
            directory.mkdir()
            (directory / '99-existing.conf').write_text('[Service]\nEnvironmentFile=/old/release.env\n')
            first_backup = base / 'first-rollback'
            first_backup.mkdir()
            second_backup = base / 'second-rollback'
            second_backup.mkdir()

            first = release.install_managed_release_dropin(
                directory, Path('/releases/one/release.env'), first_backup, 'api')
            managed = Path(first['path'])
            self.assertTrue(managed.is_file())
            self.assertEqual(len(list(directory.glob('*.conf'))), 2)
            self.assertFalse(first['existed'])
            self.assertIn('/releases/one/release.env', managed.read_text())

            second = release.install_managed_release_dropin(
                directory, Path('/releases/two/release.env'), second_backup, 'api')
            self.assertEqual(second['path'], first['path'])
            self.assertTrue(second['existed'])
            self.assertEqual(len(list(directory.glob('*.conf'))), 2)
            self.assertIn('/releases/two/release.env', managed.read_text())

            release.restore_managed_release_dropin(second, second_backup, 'api')
            self.assertIn('/releases/one/release.env', managed.read_text())
            release.restore_managed_release_dropin(first, first_backup, 'api')
            self.assertFalse(managed.exists())
            self.assertEqual(len(list(directory.glob('*.conf'))), 1)

    def test_orders_after_long_legacy_names_without_extending_the_entire_name(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            directory = base / 'web.service.d'
            directory.mkdir()
            legacy = directory / ('z' * 180 + '-release' * 8 + '.conf')
            legacy.write_text('[Service]\n')
            backup = base / 'rollback'
            backup.mkdir()

            record = release.install_managed_release_dropin(
                directory, Path('/releases/next/release.env'), backup, 'web')

            managed = Path(record['path'])
            self.assertGreater(managed.name, legacy.name)
            self.assertTrue(managed.is_file())
            self.assertEqual(legacy.read_text(), '[Service]\n')

    def test_newer_override_causes_abort_without_modification(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            directory = base / 'api.service.d'
            directory.mkdir()
            backup = base / 'rollback'
            backup.mkdir()
            record = release.install_managed_release_dropin(
                directory, Path('/releases/one/release.env'), backup, 'api')
            managed = Path(record['path'])
            prior = managed.read_bytes()
            (directory / 'zzzzzz-override.conf').write_text('[Service]\n')
            with self.assertRaisesRegex(RuntimeError, 'Newer systemd override'):
                release.install_managed_release_dropin(
                    directory, Path('/releases/two/release.env'), backup, 'api')
            self.assertEqual(prior, managed.read_bytes())

    def test_rollback_refuses_concurrent_change(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            directory = base / 'api.service.d'
            directory.mkdir()
            backup = base / 'rollback'
            backup.mkdir()
            record = release.install_managed_release_dropin(
                directory, Path('/releases/one/release.env'), backup, 'api')
            managed = Path(record['path'])
            managed.write_text('[Service]\nEnvironmentFile=/other/release.env\n')
            with self.assertRaisesRegex(RuntimeError, 'changed after activation'):
                release.restore_managed_release_dropin(record, backup, 'api')
            self.assertTrue(managed.exists())


if __name__ == '__main__':
    unittest.main()
