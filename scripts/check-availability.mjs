import { appendFileSync } from 'node:fs';

const DEFAULT_WEB_URL = 'https://fcarena.in';
const DEFAULT_API_URL = 'https://api.fcarena.in/api/health';

function failureCode(error) {
  const code = error?.cause?.code ?? error?.code;
  if (error?.name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT') return 'CONNECTION_TIMEOUT';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_LOOKUP_FAILED';
  if (code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  if (/CERT|TLS|SSL/.test(code ?? '')) return 'TLS_ERROR';
  return 'CONNECTION_FAILED';
}

// Public release identifiers are optional monitoring evidence, not authorization.
function releaseSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) ? value : null;
}

function requireHealthy(payload) {
  const data = payload?.data;
  if (payload?.success !== true || !['healthy', 'degraded'].includes(data?.status)
      || data?.api !== 'connected' || data?.database !== 'connected' || data?.redis !== 'connected') {
    throw new Error('API, database and Redis must report connected with a healthy or degraded status.');
  }
}

// Read-only probes. No authentication, production writes, restarts or automatic failover.
export async function checkAvailability({
  webUrl = DEFAULT_WEB_URL,
  apiUrl = DEFAULT_API_URL,
  timeoutMs = 10_000,
  fetcher = fetch,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new Error('timeoutMs must be an integer from 1 to 30000.');
  }
  const web = new URL(webUrl);
  const api = new URL(apiUrl);
  for (const url of [web, api]) {
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Probe URLs must use HTTP(S) without embedded credentials.');
    }
  }
  const checks = [];
  const releaseChecks = [];
  const observed = { web: null, directApi: null, sameOriginApi: null };
  const assets = new Map();
  const backupProbes = new Set();
  const overallDeadline = AbortSignal.timeout(90_000);

  async function probe(name, url, validate, method = 'GET', results = checks) {
    const started = performance.now();
    let response;
    try {
      response = await fetcher(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.any([overallDeadline, AbortSignal.timeout(timeoutMs)]),
        headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'FC-Arena-Availability/1.0' },
      });
      if (!response.ok) {
        await response.body?.cancel();
        results.push({ name, url: String(url), ok: false, status: response.status, code: 'HTTP_ERROR' });
        return;
      }
      await validate(response);
      results.push({ name, url: String(url), ok: true, status: response.status,
        durationMs: Math.round(performance.now() - started) });
    } catch (error) {
      const timedOut = ['TimeoutError', 'AbortError'].includes(error?.name);
      results.push({ name, url: String(url), ok: false, status: response?.status ?? null,
        code: timedOut ? 'CONNECTION_TIMEOUT' : response ? 'INVALID_RESPONSE' : failureCode(error),
        message: response && !timedOut ? error.message : 'Endpoint could not be reached within the probe deadline.' });
    }
  }

  async function page(response) {
    if (!response.headers.get('content-type')?.includes('text/html')) {
      await response.body?.cancel();
      throw new Error('Expected the application HTML document.');
    }
    const html = await response.text();
    const documentUrl = new URL(response.url || web);
    if (documentUrl.origin !== web.origin) throw new Error('Application redirected to another origin.');
    const found = new Map();
    let hasScript = false;
    for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      const attribute = tag[0].match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i);
      if (!attribute) continue;
      const asset = new URL(attribute[1].replaceAll('&amp;', '&'), documentUrl);
      if (asset.origin !== web.origin || !asset.pathname.startsWith('/_next/static/')) continue;
      if (!/\.(?:js|css)$/.test(asset.pathname)) continue;
      if (/^<script\b/i.test(tag[0]) && asset.pathname.endsWith('.js')) hasScript = true;
      found.set(asset.href, asset);
    }
    if (!hasScript) throw new Error('Application JavaScript is missing; a generic HTTP 200 page is insufficient.');
    if (new Set([...assets.keys(), ...found.keys()]).size > 128) throw new Error('Unexpectedly many application assets.');
    for (const [key, value] of found) assets.set(key, value);
  }

  // Collect every boundary even when the host is down, so a web-only failure is visible.
  await Promise.all([
    probe('web-home', new URL('/', web), page),
    probe('android-start-page', new URL('/dashboard', web), page),
    probe('same-origin-api', new URL('/api/health', web), async response => {
      const body=await response.json();requireHealthy(body);
      if (new URL(response.url || web).origin === web.origin)
        observed.sameOriginApi = releaseSha(body.data.runtime?.release);
      if(body.data.backupMonitoring==='enabled')backupProbes.add(new URL('/api/health/backups',web).href);
    }),
    probe('direct-api', api, async response => {
      const body=await response.json();requireHealthy(body);
      if (new URL(response.url || api).origin === api.origin)
        observed.directApi = releaseSha(body.data.runtime?.release);
      if(body.data.backupMonitoring==='enabled')backupProbes.add(new URL('/api/health/backups',api).href);
    }),
    probe('web-release-observation', new URL('/web-release', web), async response => {
      if (new URL(response.url || web).origin !== web.origin)
        throw new Error('Release endpoint redirected to another origin.');
      let body;
      try { body = await response.json(); }
      catch { throw new Error('Release endpoint did not return valid JSON.'); }
      const sha = releaseSha(body?.release);
      if (!sha) throw new Error('No valid public web release identifier.');
      observed.web = sha;
    }, 'GET', releaseChecks),
  ]);
  await Promise.all([...backupProbes].map(url=>probe('encrypted-recovery',url,async response=>{
    const body=await response.json();
    if(body.success!==true||body.data?.configured!==true||body.data?.status!=='healthy'||body.data?.encrypted!==true)
      throw Error('Encrypted off-host backup and recovery proof must be fresh.');
  })));
  // Verify the exact chunk URLs in the documents; stale/missing deploy assets cause blank screens.
  const urls = [...assets.values()];
  for (let offset = 0; offset < urls.length; offset += 4) {
    await Promise.all(urls.slice(offset, offset + 4).map(url => probe('web-asset', url, async response => {
      const type = response.headers.get('content-type') ?? '';
      const expected = url.pathname.endsWith('.css') ? /text\/css/i : /(?:java|ecma)script/i;
      if (!expected.test(type)) throw new Error('Asset has the wrong content type; it may be an HTML fallback.');
    }, 'HEAD')));
  }
  checks.sort((left, right) => left.name.localeCompare(right.name) || left.url.localeCompare(right.url));
  const apiRoutesAgree = observed.directApi && observed.sameOriginApi
    ? observed.directApi === observed.sameOriginApi : null;
  return {
    ok: checks.every(check => check.ok), checkedAt: new Date().toISOString(), checks,
    releaseEvidence: { ...observed, apiRoutesAgree, observations: releaseChecks },
  };
}

