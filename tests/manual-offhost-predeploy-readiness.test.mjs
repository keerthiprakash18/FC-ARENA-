import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const workflow = fs.readFileSync(new URL('../.github/workflows/manual-offhost-predeploy-readiness.yml', import.meta.url), 'utf8');

test('candidate verifier never runs automatically against production', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /needs: contract/);
  assert.match(workflow, /cancel-in-progress: false/);
});
test('only read-only GitHub and public-health capabilities exist', () => {
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /permissions:[\s\S]*?contents: write/);
  for (const prohibited of [/(?:^|\s)ssh(?:\.exe)?\s/im, /\bscp\s/im, /\brsync\s/im,
    /\bsystemctl\s/im, /\bpg_restore\s/im, /\bpg_dump\s/im,
    /\bdocker\s+(?:exec|run)\s/im, /\brm\s+-rf\s/im]) {
    assert.doesNotMatch(workflow, prohibited);
  }
  assert.match(workflow, /DEPLOYMENT_EXECUTED=NO DEPLOYMENT_AUTHORIZED=NO/);
});
test('validate both source provenance and packaged bytes before readiness', () => {
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /\[\.head_sha, \.name, \.conclusion\]/);
  assert.match(workflow, /FC ARENA - Off-host production build artifact\|success/);
  assert.match(workflow, /actions\/download-artifact@v4/);
  assert.match(workflow, /--output-dir candidate-artifact --release "\$CANDIDATE_SHA"/);
  assert.match(workflow, /node scripts\/verify-live-baseline\.mjs/);
});
