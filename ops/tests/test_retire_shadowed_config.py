import importlib.util
from pathlib import Path
import unittest
import tempfile

SPEC = importlib.util.spec_from_file_location('retire', Path(__file__).parents[1] / 'release/retire_shadowed_config.py')
R = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(R)


class ShadowedConfigTests(unittest.TestCase):
    def test_preserves_security_inline_environment_and_writable_paths(self):
        text = ('[Service]\nEnvironment=FEATURE=true\nEnvironmentFile=/old/release.env\n'
                'ExecStart=\nExecStart=/old/node main.js\nWorkingDirectory=/old\n'
                'ProtectSystem=strict\nReadWritePaths=/persistent/uploads\n')
        self.assertEqual(R.strip_shadowed(text), '[Service]\nEnvironment=FEATURE=true\n'
                         'ProtectSystem=strict\nReadWritePaths=/persistent/uploads\n')

    def test_removes_entire_continuation_and_only_service_directives(self):
        text = ('[Service]\nExecStart=/usr/bin/node \\\n+ /old/main.js\n# Keep comment\n[Unit]\nEnvironmentFile=keep\n')
        self.assertEqual(R.strip_shadowed(text), '[Service]\n# Keep comment\n[Unit]\nEnvironmentFile=keep\n')

    def test_preserves_unknown_sections_and_similarly_named_directives(self):
        text = '[Service]\nExecStartPre=/safe/check\nUnsetEnvironment=TOKEN\n[Install]\nWantedBy=multi-user.target\n'
        self.assertEqual(R.strip_shadowed(text), text)

    @unittest.skipIf(__import__('os').name == 'nt', 'Linux filename boundary checked on target OS')
    def test_atomic_replacement_supports_long_historical_names(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / ('z' * 238 + '.conf')
            path.write_bytes(b'original')
            R.replace(path, b'updated', 0o600)
            self.assertEqual(path.read_bytes(), b'updated')

    def test_ignores_only_invocation_metadata_and_keeps_command_and_pid(self):
        first = 'ExecStart={ path=/node ; argv[]=/node /live/main.js ; ignore_errors=no ; start_time=yesterday ; pid=5 ; status=0 }\nMainPID=5\n'
        reloaded = first.replace('yesterday', '[n/a]')
        self.assertEqual(R.stable_properties(first), R.stable_properties(reloaded))
        self.assertNotEqual(R.stable_properties(first), R.stable_properties(first.replace('/live/', '/other/')))
        self.assertNotEqual(R.stable_properties(first), R.stable_properties(first.replace('MainPID=5', 'MainPID=6')))


if __name__ == '__main__':
    unittest.main()
