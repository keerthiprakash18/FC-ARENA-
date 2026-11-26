// Synthetic API fixtures only: never read or mutate production player data.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { chromium } from 'playwright';
import { checkLayout, createUiContext } from './phase-ui-harness.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-mobile-ui';
const featured = { tournaments: [], leagues: [], seasons: [], recentHonours: [] };
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
let checks = 0;

function searchData(query, type, name) {
  return {
    query, type, minimumQueryLength: 2, total: 1,
    players: [{ userId: `fixture-${name.replaceAll(' ', '-')}`, fullName: name, inGameName: null,
      playerCode: 'DISCOVER-TEST', profileImageUrl: null, honours: 0 }],
    leagues: [], tournaments: [], seasons: [],
  };
}

async function searchContext({ featuredFailure = false } = {}) {
  const pending = [];
  let featuredReads = 0;
  const f = await createUiContext(browser, {
    width: 390, mode: 'DARK', native: true, direct: true,
    overrides: {
      '/api/discover/featured': (route, headers) => {
        featuredReads++;
        return route.fulfill({ headers, status: featuredFailure && featuredReads <= 2 ? 503 : 200,
          json: featuredFailure && featuredReads <= 2
            ? { success: false, data: null, error: { message: 'Fixture featured outage.' } }
            : { success: true, data: featured, error: null } });
      },
      '/api/discover': (route, headers) => new Promise(resolve => {
        const url = new URL(route.request().url());
        pending.push({ route, headers, resolve, query: url.searchParams.get('q'), type: url.searchParams.get('type'), released: false });
      }),
    },
  });
  const network = [];
  f.page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) network.push(`request ${request.method()} ${request.url()}`); });
  f.page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/')) network.push(`response ${response.status()} ${response.url()}`); });
  f.page.on('requestfailed', request => network.push(`failed ${request.url()} ${request.failure()?.errorText}`));
  async function request(query, type = 'all', occurrence = 0) {
    await expect.poll(() => pending.filter(row => row.query === query && row.type === type).length,
      { message: `Waiting for disposable ${query}/${type} search request` }).toBeGreaterThan(occurrence);
    return pending.filter(row => row.query === query && row.type === type)[occurrence];
  }
  async function release(row, name, failure = false) {
    assert.equal(row.released, false, 'Each fixture response is released once');
    row.released = true;
    try {
      await row.route.fulfill({ headers: row.headers, status: failure ? 503 : 200,
        json: failure ? { success: false, data: null, error: { message: 'Fixture search outage.' } }
          : { success: true, data: searchData(row.query, row.type, name), error: null } });
    } catch (error) {
      // Superseded requests are deliberately cancelled by the browser. The
      // response still must be released here so route handlers cannot hang.
      if (!/closed|cancel|abort|handled|invalid interception/i.test(String(error))) throw error;
    } finally { row.resolve(); }
  }
  return { ...f, request, release, network, featuredReads: () => featuredReads,
    async close() { for (const row of pending.filter(item => !item.released)) await release(row, 'Discarded fixture'); await f.context.close(); } };
}

