import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, user } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';
import { makeFixtureFeed } from './fixture-feed-fixtures.mjs';

const logo = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 36"><path fill="${color}" d="M2 2h28v22L16 34 2 24z"/></svg>`)}`;
const homeLogo = logo('#e5b348'), awayLogo = logo('#28a5ee');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 1280]) {
    const fixture = { ...phaseData['/api/tournaments/phase3/fixtures'].fixtures[0], group: null,
      home: { id: 'home', entryName: 'Home Club', entryLogoUrl: homeLogo,
        members: [{ id: user.id, fullName: user.fullName, inGameName: null, playerCode: 'P3' }] },
      away: { id: 'away', entryName: 'Away Club', entryLogoUrl: awayLogo, members: [] } };
    const { context, page, errors } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
      '/api/leagues/phase3/fixture-feed': route => route.fulfill({ json: { success: true, error: null,
        data: makeFixtureFeed('phase3', phaseData['/api/leagues/phase3/tournaments'].tournaments, { phase3: [fixture] }) } }),
      '/api/tournaments/phase3/fixtures': route => route.fulfill({ json: { success: true,
        data: { ...phaseData['/api/tournaments/phase3/fixtures'], fixtures: [fixture] }, error: null } }),
    }, onMutation: (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
      return route.fulfill({ status: 204, headers });
    } });
    for (const url of ['/fixtures', '/tournaments/phase3/fixtures']) {
      await page.goto(`https://fcarena.in${url}`);
      const sides = page.locator(url === '/fixtures' ? '.premium-fixture-sides' : '.fc-fixture-card');
      await sides.first().waitFor();
      for (const [club, expected] of [['Home Club', homeLogo], ['Away Club', awayLogo]]) {
        const image = sides.locator(`img[alt="${club} crest"]`).first();
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(img => img.decode());
        assert.equal(await image.getAttribute('src'), expected);
        assert(await image.evaluate(img => img.complete && img.naturalWidth > 0));
      }
      if (url === '/fixtures') {
        await page.getByRole('button', { name: 'All Matches', exact: true }).click();
        assert.equal(await sides.locator('img').count(), 2);
      }
      await checkLayout(page, `fixture logos ${url} ${width}`);
    }
    fixture.away.entryLogoUrl = null;
    await page.goto('https://fcarena.in/fixtures');
    const sides = page.locator('.premium-fixture-sides');
    await sides.first().waitFor();
    assert.equal(await sides.locator('img').count(), 1);
    assert.equal(await sides.locator('.premium-crest').last().innerText(), 'AC');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px: My/All Fixtures and tournament fixtures use each club logo; missing-logo initials retained`);
  }
} finally { await browser.close(); }
