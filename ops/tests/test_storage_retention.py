import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('retention', Path(__file__).parents[1] / 'release/storage_retention.py')
R = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(R)


class RetentionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.releases = self.root / 'releases'
        self.artifacts = self.root / 'artifacts'
        self.releases.mkdir()
        self.artifacts.mkdir()

    def directory(self, name):
        path = self.releases / name
        path.mkdir(parents=True)
        (path / 'file').write_text('keep until approved')
        return path

    def archive(self):
        path = self.artifacts / ('a' * 40) / ('fcarena-runtime-' + 'a' * 40 + '.tar.gz')
        path.parent.mkdir()
        path.write_bytes(b'immutable archive')
        return path

    def items(self, protected=(), **kwargs):
        return R.candidates(self.releases, self.artifacts, protected, **kwargs)

    def report(self, paths):
        return R.seal({'current': {'release': 'a' * 40}, 'rollback': {'release': 'b' * 40},
                       'candidates': [dict(i, fingerprint=R.fingerprint(i['path']), bytes=10,
                                           **({'sha256': R.digest(i['path'])} if i['kind'] == 'downloaded-archive' else {})) for i in paths]})

    def test_protected_current_rollback_and_config_references(self):
        for name in ('current', 'rollback', 'config', 'unused'):
            self.directory(name + '/runtime/node_modules')
        self.assertEqual([i['path'] for i in self.items({'current', 'rollback', 'config'})],
                         [str(self.releases / 'unused/runtime/node_modules')])

    def test_sources_media_env_and_backups_are_never_candidates(self):
        for name in ('source/src', 'runtime/apps/web/.next/server', 'storage', 'uploads', 'backups'):
            self.directory('old/' + name)
        (self.releases / 'old/release.env').write_text('private')
        self.assertEqual(self.items(), [])

    def test_mount_and_open_descriptor_exclude_directory(self):
        path = self.directory('old/runtime/node_modules')
        self.assertEqual(self.items(mounts={path / 'nested'}), [])
        self.assertEqual(self.items(opened={str(path / 'file')}), [])

    def test_open_archive_excluded(self):
        path = self.archive()
        self.assertEqual(self.items(opened={str(path)}), [])

    @unittest.skipIf(__import__('os').name == 'nt', 'Symlink privilege not assumed on Windows; Linux CI covers this')
    def test_parent_symlinks_rejected_even_inside_release(self):
        target = self.directory('old/real/node_modules')
        (target.parent.parent / 'runtime').symlink_to(target.parent, target_is_directory=True)
        self.assertEqual(self.items(), [])
        archive = self.archive()
        external = self.root / 'linked-artifacts'
        external.symlink_to(self.artifacts, target_is_directory=True)
        self.assertEqual(R.candidates(self.releases, external, ()), [])
        self.assertTrue(archive.exists())

    def run_apply(self, report, fresh=None, receipt=None):
        def read(path):
            return report if path == 'plan' else receipt
        with patch.object(R, 'private_json', side_effect=read), patch.object(R, 'plan', return_value=fresh or report), \
             patch.object(R, 'healthy'), patch.object(R, 'RELEASES', self.releases):
            return R.apply('plan', report['planId'], 'receipt' if receipt is not None else None)

    def test_valid_batch_preserves_release_source_and_user_files(self):
        path = self.directory('old/runtime/node_modules')
        kept = self.directory('old/storage')
        result = self.run_apply(self.report(self.items()))
        self.assertFalse(path.exists())
        self.assertTrue((kept / 'file').exists())
        self.assertEqual(result['removedDirectories'], 1)

    def test_stale_candidate_refuses_entire_batch_before_delete(self):
        first = self.directory('one/runtime/node_modules')
        second = self.directory('two/runtime/node_modules')
        report = self.report(self.items())
        fresh = copy.deepcopy(report)
        fresh['candidates'].pop()
        with self.assertRaisesRegex(ValueError, 'referenced candidate'):
            self.run_apply(report, fresh)
        self.assertTrue(first.exists() and second.exists())

    def test_changed_current_or_rollback_refused(self):
        path = self.directory('old/runtime/node_modules')
        report = self.report(self.items())
        fresh = copy.deepcopy(report)
        fresh['rollback']['release'] = 'c' * 40
        with self.assertRaisesRegex(ValueError, 'Live/rollback changed'):
            self.run_apply(report, fresh)
        self.assertTrue(path.exists())

    def test_tampered_plan_refused(self):
        path = self.directory('old/runtime/node_modules')
        report = self.report(self.items())
        report['candidates'][0]['bytes'] += 1
        with self.assertRaisesRegex(ValueError, 'Plan hash invalid'):
            self.run_apply(report)
        self.assertTrue(path.exists())

    def test_archive_without_pc_receipt_refuses_whole_batch(self):
        path = self.directory('old/runtime/node_modules')
        archive = self.archive()
        with self.assertRaisesRegex(ValueError, 'private PC archive'):
            self.run_apply(self.report(self.items()))
        self.assertTrue(path.exists() and archive.exists())

    def test_matching_pc_receipt_allows_only_exact_archive(self):
        archive = self.archive()
        receipt = {'files': [{'source': str(archive), 'sha256': R.digest(archive), 'verified': True}]}
        result = self.run_apply(self.report(self.items()), receipt=receipt)
        self.assertFalse(archive.exists())
        self.assertEqual(result['removedArchives'], 1)

    def test_policy_requires_approval_age_budget_and_archive_receipt(self):
        self.directory('old/runtime/node_modules')
        self.archive()
        report = self.report(self.items())
        policy = {'approvedBy': 'owner', 'scope': 'unreferenced-packages-cache-and-pc-verified-archives-v1',
                  'minimumAgeHours': 24, 'maxCycleGiB': 10}
        self.assertEqual(R.select_policy(report, policy, {'files': []})['candidates'], [])
        selected = R.select_policy(report, policy, {'files': []}, now=time.time() + 90000)
        self.assertEqual(len(selected['candidates']), 1)
        policy['approvedBy'] = 'automation'
        with self.assertRaisesRegex(ValueError, 'owner policy'):
            R.select_policy(report, policy, {'files': []})
        policy['approvedBy'] = 'owner'
        policy['maxCycleGiB'] = 0.000000001
        with self.assertRaisesRegex(ValueError, 'budget'):
            R.select_policy(report, policy, {'files': []}, now=time.time() + 90000)

    def test_policy_does_not_trust_stale_pc_escrow_receipt(self):
        archive = self.archive()
        report = self.report(self.items())
        now = time.time() + 90000
        policy = {'approvedBy': 'owner', 'scope': 'unreferenced-packages-cache-and-pc-verified-archives-v1',
                  'minimumAgeHours': 24, 'maxCycleGiB': 10}
        entry = {'source': str(archive), 'sha256': R.digest(archive), 'verified': True,
                 'verifiedAt': R.dt.datetime.fromtimestamp(now - 49 * 3600, R.dt.timezone.utc).isoformat()}
        self.assertEqual(R.select_policy(report, policy, {'files': [entry]}, now)['candidates'], [])
        entry['verifiedAt'] = R.dt.datetime.fromtimestamp(now, R.dt.timezone.utc).isoformat()
        self.assertEqual(len(R.select_policy(report, policy, {'files': [entry]}, now)['candidates']), 1)
        entry['verifiedAt'] = R.dt.datetime.fromtimestamp(now + 301, R.dt.timezone.utc).isoformat()
        self.assertEqual(R.select_policy(report, policy, {'files': [entry]}, now)['candidates'], [])


if __name__ == '__main__':
    unittest.main()
