import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { checkAvailability } from '../scripts/check-availability.mjs';

const health = { success: true, data: { status: 'healthy', api: 'connected', database: 'connected', redis: 'connected' } };
const html = '<html><link rel="stylesheet" href="/_next/static/app.css"><script src="/_next/static/app.js"></script></html>';

async function fixture(t, overrides = {}) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ path: request.url, method: request.method });
    const route = overrides[request.url];
    if (route === 'hang') return;
    if (route === 'hang-body') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.write('<html>');
      return;
    }
    const defaults = request.url.endsWith('health') ? { type: 'application/json', body: JSON.stringify(health) }
      : request.url.endsWith('.js') ? { type: 'application/javascript', body: 'window.app = true;' }
        : request.url.endsWith('.css') ? { type: 'text/css', body: 'body { color: white; }' }
          : { type: 'text/html', body: html };
    const result = { status: 200, ...defaults, ...route };
    response.writeHead(result.status, { 'content-type': result.type, ...result.headers });
    response.end(result.body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const webUrl = `http://127.0.0.1:${server.address().port}`;
  return { webUrl, apiUrl: `${webUrl}/direct/health`, requests };
}

test('checks the Android start document, both API routes and deduplicated exact asset URLs without writes', async t => {
  const server = await fixture(t);
  const result = await checkAvailability(server);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 6);
  assert.deepEqual(server.requests.filter(request => request.method === 'HEAD').map(request => request.path).sort(),
    ['/_next/static/app.css', '/_next/static/app.js']);
  assert.ok(server.requests.every(request => ['GET', 'HEAD'].includes(request.method)));
  assert.ok(server.requests.some(request => request.path === '/dashboard'));
});

test('a working direct API does not hide a broken website API proxy', async t => {
  const server = await fixture(t, { '/api/health': { status: 502, body: 'Bad Gateway' } });
  const result = await checkAvailability(server);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(check => check.name === 'same-origin-api').status, 502);
  assert.equal(result.checks.find(check => check.name === 'direct-api').ok, true);
});

test('a successful homepage cannot hide a broken Android dashboard', async t => {
  const server = await fixture(t, { '/dashboard': { status: 503 } });
  const result = await checkAvailability(server);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(check => check.name === 'web-home').ok, true);
  assert.equal(result.checks.find(check => check.name === 'android-start-page').ok, false);
});

test('missing deploy chunks and HTML masquerading as JavaScript fail availability', async t => {
  for (const route of [{ status: 404 }, { type: 'text/html', body: html }]) {
    const server = await fixture(t, { '/_next/static/app.js': route });
    const result = await checkAvailability(server);
    assert.equal(result.ok, false);
    assert.equal(result.checks.find(check => check.url.endsWith('app.js')).ok, false);
  }
});

test('HTTP 200 maintenance HTML without the app scripts fails', async t => {
  const server = await fixture(t, { '/dashboard': { body: '<html>Under maintenance</html>' } });
  const result = await checkAvailability(server);
  assert.equal(result.checks.find(check => check.name === 'android-start-page').code, 'INVALID_RESPONSE');
});

test('HTTP 200 health with failed database or Redis fails', async t => {
  for (const dependency of ['database', 'redis']) {
    const body = JSON.stringify({ ...health, data: { ...health.data, [dependency]: 'unavailable' } });
    const server = await fixture(t, { '/api/health': { body } });
    const result = await checkAvailability(server);
    assert.equal(result.ok, false);
    assert.equal(result.checks.find(check => check.name === 'same-origin-api').code, 'INVALID_RESPONSE');
  }
});

test('a body that never arrives is bounded by the deadline', async t => {
  const server = await fixture(t, { '/dashboard': 'hang' });
  const result = await checkAvailability({ ...server, timeoutMs: 200 });
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(check => check.name === 'android-start-page').code, 'CONNECTION_TIMEOUT');
});

test('a successful HTTP header cannot hide a stalled document body', async t => {
  const server = await fixture(t, { '/dashboard': 'hang-body' });
  const result = await checkAvailability({ ...server, timeoutMs: 200 });
  const startup = result.checks.find(check => check.name === 'android-start-page');
  assert.equal(startup.status, 200);
  assert.equal(startup.ok, false);
  assert.equal(startup.code, 'CONNECTION_TIMEOUT');
});

test('a cross-origin login or captive portal redirect fails the application check', async t => {
  const result = await checkAvailability({ fetcher: async url => {
    const response = new Response(String(url).endsWith('health') ? JSON.stringify(health) : html,
      { headers: { 'content-type': String(url).endsWith('health') ? 'application/json' : 'text/html' } });
    Object.defineProperty(response, 'url', { value: 'https://unrelated.example/login' });
    return response;
  } });
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(check => check.name === 'web-home').code, 'INVALID_RESPONSE');
  assert.equal(result.checks.filter(check => check.name === 'web-asset').length, 0);
});

test('transport errors are distinguished from HTTP and application errors', async () => {
  for (const [code, expected] of [['ENOTFOUND', 'DNS_LOOKUP_FAILED'], ['ECONNREFUSED', 'CONNECTION_REFUSED'],
    ['UND_ERR_CONNECT_TIMEOUT', 'CONNECTION_TIMEOUT'], ['CERT_HAS_EXPIRED', 'TLS_ERROR']]) {
    const result = await checkAvailability({ fetcher: async () => { throw new TypeError('fetch failed', { cause: { code } }); } });
    assert.equal(result.ok, false);
    assert.equal(result.checks.length, 4);
    assert.ok(result.checks.every(check => check.code === expected));
  }
});
