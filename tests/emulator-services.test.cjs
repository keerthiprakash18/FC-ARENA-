const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function run(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-emulator-settle-'));
  try {
    fs.writeFileSync(path.join(dir, 'clock'), '0');
    const scripts = {
      date: 'cat "$TEST_CLOCK"',
      sleep: 'n=$(cat "$TEST_CLOCK"); echo $((n + 5)) > "$TEST_CLOCK"',
      adb: 'n=$(cat "$TEST_CLOCK"); case "$TEST_MODE" in missing) exit 1;; restart) if (( n < 170 )); then echo 111; else echo 222; fi;; unstable) echo "$n";; stable) echo 111;; esac',
    };
    for (const [name, body] of Object.entries(scripts)) fs.writeFileSync(path.join(dir, name), '#!/bin/bash\n'+body+'\n', { mode: 0o755 });
    return spawnSync('bash', ['apps/android/tests/wait-for-emulator-services.sh'], { encoding: 'utf8', env: { ...process.env, PATH: dir+path.delimiter+process.env.PATH, TEST_CLOCK: path.join(dir,'clock'), TEST_MODE: mode } });
  } finally { fs.rmSync(dir,{ recursive:true,force:true }); }
}
test('waits for initial boot grace even when GMS is initially present', () => {
  const result=run('stable'); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/after 180s/);
});
test('a late provider restart resets the stability window', () => {
  const result=run('restart'); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/after 230s; process stable for 60s/);
});
test('missing or repeatedly restarting services fail instead of skipping app tests', () => {
  for (const mode of ['missing','unstable']) { const result=run(mode); assert.equal(result.status,1); assert.match(result.stderr,/refusing to start app tests/); }
});
