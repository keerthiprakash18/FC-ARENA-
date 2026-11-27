import contextlib
import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('signature_guard', ROOT/'FC_ARENA_SIGNATURE_GUARDED_DEPLOY.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class SignatureAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release, self.baseline, self.artifact = 'a'*40, 'b'*40, 'c'*64
        self.now = dt.datetime.now(dt.timezone.utc).isoformat()
        proof = self.root/'proof.json'
        proof.write_text('{"status":"PASS"}')
        self.evidence = {'status': 'PASS', 'release': self.release, 'artifactSha256': self.artifact,
            'verifiedAtUtc': self.now, 'gates': {gate: {'status': 'PASS', 'verifiedAtUtc': self.now,
            'evidenceFile': str(proof), 'evidenceSha256': guard.digest(proof)} for gate in guard.GATES}}
        self.path = self.root/'acceptance.json'
        self.path.write_text(json.dumps(self.evidence))

    def test_complete_evidence_is_required_and_bound_to_actual_bytes(self):
        self.assertEqual(guard.acceptance(self.evidence, self.release), self.artifact)
        (self.root/'proof.json').write_text('changed after review')
        with self.assertRaisesRegex(guard.Blocked, 'Evidence bytes changed'):
            guard.acceptance(self.evidence, self.release)

    def test_every_external_and_executable_gate_fails_closed(self):
        for gate in guard.GATES:
            with self.subTest(gate=gate):
                value = json.loads(json.dumps(self.evidence))
                value['gates'][gate]['status'] = 'NOT_AVAILABLE'
                with self.assertRaises(guard.Blocked):
                    guard.acceptance(value, self.release)

    def test_wrong_revision_and_stale_proof_fail(self):
        with self.assertRaises(guard.Blocked):
            guard.acceptance(self.evidence, self.baseline)
        for stamp in [(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=25)).isoformat(),
                      (dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=6)).isoformat(),
                      dt.datetime.now().isoformat()]:
            with self.subTest(stamp=stamp), self.assertRaises(guard.Blocked):
                guard.fresh(stamp)

    def owner_approval(self):
        value = {'approvedBy': 'owner', 'action': 'ACTIVATE_SIGNATURE_WEB_API',
            'release': self.release, 'baselineRelease': self.baseline, 'artifactSha256': self.artifact,
            'acceptanceSha256': guard.digest(self.path), 'approvedAtUtc': self.now}
        path = self.root/'owner.json'
        path.write_text(json.dumps(value))
        return path, value

    def test_owner_approval_binds_artifact_baseline_and_acceptance(self):
        path, value = self.owner_approval()
        guard.approval(path, self.path, self.release, self.artifact, self.baseline)
        for key, changed in [('approvedBy', 'agent'), ('action', 'PREFLIGHT'), ('release', self.baseline),
                             ('artifactSha256', 'd'*64), ('baselineRelease', self.release), ('acceptanceSha256', 'e'*64)]:
            with self.subTest(key=key):
                path.write_text(json.dumps({**value, key: changed}))
                with self.assertRaises(guard.Blocked):
                    guard.approval(path, self.path, self.release, self.artifact, self.baseline)

    def args(self, mode):
        return [mode, '--release', self.release, '--baseline', self.baseline,
                '--artifact-dir', str(self.root), '--build-run', '1', '--evidence', str(self.path),
                '--host', 'root@example.invalid', '--identity', str(self.root/'key'), '--managed-sha256', 'f'*64]

    def test_preflight_never_calls_activation_and_apply_needs_separate_approval(self):
        with patch.object(guard, 'verify_artifact', return_value={}), patch.object(guard, 'check_ci', return_value={}), \
             patch.object(guard, 'remote', return_value={'status': 'PASS'}) as remote, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(guard.main(self.args('--preflight')), 0)
            self.assertEqual(remote.call_count, 1)
            self.assertEqual(remote.call_args.args[1], guard.REMOTE_PREFLIGHT)
            remote.reset_mock()
            self.assertEqual(guard.main(self.args('--apply')), 2)
            self.assertEqual(remote.call_count, 1)
            self.assertEqual(remote.call_args.args[1], guard.REMOTE_PREFLIGHT)

    def test_apply_delegates_only_the_exact_approved_existing_runtime(self):
        path, _ = self.owner_approval()
        args = self.args('--apply')+['--owner-approval', str(path), '--runtime', '/opt/fcarena-deployments/signature-a/runtime']
        with patch.object(guard, 'verify_artifact', return_value={}), patch.object(guard, 'check_ci', return_value={}), \
             patch.object(guard, 'remote', return_value={'status': 'PASS'}) as remote, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(guard.main(args), 0)
            self.assertEqual(remote.call_count, 2)
            self.assertEqual(remote.call_args.args[1], guard.REMOTE_APPLY)
            self.assertEqual(remote.call_args.args[2]['release'], self.release)
            self.assertEqual(remote.call_args.args[2]['ownerApprovalSha256'], guard.digest(path))
            remote.reset_mock()
            args[-1] = '/opt/fcarena/storage/runtime'
            self.assertEqual(guard.main(args), 2)
            self.assertEqual(remote.call_count, 1)

    def test_failed_ci_cannot_reach_remote(self):
        with patch.object(guard, 'verify_artifact', return_value={}), \
             patch.object(guard, 'check_ci', side_effect=guard.Blocked('CI failed')), \
             patch.object(guard, 'remote') as remote, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(guard.main(self.args('--apply')), 2)
            remote.assert_not_called()

    def test_connection_loss_during_apply_never_claims_production_unchanged(self):
        path, _ = self.owner_approval()
        args = self.args('--apply')+['--owner-approval', str(path), '--runtime', '/opt/fcarena-deployments/signature-a/runtime']
        output = io.StringIO()
        with patch.object(guard, 'verify_artifact', return_value={}), patch.object(guard, 'check_ci', return_value={}), \
             patch.object(guard, 'remote', side_effect=[{'status': 'PASS'}, OSError('connection lost')]), contextlib.redirect_stdout(output):
            self.assertEqual(guard.main(args), 2)
        self.assertEqual(json.loads(output.getvalue())['productionActivated'], 'unknown')


if __name__ == '__main__':
    unittest.main()
