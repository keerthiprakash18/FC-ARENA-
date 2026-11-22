import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { assertRunnerPlatform, verifyPackagedPaths } from '../ops/verify-offhost-vcl-native-runtime.mjs';

test('accept VCL target Linux x86_64 Node24 glibc2.39 only', () => {
  assert.doesNotThrow(() => assertRunnerPlatform({ platform: 'linux', arch: 'x64', major: 24, glibc: '2.39' }));
  for (const override of [{ platform: 'win32' }, { arch: 'arm64' }, { major: 22 }, { glibc: '2.40' }]) {
    assert.throws(() => assertRunnerPlatform({ platform: 'linux', arch: 'x64', major: 24, glibc: '2.39', ...override }));
  }
});

test('refuses missing compiled runtime files in isolated bundle', () => {
  const root = path.resolve('/tmp/fcarena-fixture');
  const required = ['package.json', 'package-lock.json', 'apps/web/.next/BUILD_ID', 'apps/api/dist/main.js'];
  const exists = filename => required.some(relative => filename === path.join(root, relative));
  assert.doesNotThrow(() => verifyPackagedPaths(root, exists));
  for (const missing of required) {
    assert.throws(() => verifyPackagedPaths(root, filename => exists(filename) && filename !== path.join(root, missing)));
  }
});
