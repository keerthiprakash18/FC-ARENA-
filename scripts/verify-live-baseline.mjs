/**
 * Fail-closed pre-deployment check against the actual FC ARENA releases.
 * Read-only: it never changes the VPS, database or tournament state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_SHA = /^[0-9a-f]{40}$/i;
const DEFAULT_WEB_URL = 'https://fcarena.in/web-release';
const DEFAULT_API_URL = 'https://api.fcarena.in/api/health';
const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readExpectedReleases(manifestPath = path.join(SCRIPT_ROOT, 'LIVE-SOURCE-MANIFEST.json'), env = process.env) {
  // CI/release operators can pin both identities when a selective manifest
  // is not committed to GitHub.
  if (env.FC_ARENA_EXPECTED_WEB_RELEASE && env.FC_ARENA_EXPECTED_API_RELEASE) {
    const web = env.FC_ARENA_EXPECTED_WEB_RELEASE.trim();
    const api = env.FC_ARENA_EXPECTED_API_RELEASE.trim();
    if (!RELEASE_SHA.test(web) || !RELEASE_SHA.test(api)) {
      throw new Error('Explicit expected web and API release SHAs must both be valid.');
    }
    return { web, api };
  }
  if (env.FC_ARENA_EXPECTED_WEB_RELEASE || env.FC_ARENA_EXPECTED_API_RELEASE) {
    throw new Error('Both expected release environment variables are required together.');
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read live-source manifest: ${error.message}`);
  }
  const { web, api } = manifest?.release ?? {};
  if (!RELEASE_SHA.test(web ?? '') || !RELEASE_SHA.test(api ?? '')) {
    throw new Error('Manifest must contain valid 40-character web and API release SHAs.');
  }
  return { web, api };
}

export async function verifyLiveBaseline({
  expected,
  fetchImpl = globalThis.fetch,
  webUrl = DEFAULT_WEB_URL,
  apiUrl = DEFAULT_API_URL,
  timeoutMs = 6000,
} = {}) {
  if (!expected || !RELEASE_SHA.test(expected.web ?? '') || !RELEASE_SHA.test(expected.api ?? '')) {
    throw new Error('Expected web and API releases must be valid 40-character SHAs.');
  }
  for (const [name, value, host] of [
    ['Web', webUrl, 'fcarena.in'],
    ['API', apiUrl, 'api.fcarena.in'],
  ]) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password) {
      throw new Error(`${name} check must use the canonical FC ARENA HTTPS host.`);
    }
  }
  async function readJson(url) {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Health endpoint HTTP ${response.status}: ${url}`);
    return response.json();
  }
  const [web, api] = await Promise.all([readJson(webUrl), readJson(apiUrl)]);
  const webRelease = web?.release;
  const apiRelease = api?.data?.runtime?.release;
  if (!RELEASE_SHA.test(webRelease ?? '') || !RELEASE_SHA.test(apiRelease ?? '')) {
    throw new Error('Missing or invalid live release SHA; deployment is blocked.');
  }
  if (api?.success !== true || !['healthy', 'degraded'].includes(api?.data?.status)
      || api?.data?.database !== 'connected') {
    throw new Error('API readiness check did not confirm a usable database.');
  }
  if (webRelease !== expected.web || apiRelease !== expected.api) {
    throw new Error(
      `Release drift detected. Web expected=${expected.web} live=${webRelease}; ` +
      `API expected=${expected.api} live=${apiRelease}. Reconcile the source before deploying.`,
    );
  }
  return { web: webRelease, api: apiRelease, apiStatus: api.data.status };
}

async function main() {
  const expected = readExpectedReleases();
  const found = await verifyLiveBaseline({ expected });
  console.log('FC_ARENA_LIVE_BASELINE=PASS');
  console.log(`web=${found.web} api=${found.api} status=${found.apiStatus}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`FC_ARENA_LIVE_BASELINE=BLOCKED: ${error.message}`);
    process.exitCode = 1;
  });
}
