const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('apps/web/next.config.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function deploymentId(env) {
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env } });
  return exports.default.deploymentId;
}

test('caps a 40-character Vercel commit SHA at Next.js deploymentId limit', () => {
  const sha = '5378d1ddb9d8bf019e468f920ab5d392e8f76635';
  assert.equal(deploymentId({ VERCEL_GIT_COMMIT_SHA: sha }), sha.slice(0, 32));
});

test('caps an explicit deployment ID at 32 characters', () => {
  assert.equal(deploymentId({ NEXT_DEPLOYMENT_ID: 'x'.repeat(45) }), 'x'.repeat(32));
});

test('preserves short IDs and leaves the ID unset without deployment metadata', () => {
  assert.equal(deploymentId({ NEXT_DEPLOYMENT_ID: 'preview-build-123' }), 'preview-build-123');
  assert.equal(deploymentId({}), undefined);
});
