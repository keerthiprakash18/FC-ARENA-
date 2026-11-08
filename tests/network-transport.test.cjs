const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('apps/web/src/lib/api.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
const json = (status = 200, data = { success: true, data: {} }) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});

function transport(fetcher, { browser = true, online = true, configured } = {}) {
  const out = {}, calls = [], timers = new Map();
  let now = 0, nextTimer = 0;
  class Clock extends Date { static now() { return now; } }
  const context = {
    exports: out, process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: configured } },
    Date: Clock, AbortController, DOMException, Headers, Response, Promise, Error, Set,
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) { calls.push({ url, options }); return fetcher(url, options, calls.length); },
  };
  if (browser) { context.window = {}; context.navigator = { onLine: online }; }
  vm.runInNewContext(code, context);
  return { out, calls, timers,
    advance(milliseconds) {
      const target = now + milliseconds;
      for (;;) {
        const due = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at; timers.delete(due[0]); due[1].fn();
      }
      now = target;
    },
  };
}

test('browser JSON, uploads and event streams share the website API origin', async () => {
  const f = transport(async () => json(), { configured: 'https://old-api.example/api' });
  assert.equal(f.out.API_URL, '/api');
  await f.out.apiRequest('/players/me/dashboard');
  assert.equal(f.calls[0].url, '/api/players/me/dashboard');
  assert.equal(f.calls[0].options.credentials, 'include');
  assert.equal(f.calls[0].options.headers.has('Content-Type'), false);
  assert.equal(f.timers.size, 0);
});

test('server requests retain the configured absolute API URL', async () => {
  const f = transport(async () => json(), { browser: false, configured: 'https://api.example/api' });
  await f.out.apiRequest('health');
  assert.equal(f.calls[0].url, 'https://api.example/api/health');
});

test('Headers instances and JSON request content type are preserved', async () => {
  const f = transport(async () => json());
  await f.out.apiRequest('/results', { method: 'POST', headers: new Headers({ Authorization: 'Bearer sample' }), body: '{}' });
  assert.equal(f.calls[0].options.headers.get('Authorization'), 'Bearer sample');
  assert.equal(f.calls[0].options.headers.get('Content-Type'), 'application/json');
});

test('offline requests fail immediately without a spinner timeout or retry', async () => {
  const f = transport(async () => json(), { online: false });
  await assert.rejects(f.out.apiRequest('/fixtures'), error => error.code === 'NETWORK_OFFLINE');
  assert.equal(f.calls.length, 0);
  assert.equal(f.timers.size, 0);
});

test('the deadline includes a response body that never finishes', async () => {
  const f = transport(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }));
  const result = f.out.apiRequest('/fixtures');
  const rejected = assert.rejects(result, error => error.code === 'REQUEST_TIMEOUT');
  await tick(); f.advance(15000); await rejected;
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].options.signal.aborted, true);
  assert.equal(f.timers.size, 0);
});

test('a fast transient read failure retries once and recovers', async () => {
  const f = transport(async (_, __, count) => { if (count === 1) throw new TypeError('network failed'); return json(); });
  const result = f.out.apiRequest('/fixtures');
  await tick(); f.advance(250); await result;
  assert.equal(f.calls.length, 2);
  assert.equal(f.timers.size, 0);
});

test('a stalled read handshake gets a fresh attempt at six seconds', async () => {
  const f = transport(async (_, __, count) => count === 1 ? new Promise(() => {}) : json());
  const result = f.out.apiRequest('/fixtures');
  await tick(); f.advance(6000); await tick();
  assert.equal(f.calls[0].options.signal.aborted, true);
  f.advance(250); await result;
  assert.equal(f.calls.length, 2);
  assert.equal(f.timers.size, 0);
});

test('fast headers retain the full deadline for a slow response body', async () => {
  let complete;
  const f = transport(async () => ({ ok: true, status: 200, json: () => new Promise(resolve => { complete = resolve; }) }));
  const result = f.out.apiRequest('/fixtures');
  await tick(); f.advance(10000); await tick();
  assert.equal(f.calls[0].options.signal.aborted, false);
  complete({ success: true }); await result;
  assert.equal(f.calls.length, 1);
  assert.equal(f.timers.size, 0);
});

test('an HTML success response cannot become a false successful API result', async () => {
  const f = transport(async (_, __, count) => count === 1 ? new Response('<html>proxy error</html>') : json());
  const result = f.out.apiRequest('/fixtures');
  await tick(); f.advance(250); await result;
  assert.equal(f.calls.length, 2);
});

test('writes never replay after a network or server failure', async () => {
  for (const failure of ['network', 'server']) {
    const f = transport(async () => { if (failure === 'network') throw new TypeError('offline'); return json(503); });
    await assert.rejects(f.out.apiRequest('/results', { method: 'POST', body: '{}' }));
    assert.equal(f.calls.length, 1);
    assert.equal(f.timers.size, 0);
  }
});

test('cancelling during backoff prevents the second network request', async () => {
  const f = transport(async () => json(503));
  const controller = new AbortController();
  const result = f.out.apiRequest('/fixtures', { signal: controller.signal });
  const rejected = assert.rejects(result, error => error.name === 'AbortError');
  await tick(); controller.abort(); await rejected; f.advance(1000);
  assert.equal(f.calls.length, 1);
  assert.equal(f.timers.size, 0);
});

test('cancelling a body read is immediate even when the stream ignores abort', async () => {
  const f = transport(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }));
  const controller = new AbortController();
  const result = f.out.apiRequest('/fixtures', { signal: controller.signal });
  const rejected = assert.rejects(result, error => error.name === 'AbortError');
  await tick(); controller.abort(); await rejected;
  assert.equal(f.timers.size, 0);
});

test('an already cancelled page starts no request', async () => {
  const f = transport(async () => json());
  const controller = new AbortController(); controller.abort();
  await assert.rejects(f.out.apiRequest('/fixtures', { signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(f.calls.length, 0);
});

test('HEAD and empty 204 responses are valid without JSON parsing', async () => {
  const f = transport(async (_, options) => new Response(null, { status: options.method === 'HEAD' ? 200 : 204 }));
  assert.equal(await f.out.apiRequest('/health', { method: 'HEAD' }), null);
  assert.equal(await f.out.apiRequest('/results', { method: 'DELETE' }), null);
});

test('retry attempts share one 15-second budget instead of doubling the wait', async () => {
  let first;
  const f = transport(async (_, __, count) => count === 1
    ? new Promise(resolve => { first = resolve; })
    : { ok: true, status: 200, json: () => new Promise(() => {}) });
  const result = f.out.apiRequest('/fixtures');
  const rejected = assert.rejects(result, error => error.code === 'REQUEST_TIMEOUT');
  await tick(); f.advance(11000); first(json(503)); await tick();
  f.advance(250); await tick(); f.advance(3750); await rejected;
  assert.equal(f.calls.length, 2);
  assert.equal(f.timers.size, 0);
});
