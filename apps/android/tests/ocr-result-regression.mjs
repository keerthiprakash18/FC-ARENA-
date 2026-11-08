import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'] });
try {
  for (const width of [390, 1280]) {
    let extraction = null, uploads = 0, submits = 0;
    const diagnostics = [];
    const { context, page, errors } = await createUiContext(browser, {
      width, direct: true, native: width < 500, mode: 'DARK',
      overrides: {
        '/api/matches/phase3/ocr/latest': (route, headers) => route.fulfill({ headers,
          json: { success: true, data: { extraction }, error: null } }),
      },
      onMutation: async (route, headers) => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (path === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
        if (path === '/api/matches/phase3/ocr') {
          assert.match(request.headers()['content-type'], /multipart\/form-data/);
          assert.match(request.postDataBuffer().toString(), /name="screenshot"/);
          if (++uploads === 1) return route.fulfill({ status: 503, headers, json: {
            success: false, data: null, error: { code: 'OCR_STORAGE_UNAVAILABLE',
              message: 'Screenshot storage is temporarily unavailable. Please retry shortly or enter the scores manually.' },
          } });
          extraction = { id: 'ocr-review', status: 'PROCESSING', createdAt: new Date().toISOString(),
            detectedHomeScore: null, detectedAwayScore: null, scoreConfidence: null,
            homeMatchedUser: null, awayMatchedUser: null, resultSubmission: null };
          return route.fulfill({ headers, json: { success: true, data: {
            message: 'Screenshot uploaded. Processing Match Result...', extraction,
          }, error: null } });
        }
        if (path === '/api/ocr/ocr-review/submit-result') {
          submits++;
          assert.deepEqual(request.postDataJSON(), { homeScore: 0, awayScore: 1 });
          extraction = { ...extraction, resultSubmission: { id: 'reviewed', status: 'PENDING_VERIFICATION' } };
          return route.fulfill({ headers, json: { success: true, data: {
            message: 'OCR result submitted for Admin verification.', submission: { id: 'reviewed' },
          }, error: null } });
        }
        throw new Error(`Unexpected mutation ${path}`);
      },
    });
    await context.grantPermissions(['local-network-access'], { origin });
    page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
    page.on('request', request => diagnostics.push(new URL(request.url()).pathname));
    try {
      // Serve local page assets through Node, keeping every browser URL local
      // and all API requests under the fixture harness's mocks.
      await page.route(`${origin}/**`, async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname.startsWith('/api/')) return route.fallback();
        const response = await fetch(request.url());
        const headers = Object.fromEntries(response.headers);
        for (const key of ['content-encoding', 'transfer-encoding', 'content-length']) delete headers[key];
        return route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
      });
      await page.goto(`${origin}/matches/phase3`);
      await page.getByText('Upload a screenshot instead', { exact: true }).click();
      await page.getByLabel('Match result screenshot').setInputFiles({ name: 'score.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
      await page.getByRole('button', { name: 'Upload & Scan Screenshot', exact: true }).click();
      await page.getByText('Screenshot storage is temporarily unavailable. Please retry shortly or enter the scores manually.', { exact: true }).waitFor();
      assert.equal(uploads, 1);
      await page.getByRole('button', { name: 'Upload & Scan Screenshot', exact: true }).click();
      await page.getByText('OCR worker is analysing the screenshot.', { exact: true }).waitFor();
      extraction = { ...extraction, status: 'COMPLETED', detectedHomeScore: 1, detectedAwayScore: 0,
        scoreConfidence: 0.49, homeNameConfidence: 0.2, awayNameConfidence: 0.2,
        detectedHomeName: null, detectedAwayName: null, rawText: '1 - 0' };
      const choices = page.getByRole('group', { name: 'Choose detected score order' });
      await choices.waitFor();
      const form = page.locator('form').filter({ hasText: 'Verify Detected Result' });
      const scores = form.getByRole('spinbutton');
      assert.equal(await scores.nth(0).inputValue(), '');
      assert.equal(await scores.nth(1).inputValue(), '');
      assert.equal(submits, 0, 'uncertain OCR must not submit or autofill scores');
      await choices.getByRole('button').nth(1).click();
      assert.equal(await scores.nth(0).inputValue(), '0');
      assert.equal(await scores.nth(1).inputValue(), '1');
      await checkLayout(page, `OCR review ${width}px`);
      await form.getByRole('button', { name: 'Submit OCR Result for Admin Verification', exact: true }).click();
      await page.getByText('OCR result submitted for Admin verification.', { exact: true }).waitFor();
      assert.equal(submits, 1);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: storage error, retry, processing, uncertain-score review, swapped submission`);
    } catch (error) {
      console.log('OCR test diagnostic', { errors, diagnostics, text: (await page.locator('body').innerText()).slice(0, 2500) });
      throw error;
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
