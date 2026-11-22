"""Exercise the operator restore script without Docker or production data."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "ops/backup/postgres-restore-verify.sh"
BASH = shutil.which("bash")
if os.name == "nt" and Path("C:/Program Files/Git/bin/bash.exe").is_file():
    BASH = "C:/Program Files/Git/bin/bash.exe"

DOCKER = r'''#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> docker-calls.txt
case "$*" in
  'image inspect '*) test "${FC_TEST_IMAGE_MISSING:-0}" = 0 ;;
  'run '*) echo disposable-container ;;
  *pg_isready*)
    # Model the real image: the temporary server answers sockets immediately.
    # The final TCP server needs another poll after that server shuts down.
    if [[ "$*" != *' -h 127.0.0.1 '* ]]; then exit 0; fi
    count=0
    [[ ! -f readiness-count ]] || count="$(cat readiness-count)"
    count=$((count + 1))
    printf '%s' "$count" > readiness-count
    (( count >= 2 )) ;;
  *pg_restore*)
    [[ -f readiness-count && "$(cat readiness-count)" -ge 2 ]] || exit 88
    [[ "$*" == *'--exit-on-error'* ]] || exit 89
    [[ "${FC_TEST_RESTORE_FAIL:-0}" = 0 ]] || exit 90 ;;
  *psql*information_schema*) echo 2 ;;
  *psql*) echo 1 ;;
  'rm -f '*) exit 0 ;;
  *) exit 91 ;;
esac
'''


@unittest.skipUnless(BASH, "bash is required for operator-script integration tests")
class TestRestoreReadiness(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fcarena-restore-fixture-")
        self.root = Path(self.temp.name)
        (self.root / "bin").mkdir()
        for name, contents in {"docker": DOCKER, "sleep": "#!/bin/sh\nexit 0\n"}.items():
            executable = self.root / "bin" / name
            executable.write_text(contents, encoding="utf-8", newline="\n")
            executable.chmod(0o755)
        (self.root / "compose.yml").write_text("# synthetic fixture only\n")
        self.backup = self.root / "fixture.dump"
        self.backup.write_bytes(b"synthetic archive: no production data")
        self.sidecar = self.backup.with_name("fixture.dump.sha256")
        self.sidecar.write_text(hashlib.sha256(self.backup.read_bytes()).hexdigest() + "  fixture.dump\n", newline="\n")

    def tearDown(self):
        self.temp.cleanup()

    def run_script(self, **overrides):
        env = dict(os.environ, FC_ARENA_COMPOSE_FILE="./compose.yml",
                   FC_ARENA_RESTORE_VERIFY_IMAGE="postgres:17")
        env.update(overrides)
        return subprocess.run(
            [BASH, "--noprofile", "--norc", "-c",
             'export PATH="$PWD/bin:$PATH"; exec bash "$1" ./fixture.dump',
             "fixture", SCRIPT.as_posix()],
            cwd=self.root, env=env, capture_output=True, text=True, timeout=20,
        )

    def calls(self):
        file = self.root / "docker-calls.txt"
        return file.read_text() if file.exists() else ""

    def test_waits_for_final_tcp_server_before_restore_and_cleans_up(self):
        outcome = self.run_script()
        self.assertEqual(outcome.returncode, 0, outcome.stdout + outcome.stderr)
        self.assertEqual((self.root / "readiness-count").read_text(), "2")
        self.assertIn("FC_ARENA_RESTORE_VERIFY_OK", outcome.stdout)
        calls = self.calls().splitlines()
        startup = next(line for line in calls if line.startswith("run "))
        for control in ["--network none", "--read-only", "--memory 512m",
                        "--memory-swap 512m", "--cpus 1", "--pids-limit 128",
                        "PGDATA=/var/lib/postgresql/fcarena-restore-data"]:
            self.assertIn(control, startup)
        for call in calls:
            if any(command in call for command in ["pg_restore", "psql", "pg_isready"]):
                self.assertIn("-h 127.0.0.1", call)
        self.assertTrue(calls[-1].startswith("rm -f fc-arena-restore-verify-"))

    def test_failed_restore_is_fatal_and_removes_only_disposable_container(self):
        outcome = self.run_script(FC_TEST_RESTORE_FAIL="1")
        self.assertNotEqual(outcome.returncode, 0)
        self.assertNotIn("FC_ARENA_RESTORE_VERIFY_OK", outcome.stdout)
        self.assertTrue(self.calls().splitlines()[-1].startswith("rm -f fc-arena-restore-verify-"))
        self.assertTrue(self.backup.is_file())

    def test_missing_checksum_refuses_restore_before_container_creation(self):
        self.sidecar.unlink()
        outcome = self.run_script()
        self.assertNotEqual(outcome.returncode, 0)
        self.assertIn("checksum sidecar is required", outcome.stderr)
        self.assertEqual(self.calls(), "")

    def test_missing_reviewed_image_never_pulls_or_starts_container(self):
        outcome = self.run_script(FC_TEST_IMAGE_MISSING="1")
        self.assertNotEqual(outcome.returncode, 0)
        self.assertNotIn("run ", self.calls())
        self.assertNotIn("pull ", self.calls())


if __name__ == "__main__":
    unittest.main()
