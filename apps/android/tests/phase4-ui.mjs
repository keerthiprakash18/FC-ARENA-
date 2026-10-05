import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    for (const profile of ['web', 'reduced', 'android']) {
      const { page, context, errors, mutations } = await createUiContext(browser, {
        width, native: profile === 'android', reducedMotion: profile === 'reduced' ? 'reduce' : 'no-preference',
        onMutation: async (route, headers) => {
          assert.equal(route.request().method(), 'POST');
          assert.equal(new URL(route.request().url()).pathname, '/api/tournaments/phase3/logo');
          await new Promise(resolve => setTimeout(resolve, 400));
          return route.fulfill({ headers, json: { success: true, data: { message: 'Uploaded', logoUrl: `data:image/png;base64,${png.toString('base64')}` }, error: null } });
        },
      });
      await context.addInitScript(() => {
        window.fixtureClipboard = { calls: 0, fail: false };
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: text => new Promise((resolve, reject) => {
          window.fixtureClipboard.calls++; window.fixtureClipboard.text = text;
          setTimeout(() => window.fixtureClipboard.fail ? reject(Error('Fixture permission denied')) : resolve(), 300);
        }) } });
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
      });
      await page.goto('https://fcarena.in/leagues/phase3');
      await page.locator('.fc-main').waitFor();
      if (profile === 'android') assert.equal(await page.locator('html').getAttribute('data-native-app'), 'android');
      await page.getByRole('button', { name: 'Copy code', exact: true }).click();
      const busy = page.getByRole('button', { name: 'Copying…' });
      assert(await busy.isDisabled());
      assert.equal(await busy.getAttribute('aria-busy'), 'true');
      const animation = await page.locator('.fc-busy-indicator').evaluate(element => getComputedStyle(element).animationName);
      assert.equal(animation === 'none', profile !== 'web');
      await page.getByText('League code copied', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.fixtureClipboard.calls), 1);
      assert.equal(await page.evaluate(() => window.fixtureClipboard.text), 'P3');
      await page.evaluate(() => { window.fixtureClipboard.fail = true; });
      await page.getByRole('button', { name: 'Copy code', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Copy the league code shown above.' }).waitFor();
      await page.getByRole('button', { name: 'Show QR', exact: true }).click();
      await page.getByAltText('Scan to join Arena League').waitFor();
      await page.getByRole('button', { name: 'Hide QR' }).click();
      assert.equal(await page.getByAltText('Scan to join Arena League').count(), 0);
      await checkLayout(page, `invite ${width}/${profile}`);

      await page.goto('https://fcarena.in/profile');
      await page.locator('.fc-main').waitFor();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Share player card' }).click();
      assert.equal((await download).suggestedFilename(), 'fc-arena-card.png');
      await page.getByRole('status').filter({ hasText: 'Card downloaded' }).waitFor();
      await checkLayout(page, `share card ${width}/${profile}`);

      await page.goto('https://fcarena.in/tournaments/phase3/playoffs');
      await page.getByRole('article', { name: 'Round 1 bracket' }).waitFor();
      await page.getByLabel('Knockout round').selectOption('Round 1');
      assert.equal(await page.locator('.fc-bracket-round').count(), 1);
      await checkLayout(page, `bracket ${width}/${profile}`);

      await page.goto('https://fcarena.in/tournaments/phase3/wizard/setup');
      await page.locator('.fc-wizard-shell').waitFor();
      await page.getByText('Branding & description (optional)', { exact: true }).click();
      await page.getByLabel('Choose tournament logo').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
      await page.getByRole('alert').filter({ hasText: 'Only PNG, JPG, JPEG and WEBP images are allowed.' }).waitFor();
      assert.equal(mutations.length, 0);
      await page.getByLabel('Choose tournament logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
      await page.getByRole('progressbar', { name: 'Tournament logo upload progress' }).waitFor();
      assert.equal(await page.locator('.fc-upload-preview').getAttribute('aria-busy'), 'true');
      await page.getByRole('status').filter({ hasText: 'Tournament logo uploaded.' }).waitFor();
      assert.equal(mutations.length, 1);
      assert.match(mutations[0].body, /name="logo"/);
      await page.getByRole('button', { name: 'Remove Logo', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remove tournament logo?' }).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(mutations.length, 1, 'Cancel does not remove the logo');
      await checkLayout(page, `upload ${width}/${profile}`);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS Phase 4 ${width}/${profile}: busy feedback, copy success/failure, QR, upload progress/success, confirmation cancel and motion policy`);
    }
  }
} finally { await browser.close(); }
