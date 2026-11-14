import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, career, user, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 1280]) {
    const tournament = { ...phaseData['/api/tournaments/phase3'].tournament, status: 'ACTIVE', leagueId: 'phase3', leagueName: 'Arena League' };
    let fixture = { id: 'fixture', sequence: 1, matchday: 1, roundName: 'MATCHDAY 1', status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 48 * 3600000).toISOString(), tournamentId: 'phase3', tournamentName: tournament.name,
      leagueId: 'phase3', leagueName: 'Arena League', match: { id: 'phase3', status: 'SCHEDULED' },
      home: { id: 'home', entryName: 'My Club', entryLogoUrl: null, members: [{ id: user.id, fullName: 'Home Player', inGameName: 'Home FC' }] },
      away: { id: 'away', entryName: 'Opponent Club', entryLogoUrl: null, members: [{ id: 'opponent', fullName: 'Ravi Kumar', inGameName: 'Ravi FC' }] } };
    const { context, page, errors } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
      '/api/auth/preferences/dashboard': { preferences: { hiddenSections: [] } },
      '/api/players/me/dashboard': route => route.fulfill({ json: { success: true,
        data: { career, memberships: phaseData['/api/leagues/my'].leagues, tournaments: [tournament], fixtures: [fixture] }, error: null } }),
    }, onMutation: (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
      return route.fulfill({ status: 204, headers });
    } });
    for (const kind of ['Next Match', "Today’s Match", 'Live Match', 'Pending Match', 'Fixture Ready']) {
      if (kind === "Today’s Match") fixture = { ...fixture, scheduledAt: new Date(Date.now() + 5 * 60000).toISOString() };
      if (kind === 'Live Match') fixture = { ...fixture, status: 'LIVE', match: { id: 'phase3', status: 'LIVE' } };
      if (kind === 'Pending Match') fixture = { ...fixture, status: 'SCHEDULED', scheduledAt: new Date(Date.now() - 2 * 86400000).toISOString(), match: { id: 'phase3', status: 'SCHEDULED' } };
      if (kind === 'Fixture Ready') fixture = { ...fixture, status: 'UNSCHEDULED', scheduledAt: null, match: { id: 'phase3', status: 'UNSCHEDULED' } };
      await page.goto('https://fcarena.in/dashboard');
      const opponent = page.getByRole('button', { name: 'View players representing Opponent Club' });
      await opponent.click();
      const dialog = page.getByRole('dialog', { name: 'Opponent Club — Players', exact: true });
      await dialog.getByText('Ravi Kumar', { exact: true }).waitFor();
      await dialog.getByText('Account name', { exact: true }).waitFor();
      await dialog.getByText('Team / Club: Opponent Club', { exact: true }).waitFor();
      await dialog.getByText('In-game name: Ravi FC', { exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/dashboard');
      await checkLayout(page, `${kind} opponent ${width}`);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await opponent.evaluate(el => document.activeElement === el), true);
      await page.getByRole('button', { name: 'View players representing My Club' }).click();
      await page.getByRole('dialog').getByText('Home Player', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px: Home Next/Today/Live/Pending/Unscheduled match team buttons show the correct players without navigation`);
  }
} finally { await browser.close(); }