try {
  const f = await searchContext();
  try {
    const page = f.page;
    await page.goto(origin + '/discover');
    await page.getByRole('heading', { name: 'FC Arena Leagues', exact: true }).waitFor().catch(async error => {
      console.error('Discover fixture failed to load:', page.url(), await page.locator('body').innerText(), f.errors, f.network);
      await page.screenshot({ path: join(output, 'next-discover-load-failure.png'), fullPage: true });
      throw error;
    });
    const search = page.getByRole('searchbox', { name: 'Search FC Arena', exact: true });
    const results = page.getByRole('region', { name: 'Search results', exact: true });
    const filters = page.getByRole('group', { name: 'Filter search results', exact: true });

    await search.fill('Alpha'); const alpha = await f.request('Alpha');
    await expect(results).toHaveAttribute('aria-busy', 'true');
    await page.screenshot({ path: join(output, 'next-discover-loading-390-dark.png'), fullPage: true });
    await search.fill('Beta'); const beta = await f.request('Beta');
    await f.release(beta, 'Latest Beta Player');
    await expect(page.getByText('Latest Beta Player', { exact: true })).toBeVisible();
    await f.release(alpha, 'Stale Alpha Player');
    await expect(page.getByText('Stale Alpha Player', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Latest Beta Player', { exact: true })).toBeVisible();
    checks++;

    await search.fill('Gamma'); const gamma = await f.request('Gamma');
    await search.fill('Delta'); const delta = await f.request('Delta');
    await f.release(delta, 'Latest Delta Player');
    await expect(page.getByText('Latest Delta Player', { exact: true })).toBeVisible();
    await f.release(gamma, '', true);
    await expect(page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ })).toHaveCount(0);
    await expect(page.getByText('Latest Delta Player', { exact: true })).toBeVisible();
    await expect(results).toHaveAttribute('aria-busy', 'false');
    checks++;

    await search.fill('Filter'); const all = await f.request('Filter');
    await filters.getByRole('button', { name: 'Players', exact: true }).click();
    const players = await f.request('Filter', 'players');
    await f.release(players, 'Filtered Player');
    await expect(page.getByText('Filtered Player', { exact: true })).toBeVisible();
    await f.release(all, 'Stale All Player');
    await expect(page.getByText('Stale All Player', { exact: true })).toHaveCount(0);
    await expect(filters.getByRole('button', { name: 'Players', exact: true })).toHaveAttribute('aria-pressed', 'true');
    checks++;

    await search.fill('Clear'); const clear = await f.request('Clear', 'players');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await f.release(clear, 'Stale Cleared Player');
    await expect(search).toHaveValue('');
    await expect(results).toHaveCount(0);
    await expect(page.getByText('Stale Cleared Player', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'FC Arena Leagues', exact: true })).toBeVisible();
    checks++;

    await search.fill('Retry'); const failed = await f.request('Retry', 'players');
    await f.release(failed, '', true);
    // The shared transport retries a safe GET once. Exhaust that retry before
    // exercising the page's explicit recovery action.
    const transportRetry = await f.request('Retry', 'players', 1);
    await f.release(transportRetry, '', true);
    await expect(page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ })).toContainText('Search is unavailable');
    await page.screenshot({ path: join(output, 'next-discover-error-390-dark.png'), fullPage: true });
    await page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ }).getByRole('button', { name: 'Try again', exact: true }).click();
    const retried = await f.request('Retry', 'players', 2);
    await f.release(retried, 'Recovered Player');
    await expect(page.getByText('Recovered Player', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ })).toHaveCount(0);
    await checkLayout(page, 'Discover recovered mobile search');
    await page.screenshot({ path: join(output, 'next-discover-search-390-dark.png'), fullPage: true });
    assert.deepEqual(f.errors, []); assert.deepEqual(f.mutations, []);
    checks++;
  } finally { await f.close(); }

  const unavailable = await searchContext({ featuredFailure: true });
  try {
    const page = unavailable.page;
    await page.goto(origin + '/discover');
    await expect(page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ })).toContainText('Discover could not be loaded');
    await page.getByRole('searchbox', { name: 'Search FC Arena', exact: true }).fill('Public');
    const request = await unavailable.request('Public');
    await unavailable.release(request, 'Public Fixture Player');
    await expect(page.getByText('Public Fixture Player', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ }).getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'FC Arena Leagues', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /Search is unavailable|Discover could not be loaded/ })).toHaveCount(0);
    assert.equal(unavailable.featuredReads(), 3);
    assert.deepEqual(unavailable.errors, []); assert.deepEqual(unavailable.mutations, []);
    checks++;
  } finally { await unavailable.close(); }

  const expectedLinks = {
    'Your experience': ['/settings/appearance', '/settings/notifications', '/settings/dashboard'],
    'Account & privacy': ['/profile/date-of-birth', '/safety', '/privacy'],
    'Account data': ['/account-deletion'],
  };
  for (const width of [320, 390, 1280]) for (const mode of ['LIGHT', 'DARK']) {
    const settings = await createUiContext(browser, { width, mode, native: width < 500, direct: true });
    try {
      const page = settings.page;
      await page.goto(origin + '/settings');
      await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
      for (const [name, hrefs] of Object.entries(expectedLinks)) {
        const region = page.getByRole('region', { name, exact: true });
        await expect(region).toBeVisible();
        assert.deepEqual(await region.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href'))), hrefs);
      }
      await expect(page.getByRole('link', { name: 'Edit profile', exact: true })).toHaveAttribute('href', '/profile');
      await checkLayout(page, `Settings ${width}px ${mode}`);
      await page.screenshot({ path: join(output, `next-settings-${width}-${mode.toLowerCase()}.png`), fullPage: true });
      assert.deepEqual(settings.errors, []); assert.deepEqual(settings.mutations, []);
      checks++;
    } finally { await settings.context.close(); }
  }
  console.log(`PASS ${checks} Discover concurrency/recovery and Settings responsive scenarios; zero API mutations.`);
} finally { await browser.close(); }
