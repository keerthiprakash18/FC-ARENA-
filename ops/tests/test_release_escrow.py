import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import os
import json
import contextlib
import io

SPEC = importlib.util.spec_from_file_location('escrow_release', Path(__file__).parents[1] / 'release/release_escrow.py')
R = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(R)


class ReleaseEscrowTests(unittest.TestCase):
    def test_fingerprint_detects_added_removed_and_modified_files(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw)
            file = path / 'release.env'
            file.write_text('keep')
            first = R.tree_fingerprint(path)
            file.write_text('changed')
            self.assertNotEqual(first, R.tree_fingerprint(path))
            changed = R.tree_fingerprint(path)
            (path / 'uploads').mkdir()
            self.assertNotEqual(changed, R.tree_fingerprint(path))

    @unittest.skipIf(__import__('os').name == 'nt', 'Linux symlinks tested on target OS')
    def test_fingerprint_records_links_without_following_external_user_data(self):
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            root = base / 'release'
            root.mkdir()
            data = base / 'uploads'
            data.mkdir()
            (root / 'uploads').symlink_to(data, target_is_directory=True)
            first = R.tree_fingerprint(root)
            (data / 'user-image').write_bytes(b'protected')
            self.assertEqual(first, R.tree_fingerprint(root))
            self.assertEqual(first['entries'], 2)

    def test_changed_or_missing_offhost_receipt_prevents_deletion(self):
        streamed = {'planId': 'a' * 64, 'sha256': 'b' * 64, 'bytes': 100}
        receipt = dict(streamed, sha256='c' * 64, verified=True)
        guard = Mock()
        guard.private_json.side_effect = [streamed, receipt]
        with patch.object(R.shutil, 'rmtree') as remove:
            with self.assertRaisesRegex(ValueError, 'archive mismatch'):
                R.apply(guard, 'a' * 64)
            remove.assert_not_called()

    def test_names_cannot_escape_the_release_root(self):
        for name in ('../uploads', '/var/lib/postgresql', 'a/b', '.', '..', '-flag'):
            self.assertFalse(R.NAME.fullmatch(name))
        self.assertTrue(R.NAME.fullmatch('audit-20261123-48f171acaa8e'))

    def test_automatic_plan_is_bounded_and_requires_standing_owner_policy(self):
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            root = base / 'releases'
            root.mkdir()
            for index in range(12):
                path = root / ('release-' + str(index))
                path.mkdir()
                os.utime(path, (1, 1))
            guard = Mock()
            guard.private_json.return_value = {'approvedBy': 'owner',
                'scope': 'pc-verified-unreferenced-release-roots-v1', 'minimumAgeHours': 24, 'maxCycleGiB': 10}
            output = io.StringIO()
            with patch.object(R, 'AUTOMATIC', True), patch.object(R, 'ROOT', root), \
                 patch.object(R, 'STATE', base / 'state'), \
                 patch.object(R, 'admission', return_value=({}, {'release': 'a'}, {'release': 'b'})), \
                 patch.object(R.subprocess, 'check_output', return_value=b'1073741824\tpath\n'), \
                 contextlib.redirect_stdout(output):
                R.prepare(guard)
            saved = guard.save.call_args.args[1]
            self.assertEqual(len(saved['releases']), 10)
            self.assertEqual(json.loads(output.getvalue())['releaseCount'], 10)
            guard.private_json.return_value['approvedBy'] = 'automation'
            with patch.object(R, 'AUTOMATIC', True), \
                 patch.object(R, 'admission', return_value=({}, {}, {})):
                with self.assertRaisesRegex(ValueError, 'Standing owner'):
                    R.prepare(guard)

    def test_legacy_inventory_protects_config_process_and_external_link_references(self):
        real_path = Path
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            root = base / 'legacy-releases'
            root.mkdir()
            for name in ('configured', 'running', 'linked', 'unused'):
                (root / name).mkdir()
            config = base / 'config'
            config.mkdir()
            (config / 'legacy.conf').write_text(str(root / 'configured/runtime'))
            guard = Mock()
            guard.CONFIG_ROOTS = [str(config)]
            guard.process_paths.return_value = {str(root / 'running/main.js')}
            guard.mount_paths.return_value = set()
            proc = Mock()
            proc.iterdir.return_value = []
            def path(value):
                return proc if str(value) == '/proc' else real_path(value)
            links = (str(base / 'external-link') + '\t' + str(root / 'linked/runtime') + '\0').encode()
            with patch.object(R, 'Path', side_effect=path), \
                 patch.object(R.subprocess, 'check_output', return_value=links):
                refs = R.legacy_references(guard, root)
            self.assertEqual(set(refs), {'configured', 'running', 'linked'})

    def test_plan_cannot_be_replayed_against_another_storage_root(self):
        report = {'root': '/opt/fcarena-staging', 'releases': [{'name': 'old'}]}
        report['planId'] = R.digest_json(report)
        guard = Mock()
        guard.private_json.return_value = report
        with patch.object(R, 'ROOT', Path('/opt/fcarena-releases')):
            with self.assertRaisesRegex(ValueError, 'another deployment root'):
                R.reviewed(guard, report['planId'])

    def test_database_reference_scan_is_limited_to_the_selected_root(self):
        raw = b'/opt/fcarena-releases/keep/uploads/a /opt/fcarena-deployments/other/source'
        with patch.object(R, 'ROOT', Path('/opt/fcarena-releases')), \
             patch.object(R.subprocess, 'check_output', return_value=raw):
            self.assertEqual(R.database_references(), {b'keep'})


if __name__ == '__main__':
    unittest.main()
