import importlib.util
from pathlib import Path
import unittest

path=Path(__file__).resolve().parents[1]/'release/managed_runtime.py'
spec=importlib.util.spec_from_file_location('managed_runtime',path)
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)

class ManagedRuntimeTests(unittest.TestCase):
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
