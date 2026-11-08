import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { tournament as baseTournament } from './phase-ui-fixtures.mjs';

// Intercept every API request. No production account or data is used.
const output = process.env.ENTRY_LIMIT_SCREENSHOTS;
if (output) fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 1280]) {
    const tournament = { ...baseTournament, status: 'REGISTRATION_OPEN', maxEntries: 20,
      approvedEntries: 20, isLeagueAdmin: true, canManageSettings: true, canExtendEntryLimit: true,
      entryLimitLockedReason: null };
    let rejectSave = false;
    const entries = Array.from({ length: 20 }, (_, index) => ({
      id: `entry-${index}`, entryName: `Team ${index + 1}`, entryLogoUrl: null,
      sortOrder: index, status: 'APPROVED', fixtureCount: 0,
      members: [{ user: { id: `player-${index}`, fullName: `Player ${index + 1}`,
        player: { playerCode: `FCA-${index}`, identity: null } } }],
    }));
    const { context, page, errors, mutations } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
      '/api/tournaments/phase3': route => route.fulfill({ json: { success: true, data: { tournament }, error: null } }),
      '/api/tournaments/phase3/entries': { entries },
      '/api/security/roles/TOURNAMENT/phase3': { assignments: [] },
    }, onMutation: (route, headers) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
      assert.equal(pathname, '/api/tournaments/phase3/entry-limit');
      assert.equal(route.request().method(), 'PATCH');
      const body = route.request().postDataJSON();
      assert.deepEqual(Object.keys(body), ['maxEntries']);
      if (rejectSave) return route.fulfill({ status: 409, headers,
        json: { success: false, data: null, error: { code: 'TOURNAMENT_ENTRY_LIMIT_LOCKED', message: 'Fixtures have already been generated.' } } });
      const previousMaxEntries = tournament.maxEntries;
      tournament.maxEntries = body.maxEntries;
      return route.fulfill({ headers, json: { success: true,
        data: { previousMaxEntries, maxEntries: body.maxEntries, message: `Entry limit extended from ${previousMaxEntries} to ${body.maxEntries}.` }, error: null } });
    } });

    await page.goto('https://fcarena.in/tournaments/phase3/settings');
    await page.getByRole('button', { name: 'Edit Entry Limit', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'New entry limit' }).fill('22');
    await page.getByRole('button', { name: 'Save Entry Limit', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '20 to 22' }).waitFor();
    assert.equal(tournament.maxEntries, 22);
    await checkLayout(page, `extended entry limit ${width}`);
    if (output) await page.screenshot({ path: path.join(output, `extended-${width}.png`), fullPage: true });

    for (const route of ['teams', 'registration', 'wizard/teams']) {
      await page.goto(`https://fcarena.in/tournaments/phase3/${route}`);
      await page.getByRole('button', { name: 'Edit Entry Limit', exact: true }).waitFor();
      await page.getByText('Current limit:', { exact: false }).filter({ hasText: '22' }).waitFor();
      await checkLayout(page, `${route} entry limit ${width}`);
    }

    rejectSave = true;
    await page.getByRole('button', { name: 'Edit Entry Limit', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'New entry limit' }).fill('23');
    await page.getByRole('button', { name: 'Save Entry Limit', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Fixtures have already been generated.' }).waitFor();
    assert.equal(tournament.maxEntries, 22);

    tournament.canExtendEntryLimit = false;
    tournament.entryLimitLockedReason = 'The entry limit is locked because fixtures have already been generated.';
    await page.goto('https://fcarena.in/tournaments/phase3/settings');
    await page.getByText(tournament.entryLimitLockedReason, { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Edit Entry Limit', exact: true }).count(), 0);

    tournament.canManageSettings = false;
    await page.goto('https://fcarena.in/tournaments/phase3/settings');
    await page.getByText('Configuration', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Entry Limit', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    assert.equal(mutations.filter(mutation => mutation.path.endsWith('/entry-limit')).length, 2);
    await context.close();
    console.log(`PASS ${width}px: 20-to-22 save, all four editor locations, rejected save, fixture lock and settings permissions`);
  }
} finally { await browser.close(); }