if (import.meta.main) {
  try {
    const result = await checkAvailability({
      webUrl: process.env.FC_ARENA_WEB_URL || DEFAULT_WEB_URL,
      apiUrl: process.env.FC_ARENA_HEALTH_URL || DEFAULT_API_URL,
      timeoutMs: Number(process.env.FC_ARENA_PROBE_TIMEOUT_MS || 10_000),
    });
    console.log(JSON.stringify(result, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) {
      const lines = result.checks.map(check => `- ${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.url} (${check.code ?? check.status})`);
      const evidence = result.releaseEvidence;
      const releaseLines = [
        `- Observed web release: ${evidence.web ?? 'unknown'}`,
        `- Observed direct API release: ${evidence.directApi ?? 'unknown'}`,
        `- Observed same-origin API release: ${evidence.sameOriginApi ?? 'unknown'}`,
        `- API route identity agreement: ${evidence.apiRoutesAgree === null ? 'unknown' : evidence.apiRoutesAgree ? 'yes' : 'no'}`,
        '- Public observations only; not proof of host runtime, rollback, or deployment authorization.',
      ];
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `FC Arena availability: ${result.ok ? 'PASS' : 'FAIL'}\n\n${lines.join('\n')}\n\nRelease evidence (non-gating)\n\n${releaseLines.join('\n')}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`FC_ARENA_AVAILABILITY_ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
