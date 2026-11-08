import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament as baseTournament } from './phase-ui-fixtures.mjs';

const output = process.env.FLEXIBLE_FIXTURE_SCREENSHOTS;
if (output) fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 1280]) {
    const tournament = { ...baseTournament, status: 'REGISTRATION_OPEN', maxEntries: 24, approvedEntries: 23,
      competitionFormat: 'UCL_CUP', groupMode: 'SINGLE_GROUP', isLeagueAdmin: true, canManageSettings: true,
      canEditEntryLimit: true, canPrepareFixtures: true, pendingEntries: 0 };
    let entries = Array.from({ length: 23 }, (_, i) => ({ id: `entry-${i}`, entryName: `Club ${i + 1}`,
      status: 'APPROVED', entryLogoUrl: null, fixtureCount: 0, sortOrder: i,
      members: [{ user: { id: `user-${i}`, fullName: `Player ${i}`, player: { playerCode: `FCA-${i}`, identity: null } } }] }));
    const api = data => ({ success: true, data, error: null });
    const { context, page, errors, mutations } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
      '/api/tournaments/phase3': route => route.fulfill({ json: api({ tournament }) }),
      '/api/tournaments/phase3/entries': route => route.fulfill({ json: api({ entries, maxEntries: tournament.maxEntries }) }),
      '/api/tournaments/phase3/registrations': route => route.fulfill({ json: api({ registrations: entries }) }),
      '/api/security/roles/TOURNAMENT/phase3': { assignments: [] },
      '/api/tournaments/phase3/fixtures': { tournament, fixtures: [] },
      '/api/tournaments/phase3/wizard/fixture-preview': { ...phaseData['/api/tournaments/phase3/wizard/fixture-preview'], tournament },
    }, onMutation: (route, headers) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
      if (p.endsWith('/entries/entry-22')) {
        assert.equal(route.request().method(), 'DELETE');
        entries = entries.filter(entry => entry.id !== 'entry-22');
        // Keep the old tournament summary deliberately stale to test the post-removal minimum.
        return route.fulfill({ headers, json: api({ message: 'Removed' }) });
      }
      if (p.endsWith('/entry-limit')) {
        const previousMaxEntries = tournament.maxEntries;
        const { maxEntries } = route.request().postDataJSON();
        assert(maxEntries >= entries.filter(entry => entry.status === 'APPROVED').length);
        tournament.maxEntries = maxEntries;
        return route.fulfill({ headers, json: api({ maxEntries, message: `Entry limit updated from ${previousMaxEntries} to ${maxEntries}.` }) });
      }
      if (p.endsWith('/prepare-fixtures')) {
        assert.equal(tournament.maxEntries, 24);
        assert.equal(entries.length, 22);
        tournament.status = 'REGISTRATION_CLOSED';
        return route.fulfill({ headers, json: api({ approvedEntries: 22, maxEntries: 24, nextStep: 'FIXTURE_SETTINGS' }) });
      }
      assert(['/api/tournaments/phase3/wizard/fixture-settings', '/api/tournaments/phase3/wizard/fixture-preview/generate'].includes(p));
      return route.fulfill({ headers, json: api({ message: 'Saved' }) });
    } });

    await page.goto('https://fcarena.in/tournaments/phase3/teams');
    await page.getByRole('button', { name: 'Create Fixtures with 23 Teams', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Create Fixtures with 23 Teams', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Delete Team', exact: true }).last().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete team', exact: true }).click();
    await page.getByText('22 of 24 Tournament entry slots currently contain real team data.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit Entry Limit', exact: true }).click();
    const input = page.getByRole('spinbutton', { name: 'New entry limit' });
    assert.equal(await input.getAttribute('min'), '22');
    await input.fill('21');
    assert.equal(await input.evaluate(element => element.checkValidity()), false);
    await input.fill('22');
    await page.getByRole('button', { name: 'Save Entry Limit', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '24 to 22' }).waitFor();
    await page.getByRole('button', { name: 'Edit Entry Limit', exact: true }).click();
    await input.fill('24');
    await page.getByRole('button', { name: 'Save Entry Limit', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '22 to 24' }).waitFor();
    const create = page.getByRole('button', { name: 'Create Fixtures with 22 Teams', exact: true });
    assert.equal(await create.isEnabled(), true);
    await checkLayout(page, `flexible fixtures ${width}`);
    if (output) { await create.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `ready-${width}.png`) }); }
    await create.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert(!mutations.some(mutation => mutation.path.endsWith('/prepare-fixtures')));
    await create.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Continue to Fixture Setup', exact: true }).click();
    await page.waitForURL('**/wizard/fixture-settings');
    await page.getByRole('button', { name: 'Generate Preview →', exact: true }).click();
    await page.waitForURL('**/wizard/fixture-preview');
    await page.getByRole('heading', { name: 'Fixture Preview', exact: true }).waitFor();
    assert(mutations.some(mutation => mutation.path.endsWith('/fixture-preview/generate')));

    tournament.status = 'REGISTRATION_OPEN';
    entries[0].status = 'PENDING';
    await page.goto('https://fcarena.in/tournaments/phase3/teams');
    const pendingButton = page.getByRole('button', { name: 'Create Fixtures with 21 Teams', exact: true });
    await pendingButton.waitFor();
    assert.equal(await pendingButton.isDisabled(), true);
    await page.getByText('Review 1 pending registration(s) first.', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px: remove team, reduce 24 to 22, increase back, start below capacity, cancel, generate preview and pending guard`);
  }
} finally { await browser.close(); }
