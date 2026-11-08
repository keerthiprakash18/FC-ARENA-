import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament } from './phase-ui-fixtures.mjs';
import { makeFixtureFeed } from './fixture-feed-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
try {
  for (const width of [360, 1280]) {
    const tournaments = Array.from({ length: 20 }, (_, i) => ({ ...tournament, id: `cup-${i}`, name: `Cup ${i}` }));
    const fixtureLists = Object.fromEntries(tournaments.map((cup, i) => [cup.id,
      Array.from({ length: 5 }, (_, j) => ({ ...phaseData['/api/tournaments/phase3/fixtures'].fixtures[0],
        id: `fixture-${i}-${j}`, fixtureCode: `F-${i}-${j}`, sequence: j + 1, group: null, matchday: 1,
        match: { id: `match-${i}-${j}`, status: 'SCHEDULED' } }))]));
    const snapshot = makeFixtureFeed('phase3', tournaments, fixtureLists);
    let feedReads = 0, meReads = 0, legacyReads = 0;
    const { context, page, errors, mutations } = await createUiContext(browser, { width, direct: true, mode: 'DARK', overrides: {
      '/api/leagues/phase3/fixture-feed': async (route, headers) => {
        feedReads++; await new Promise(resolve => setTimeout(resolve, 400));
        const unchanged = new URL(route.request().url()).searchParams.get('version') === snapshot.version;
        return route.fulfill({ headers, json: { success: true, error: null,
          data: unchanged ? { unchanged: true, version: snapshot.version } : snapshot } });
      },
    }, onMutation: (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
      return route.fulfill({ status: 204, headers });
    } });
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === '/api/auth/me') meReads++;
      if (/^\/api\/leagues\/[^/]+\/tournaments$/.test(pathname) || /^\/api\/tournaments\/[^/]+\/fixtures$/.test(pathname)) legacyReads++;
    });
    await page.goto(`${origin}/fixtures`);
    const cards = page.locator('.premium-fixture-sides');
    await cards.first().waitFor();
    assert.equal(await cards.count(), 40, 'first paint must bound card rendering for 100 matches');
    assert.equal(feedReads, 1, '20 tournaments must load through one aggregate schedule request');
    assert.equal(legacyReads, 0, 'schedule must not fan out to each tournament');
    assert.equal(meReads, 1, 'theme, shell and page share the identity request');
    await page.getByRole('button', { name: 'Show more matches (60 remaining)', exact: true }).click();
    assert.equal(await cards.count(), 80);
    assert.equal(feedReads, 1, 'show more uses loaded data');
    // Simulate simultaneous foreground notifications while a slow refresh is pending.
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
    await new Promise(resolve => setTimeout(resolve, 700));
    assert.equal(feedReads, 2, 'foreground event burst must share one pending refresh');
    assert.equal(await cards.count(), 80, 'unchanged refresh preserves the expanded list');
    await context.setOffline(true);
    await page.getByText(/You’re offline/).waitFor();
    assert.equal(await cards.count(), 80, 'offline must retain the schedule');
    await context.setOffline(false);
    await page.getByText(/You’re offline/).waitFor({ state: 'hidden' });
    await new Promise(resolve => setTimeout(resolve, 700));
    assert.equal(feedReads, 3);
    await checkLayout(page, `performance fixtures ${width}`);
    assert.deepEqual(errors, []);
    assert(mutations.every(m => m.path === '/api/telemetry/web-vitals'));
    await context.close();
    console.log(`PASS ${width}px: 20 tournaments / 100 fixtures, 1 feed request, 40/80 cards, merged refreshes, offline preservation`);

    const room = await createUiContext(browser, { width, direct: true, mode: 'DARK', onMutation: (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
      return route.fulfill({ status: 204, headers });
    } });
    let matchReads = 0;
    room.page.on('request', request => { if (new URL(request.url()).pathname === '/api/matches/phase3') matchReads++; });
    await room.context.addInitScript(() => {
      const original = window.fetch;
      window.__streamCount = 0;
      window.fetch = (input, init) => {
        if (!String(input).includes('/matches/phase3/events')) return original(input, init);
        window.__streamCount++;
        const encoder = new TextEncoder(); let timer;
        const body = new ReadableStream({ start(controller) {
          controller.enqueue(encoder.encode('event: connected\ndata: {"type":"connected"}\n\n'));
          timer = setInterval(() => controller.enqueue(encoder.encode(': heartbeat\n\n')), 20_000);
          init?.signal?.addEventListener('abort', () => { clearInterval(timer); controller.error(new DOMException('Aborted', 'AbortError')); }, { once: true });
        }, cancel() { clearInterval(timer); } });
        return Promise.resolve(new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
      };
    });
    await room.page.goto(`${origin}/matches/phase3`);
    await room.page.locator('#result-entry input[name="homeScore"]').fill('3');
    await room.page.locator('#result-entry input[name="awayScore"]').fill('2');
    await room.page.waitForFunction(() => window.__streamCount === 1);
    assert.equal(matchReads, 1, 'fresh realtime handshake must not repeat the initial match request');
    await room.context.setOffline(true);
    await room.page.getByText(/You’re offline/).waitFor();
    await room.context.setOffline(false);
    await room.page.waitForFunction(() => window.__streamCount === 2);
    await new Promise(resolve => setTimeout(resolve, 700));
    assert.equal(await room.page.locator('#result-entry input[name="homeScore"]').inputValue(), '3');
    assert.equal(await room.page.locator('#result-entry input[name="awayScore"]').inputValue(), '2');
    assert.equal(matchReads, 2, 'realtime reconnect must resync once');
    assert.deepEqual(room.errors, []);
    assert(room.mutations.every(m => m.path === '/api/telemetry/web-vitals'));
    await checkLayout(room.page, `performance match room ${width}`);
    await room.context.close();
    console.log(`PASS ${width}px: realtime reconnects once and preserves both unsaved score fields`);
  }
} finally { await browser.close(); }
