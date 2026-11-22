import importlib.util
from pathlib import Path
import unittest

path=Path(__file__).resolve().parents[1]/'release/managed_runtime.py'
spec=importlib.util.spec_from_file_location('managed_runtime',path)
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)

class ManagedRuntimeTests(unittest.TestCase):
    def test_rollback_preserves_long_override_under_short_disabled_name(self):
        target=Path('/etc/systemd/system/fcarena-web.service.d')/('z'*235+'-managed.conf')
        disabled=runtime.disabled_override_path(target,1)
        self.assertEqual(disabled.parent,target.parent)
        self.assertLess(len(disabled.name),100)
        self.assertTrue(disabled.name.endswith('.disabled'))
    def test_reload_verification_waits_for_both_replicas_and_never_accepts_only_primary(self):
        from unittest.mock import Mock
        def response(instance):return {'data':{'runtime':{'release':'sha','instance':instance}}}
        probe=Mock(side_effect=[response('api-primary')]*15+[response('api-secondary')])
        self.assertEqual(runtime.verify_public_replicas('sha',probe,lambda _:None),{'api-primary','api-secondary'})
        with self.assertRaises(AssertionError):runtime.verify_public_replicas('sha',lambda:response('api-primary'),lambda _:None)
    def test_override_fits_actual_long_legacy_filenames_and_sorts_last(self):
        old=['z'*227+'-birthday-v6-alignment.conf','z'*228+'-audit-c2dcf148fae8.conf']
        name=runtime.managed_override_name(old)
        self.assertLessEqual(len(name),255)
        self.assertTrue(all(name>prior for prior in old))
    def test_environment_preserves_literal_secrets_without_shell_expansion(self):
        encoded=runtime.encode_environment({'PRIVATE_KEY':'line1\nline2', 'VALUE':'$HOME `id` "quote" \\path', 'INVOCATION_ID':'omit'})
        self.assertIn('PRIVATE_KEY="line1\nline2"',encoded)
        self.assertIn('$HOME `id` \\"quote\\" \\\\path',encoded)
        self.assertNotIn('INVOCATION_ID',encoded)
        with self.assertRaises(AssertionError):runtime.encode_environment({'BAD\nNAME':'value'})
    def test_proxy_preserves_routes_and_does_not_replay_accepted_writes(self):
        old='location /api/ { proxy_pass http://127.0.0.1:4000; proxy_connect_timeout 60s; proxy_read_timeout 120s; }'
        new=runtime.proxy_changes(Path('fcarena-api'),old)
        self.assertIn('proxy_pass http://fcarena_api_runtime;',new)
        self.assertIn('proxy_connect_timeout 2s;',new)
        self.assertIn('proxy_read_timeout 120s;',new)
        self.assertNotIn('non_idempotent',new+runtime.UPSTREAMS)
        self.assertIn('127.0.0.1:4001',runtime.UPSTREAMS)
        self.assertIn('127.0.0.1:3001',runtime.UPSTREAMS)
    def test_instances_have_bounded_memory_and_stable_api_storage(self):
        api=runtime.service('api','secondary',Path('/opt/runtime/apps/web/.next/cache'))
        self.assertIn('WorkingDirectory=/opt/fcarena/apps/api',api)
        self.assertIn('MemoryMax=1280M',api)
        self.assertIn('Slice=fcarena-app.slice',api)
        self.assertIn('User=fcarena-api',api)
        self.assertIn('OCR_WORKER_ENABLED',runtime.SECONDARY_FLAGS)
        self.assertIn('PUSH_ENABLED',runtime.SECONDARY_FLAGS)

if __name__=='__main__':unittest.main()
