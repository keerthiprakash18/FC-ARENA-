import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, user } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
const id = '81fb40f4-7e4f-40a6-a429-c87dd7242ae2';
const confirmed = {
  id: 'confirmed-fixture', status: 'CONFIRMED', source: 'MANUAL', homeScore: 7, awayScore: 4,
  createdAt: '2026-11-20T12:00:00Z', reviewedAt: '2026-11-20T12:01:00Z',
  rejectionReason: null, submittedBy: { id: user.id, fullName: user.fullName, player: user.player },
  reviewedBy: { id: user.id, fullName: user.fullName },
};
try {
  for (const scenario of ['android-retry', 'desktop-share', 'desktop-no-share']) {
    const native = scenario === 'android-retry';
    const width = native ? 390 : 1280;
    let uploads = 0, png;
    const baseMatch = phaseData['/api/matches/phase3'].match;
    const f = await createUiContext(browser, { width, native, mode: 'DARK', overrides: {
      '/api/matches/phase3': { match: { ...baseMatch, status: 'COMPLETED', fixture: { ...baseMatch.fixture, status: 'COMPLETED' } } },
      '/api/matches/phase3/results': { isLeagueAdmin: false, canVerifyResult: false, confirmedResultSubmissionId: confirmed.id, submissions: [confirmed] },
      ['/api/players/card-exports/' + id]: (route, headers) => route.fulfill({
        headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="fc-arena-result.png"' }, body: png,
      }),
    }, onMutation: async (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/players/me/card-export', 'Sharing cannot write match results');
      uploads++;
      if (uploads === 1) return route.fulfill({ status: 503, headers, json: { success: false, error: { message: 'Card preparation temporarily unavailable.' } } });
      const r = route.request();
      const form = await new Request(r.url(), { method: r.method(), headers: r.headers(), body: r.postDataBuffer() }).formData();
      const image = form.get('image');
      assert.equal(image.type, 'image/png');
      assert.equal(form.get('filename'), 'fc-arena-result.png');
      png = Buffer.from(await image.arrayBuffer());
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(16), 1080);
      assert.equal(png.readUInt32BE(20), 1080);
      return route.fulfill({ status: 201, headers, json: { success: true, data: { path: '/players/card-exports/' + id + '?grant=fixture.signature', filename: 'fc-arena-result.png', expiresAt: new Date(Date.now() + 300000).toISOString() } } });
    } });
    try {
      await f.context.addInitScript(({ scenario }) => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => {
          if (!navigator.userActivation.isActive) throw new DOMException('Missing activation', 'NotAllowedError');
          window.__sharedPng = { name: files[0].name, type: files[0].type, size: files[0].size };
        } });
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => {
          if (scenario === 'android-retry') throw new Error('Embedded WebView capability failure');
          return scenario === 'desktop-share';
        } });
      }, { scenario });
      await f.page.goto('https://fcarena.in/matches/phase3');
      await f.page.getByRole('button', { name: 'Share result card', exact: true }).click();
      if (native) {
        await f.page.getByText('Card preparation temporarily unavailable.', { exact: true }).waitFor();
        await f.page.getByRole('button', { name: 'Prepare PNG download', exact: true }).click();
        const save = f.page.getByRole('link', { name: 'Save PNG ↓', exact: true });
        await save.waitFor();
        assert((await save.getAttribute('href')).startsWith('https://api.fcarena.in/api/players/card-exports/'));
        assert.equal(uploads, 2);
        const downloaded = f.page.waitForEvent('download');
        await save.click();
        const attachment = await downloaded;
        assert.equal(attachment.suggestedFilename(), 'fc-arena-result.png');
        assert.equal(await attachment.failure(), null);
      } else {
        const save = f.page.getByRole('link', { name: 'Save PNG ↓', exact: true });
        await save.waitFor();
        assert((await save.getAttribute('href')).startsWith('blob:'));
        assert.equal(uploads, 0, 'Desktop fallback does not require an upload');
        const downloaded = f.page.waitForEvent('download');
        await save.click();
        const attachment = await downloaded;
        assert.equal(attachment.suggestedFilename(), 'fc-arena-result.png');
        assert.equal(await attachment.failure(), null);
        if (scenario === 'desktop-share') {
          assert.equal(await f.page.evaluate(() => window.__sharedPng), undefined);
          await f.page.getByRole('button', { name: 'Share PNG', exact: true }).click();
          await f.page.getByText('Card shared.', { exact: true }).waitFor();
          assert.equal(await f.page.evaluate(() => window.__sharedPng.name), 'fc-arena-result.png');
        }
      }
      assert.equal(new URL(f.page.url()).pathname, '/matches/phase3');
      await checkLayout(f.page, scenario);
      assert.deepEqual(f.errors, []);
      console.log('PASS result card', scenario);
    } finally { await f.context.close(); }
  }
} finally { await browser.close(); }
