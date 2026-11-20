#!/usr/bin/env node
/**
 * Offline native dependency smoke on the EXACT unpacked GitHub runtime bundle.
 * This script runs only on an Ubuntu 24.04 GitHub Actions runner (temporary
 * directory), without network, production secrets, API boot, or DB access.
 *
 * Passing does not prove VCL-specific runtime wiring, credentials or user data.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export function assertRunnerPlatform({ platform, arch, major, glibc }) {
  assert.equal(platform, 'linux', 'VCL runner smoke requires Linux');
  assert.equal(arch, 'x64', 'VCL runner smoke requires x86_64');
  assert.equal(major, 24, 'VCL production currently runs Node.js 24');
  assert.equal(glibc, '2.39', 'VCL production currently uses glibc 2.39');
}

export function verifyPackagedPaths(root, exists = existsSync) {
  for (const file of ['package.json', 'package-lock.json', 'apps/web/.next/BUILD_ID']) {
    assert.ok(exists(path.join(root, file)), 'Missing runtime component: ' + file);
  }
  assert.ok(exists(path.join(root, 'apps/api/dist/main.js')) ||
    exists(path.join(root, 'apps/api/dist/main')), 'Missing API entrypoint');
}

async function main() {
  const root = process.argv[2];
  if (!root || !path.isAbsolute(root)) {
    throw new Error('Pass absolute extracted bundle root');
  }
  const report = process.report.getReport().header;
  assertRunnerPlatform({
    platform: process.platform,
    arch: process.arch,
    major: Number(process.versions.node.split('.')[0]),
    glibc: report.glibcVersionRuntime,
  });
  verifyPackagedPaths(root);
  const requireBundle = createRequire(path.join(root, 'package.json'));
  // Test shipped native image processing, not the repo's installed packages.
  const sharp = requireBundle('sharp');
  const output = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer();
  assert.ok(output.length > 20, 'Packaged native sharp unable to encode');

  // Next's Linux x64 GNU native compiler must load on target-matching runner.
  const swc = requireBundle('@next/swc-linux-x64-gnu');
  assert.ok(swc && typeof swc === 'object' && Object.keys(swc).length,
    'Packaged Next.js native SWC not loadable');
  for (const spec of ['next', '@prisma/client', '@prisma/adapter-pg']) {
    assert.ok(requireBundle.resolve(spec).startsWith(root + path.sep),
      'Runtime dependency resolves outside isolated bundle: ' + spec);
  }
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'fc-arena');
  console.log('FC_ARENA_PACKAGED_UBUNTU24_NODE24_GLIBC239_NATIVE_SMOKE=PASS');
  console.log('PRODUCTION_DB_OR_SERVICES_CONTACTED=NO');
  console.log('VCL_ACTIVATION_AUTHORIZED=NO');
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error('FC_ARENA_PACKAGED_RUNTIME_SMOKE=BLOCKED: ' + error.message);
    process.exitCode = 1;
  });
}
