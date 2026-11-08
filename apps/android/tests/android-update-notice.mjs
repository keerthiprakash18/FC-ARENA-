import assert from 'node:assert/strict';
import { chromium } from './node_modules/playwright/index.mjs';
import { createUiContext, checkLayout, user } from './phase-ui-harness.mjs';
import { writeFile } from 'node:fs/promises';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3102';
process.env.SMOKE_WEB_ORIGIN = origin;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
const available = code => ({ updateAvailable: true, latest: { versionCode: code, versionName: code === 20 ? '1.0.18' : '1.0.19' } });
async function scenario(name, width, mode, run, { native = true, version = '1.0.17', policy = available(20), bridge } = {}) {
  let current = policy, calls = 0;
  const fixture = await createUiContext(browser, { width, mode, direct: true, overrides: {
    '/api/auth/me': { user: { ...user, dateOfBirth: '2000-01-01' } },
    '/api/mobile/android/version': (route, headers) => {
      calls++; assert.equal(new URL(route.request().url()).searchParams.get('versionName'), version);
      return current === 'fail' ? route.fulfill({ status: 503, headers, json: { success: false, data: null } })
        : route.fulfill({ headers, json: { success: true, data: current, error: null } });
    },
  }, onMutation: (route, headers) => {
    assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals'); return route.fulfill({ status: 204, headers });
  } });
  try {
    if (native) await fixture.context.addInitScript(({ version, bridge }) => {
      Object.defineProperty(navigator, 'userAgent', { value: `Mozilla/5.0 (Linux; Android 14) FC-Arena-Android/${version}` });
      if (bridge) window.__fcAndroidUpdate = bridge;
    }, { version, bridge });
    await fixture.page.goto(origin + '/dashboard', { waitUntil: 'domcontentloaded' });
    await fixture.page.locator('h1').waitFor();
    await run(fixture.page, value => { current = value; }, () => calls);
    await checkLayout(fixture.page, name); assert.deepEqual(fixture.errors, []);
    results.push({ name, width, mode, pass: true }); console.log('PASS ' + name);
  } catch (error) { results.push({ name, width, mode, pass: false, error: error.message, errors: fixture.errors }); console.log('FAIL ' + name + ': ' + error.message); }
  finally { await fixture.context.close(); }
}
try {
  for (const [width, mode] of [[320, 'LIGHT'], [390, 'DARK'], [1280, 'LIGHT']]) await scenario(`older app ${width}`, width, mode, async page => {
    const notice = page.getByRole('region', { name: 'App update available' }); await notice.waitFor();
    assert.equal(await notice.getByRole('link', { name: 'Update app', exact: true }).getAttribute('href'), 'https://play.google.com/store/apps/details?id=in.fcarena.app');
    await page.screenshot({ path: `.cache/app-update-notice/banner-${width}-${mode}.png`, fullPage: false });
  });
  await scenario('regular browser stays quiet', 390, 'LIGHT', async (page, _, calls) => {
    assert.equal(calls(), 0); assert.equal(await page.getByRole('region', { name: 'App update available' }).count(), 0);
  }, { native: false });
  await scenario('current version stays quiet', 390, 'DARK', async (page, _, calls) => {
    await page.waitForFunction(() => document.readyState === 'complete'); assert(calls() > 0);
    assert.equal(await page.getByRole('region', { name: 'App update available' }).count(), 0);
  }, { version: '1.0.18', policy: { updateAvailable: false, latest: null } });
  await scenario('Later persists and a newer release still appears', 390, 'DARK', async (page, setPolicy) => {
    const notice = page.getByRole('region', { name: 'App update available' }); await notice.waitFor();
    await notice.getByRole('button', { name: 'Remind me later' }).click(); await notice.waitFor({ state: 'hidden' });
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('h1').waitFor();
    assert.equal(await notice.count(), 0);
    setPolicy(available(21)); await page.reload({ waitUntil: 'domcontentloaded' }); await notice.waitFor();
    await notice.getByText('Update available · 1.0.19', { exact: true }).waitFor();
  });
  await scenario('Play eligible release appears without a registry entry', 390, 'DARK', async page => {
    await page.getByRole('region', { name: 'App update available' }).waitFor();
  }, { version: '1.0.18', policy: { updateAvailable: false, latest: null }, bridge: { checked: true, available: true, installedVersionCode: 20, availableVersionCode: 21 } });
  await scenario('Play rollout eligibility suppresses a global announcement', 390, 'LIGHT', async page => {
    await page.waitForFunction(() => document.readyState === 'complete');
    assert.equal(await page.getByRole('region', { name: 'App update available' }).count(), 0);
  }, { bridge: { checked: true, available: false, installedVersionCode: 19, availableVersionCode: 0 } });
  await scenario('native update event appears while the app is in use', 320, 'DARK', async page => {
    assert.equal(await page.getByRole('region', { name: 'App update available' }).count(), 0);
    await page.evaluate(() => { window.__fcAndroidUpdate = { checked: true, available: true, installedVersionCode: 20, availableVersionCode: 21 }; window.dispatchEvent(new Event('fc-arena:android-update')); });
    await page.getByRole('region', { name: 'App update available' }).waitFor();
  }, { version: '1.0.18', policy: { updateAvailable: false, latest: null } });
} finally {
  await browser.close(); await writeFile('.cache/app-update-notice/browser-results.json', JSON.stringify(results, null, 2));
}
if (results.some(result => !result.pass)) process.exitCode = 1;
