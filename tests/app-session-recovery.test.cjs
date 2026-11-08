const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('apps/web/src/lib/auth-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const out = {}, calls = [], fetches = [], uploads = [], timers = new Map(), listeners = { window: new Map(), document: new Map() };
  let now = 1000, id = 0, streamStatus = 200, hang = false;
  class Clock extends Date { static now() { return now; } }
  const target = map => ({ addEventListener(name, fn) { const set = map.get(name) ?? new Set(); set.add(fn); map.set(name, set); }, removeEventListener(name, fn) { map.get(name)?.delete(fn); } });
  const window = { ...target(listeners.window), setTimeout(fn, delay) { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; }, clearTimeout(key) { timers.delete(key); }, dispatchEvent() {} };
  const document = { ...target(listeners.document), visibilityState: 'visible' }, navigator = { onLine: true };
  const api = { API_URL: '/api', apiRequest: (path, options) => new Promise((resolve, reject) => calls.push({ path, options, resolve, reject })) };
  const fetch = (url, options) => {
    const queue = []; let waiting;
    const record = { url, options, cancelled: false, push(text) { const value = new TextEncoder().encode(text); if (waiting) { const resolve = waiting; waiting = null; resolve({ value, done: false }); } else queue.push(value); } };
    const reader = { read: () => queue.length ? Promise.resolve({ value: queue.shift(), done: false }) : new Promise(resolve => { waiting = resolve; }), cancel: () => { record.cancelled = true; waiting?.({ done: true }); waiting = null; return Promise.resolve(); }, releaseLock() {} };
    record.reader = reader; fetches.push(record);
    return hang ? new Promise(() => {}) : Promise.resolve({ ok: streamStatus === 200, status: streamStatus, body: { getReader: () => reader, cancel: reader.cancel } });
  };
  class XMLHttpRequest {
    constructor() { this.upload = {}; this.headers = {}; uploads.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(body) { this.body = body; }
    abort() { this.aborted = true; this.onabort?.(); }
  }
  vm.runInNewContext(code, { exports: out, require: () => api, window, document, navigator, fetch, Date: Clock, Headers, Promise, Map, Error, JSON, DOMException, Event, AbortController, TextDecoder, Uint8Array, XMLHttpRequest, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  out.establishLoginSession('account-a', 3600);
  return { out, calls, fetches, uploads, timers, navigator, document, listeners,
    advance(ms) { const until = now + ms; for (;;) { const next = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); now = next[1].at; next[1].fn(); } now = until; },
    emit(where, name) { for (const fn of [...(listeners[where].get(name) ?? [])]) fn(); },
    setStatus(value) { streamStatus = value; }, setHang(value) { hang = value; },
  };
}

test('profile reads share one request across cancellable and regular callers, then expire after 30 seconds', async () => {
  const f = fixture(), controller = new AbortController();
  const a = f.out.getCurrentUser({ signal: controller.signal }), b = f.out.getCurrentUser();
  const rejected = assert.rejects(a, error => error.name === 'AbortError'); await tick(); assert.equal(f.calls.length, 1);
  controller.abort(); await rejected; assert.equal(f.calls[0].options.signal.aborted, false);
  f.calls[0].resolve({ data: { user: { id: 'a' } } }); assert.equal((await b).id, 'a');
  assert.equal((await f.out.getCurrentUser()).id, 'a'); assert.equal(f.calls.length, 1);
  f.advance(30_001); const c = f.out.getCurrentUser(); await tick(); assert.equal(f.calls.length, 2);
  f.calls[1].resolve({ data: { user: { id: 'a', fullName: 'Updated' } } }); assert.equal((await c).fullName, 'Updated');
});

test('the last cancelled profile subscriber aborts its request and leaves no reusable failed read', async () => {
  const f = fixture(), c = new AbortController(); const read = f.out.getCurrentUser({ signal: c.signal });
  const rejected = assert.rejects(read, value => value === 0); await tick(); c.abort(0); await rejected;
  assert(f.calls[0].options.signal.aborted);
  const fresh = f.out.getCurrentUser(); await tick(); assert.equal(f.calls.length, 2);
  f.calls[1].resolve({ data: { user: { id: 'fresh' } } }); assert.equal((await fresh).id, 'fresh');
});

test('profile writes invalidate identity reads both before and after completion', async () => {
  const f = fixture(); const first = f.out.getCurrentUser(); await tick(); f.calls[0].resolve({ data: { user: { id: 'a', fullName: 'Before' } } }); await first;
  const write = f.out.authenticatedRequest('/players/me/profile', { method: 'PATCH', body: '{}' }); await tick();
  const during = f.out.getCurrentUser(); await tick(); assert.equal(f.calls.length, 3);
  f.calls[2].resolve({ data: { user: { id: 'a', fullName: 'Before' } } }); await during;
  f.calls[1].resolve({}); await write;
  const after = f.out.getCurrentUser(); await tick(); assert.equal(f.calls.length, 4);
  f.calls[3].resolve({ data: { user: { id: 'a', fullName: 'After' } } }); assert.equal((await after).fullName, 'After');
});

test('an account switch rejects an in-flight profile from the previous account', async () => {
  const f = fixture(); const a = f.out.getCurrentUser(); const rejected = assert.rejects(a, error => error.name === 'AbortError'); await tick();
  f.out.establishLoginSession('account-b', 3600); const b = f.out.getCurrentUser(); await tick();
  f.calls[0].resolve({ data: { user: { id: 'account-a' } } }); await rejected;
  assert.equal(f.calls[1].options.headers.get('Authorization'), 'Bearer account-b');
  f.calls[1].resolve({ data: { user: { id: 'account-b' } } }); assert.equal((await b).id, 'account-b');
});

test('explicit freshness options bypass the short identity cache', async () => {
  const f = fixture(); const a = f.out.getCurrentUser(); await tick(); f.calls[0].resolve({ data: { user: { id: 'a' } } }); await a;
  const b = f.out.getCurrentUser({ cache: 'no-store' }); await tick(); assert.equal(f.calls.length, 2);
  f.calls[1].resolve({ data: { user: { id: 'a' } } }); await b;
});

test('an old token refresh cannot overwrite a new login or clear its newer refresh', async () => {
  const f = fixture(); const a = f.out.refreshAccessToken(true); const rejected = assert.rejects(a, error => error.name === 'AbortError'); await tick();
  f.out.establishLoginSession('account-b', 3600); const b = f.out.refreshAccessToken(true); await tick();
  f.calls[0].resolve({ data: { accessToken: 'old-a', expiresIn: 3600 } }); await rejected;
  const same = f.out.refreshAccessToken(true); await tick(); assert.equal(f.calls.length, 2);
  f.calls[1].resolve({ data: { accessToken: 'new-b', expiresIn: 3600 } }); assert.equal(await b, 'new-b'); assert.equal(await same, 'new-b');
});

test('realtime sockets pause offline/hidden, reconnect on return, and clean up on navigation', async () => {
  const f = fixture(), events = [], states = [];
  const stop = f.out.subscribeAuthenticatedEvents('/matches/a/events', event => events.push(event), state => states.push(state));
  await tick(); assert.equal(f.fetches.length, 1); assert.equal(states.at(-1), 'connected');
  f.fetches[0].push('event: match\ndata: {"type":"result_confirmed"}\n\n'); await tick(); assert.equal(events[0].data.type, 'result_confirmed');
  f.navigator.onLine = false; f.emit('window', 'offline'); await tick(); assert(f.fetches[0].options.signal.aborted);
  f.advance(120_000); await tick(); assert.equal(f.fetches.length, 1);
  f.navigator.onLine = true; f.emit('window', 'online'); await tick(); assert.equal(f.fetches.length, 2);
  f.document.visibilityState = 'hidden'; f.emit('document', 'visibilitychange'); await tick(); f.advance(120_000); await tick(); assert.equal(f.fetches.length, 2);
  f.document.visibilityState = 'visible'; f.emit('document', 'visibilitychange'); await tick(); assert.equal(f.fetches.length, 3);
  stop(); await tick(); assert.equal(f.timers.size, 0); assert(f.fetches[2].options.signal.aborted);
  assert([...f.listeners.window.values(), ...f.listeners.document.values()].every(set => set.size === 0));
});

test('a silent half-open stream reconnects after missing three server heartbeats', async () => {
  const f = fixture(); const stop = f.out.subscribeAuthenticatedEvents('/matches/a/events', () => {}); await tick();
  f.advance(60_000); await tick(); assert(f.fetches[0].options.signal.aborted);
  f.advance(1_000); await tick(); assert.equal(f.fetches.length, 2); stop(); await tick(); assert.equal(f.timers.size, 0);
});

test('valid heartbeat comments keep the stream alive without emitting fake match updates', async () => {
  const f = fixture(), events = []; const stop = f.out.subscribeAuthenticatedEvents('/matches/a/events', event => events.push(event)); await tick();
  for (let i = 0; i < 5; i++) { f.advance(19_000); f.fetches[0].push(': heartbeat\n\n'); await tick(); }
  assert.equal(f.fetches.length, 1); assert.equal(events.length, 0); stop(); await tick(); assert.equal(f.timers.size, 0);
});

test('a hanging handshake has a deadline and a rejected scope does not retry forever', async () => {
  const f = fixture(); f.setHang(true); const stop = f.out.subscribeAuthenticatedEvents('/matches/a/events', () => {}); await tick();
  f.advance(15_000); await tick(); assert(f.fetches[0].options.signal.aborted);
  f.setHang(false); f.setStatus(403); f.advance(1_000); await tick(); assert.equal(f.fetches.length, 2);
  f.advance(120_000); await tick(); assert.equal(f.fetches.length, 2); assert.equal(f.timers.size, 0); stop();
});

test('authenticated reads preserve both Headers and tuple options while replacing stale bearer tokens', async () => {
  for (const headers of [new Headers({ 'X-Scope': 'league', Authorization: 'old' }), [['X-Scope', 'league'], ['Authorization', 'old']]]) {
    const f = fixture(); const result = f.out.authenticatedRequest('/scope', { headers }); await tick();
    assert.equal(f.calls[0].options.headers.get('X-Scope'), 'league');
    assert.equal(f.calls[0].options.headers.get('Authorization'), 'Bearer account-a');
    f.calls[0].resolve({}); await result;
  }
});

test('a progressing slow upload can complete after 30 seconds and releases its stall timer', async () => {
  const f = fixture(), progress = [];
  const result = f.out.authenticatedUpload('/results/upload', {}, value => progress.push(value)); await tick();
  const xhr = f.uploads[0]; assert.equal(xhr.timeout, 120000);
  for (let n = 1; n <= 4; n++) { f.advance(20000); xhr.upload.onprogress({ lengthComputable: true, loaded: n, total: 4 }); }
  xhr.status = 201; xhr.responseText = '{"success":true}'; xhr.onload();
  assert.equal((await result).success, true); assert.equal(progress.at(-1), 100);
  assert.equal(f.uploads.length, 1); assert.equal(f.timers.size, 0);
});

test('an upload with no progress aborts once and never replays an uncertain write', async () => {
  const f = fixture(); const result = f.out.authenticatedUpload('/results/upload', {});
  const rejected = assert.rejects(result, error => error.status === 408); await tick();
  f.advance(30000); await rejected;
  assert(f.uploads[0].aborted); assert.equal(f.uploads.length, 1); assert.equal(f.timers.size, 0);
});

test('upload network errors and total deadlines clean up timers without replay', async () => {
  for (const event of ['onerror', 'ontimeout', 'onabort']) {
    const f = fixture(), result = f.out.authenticatedUpload('/results/upload', {});
    const rejected = assert.rejects(result); await tick(); f.uploads[0][event](); await rejected;
    f.advance(180000); assert.equal(f.uploads.length, 1); assert.equal(f.timers.size, 0);
  }
});
