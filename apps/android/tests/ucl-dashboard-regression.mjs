import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, career, user } from './phase-ui-harness.mjs';
import { describeTournamentFormat } from '../../api/dist/tournaments/tournament-format-guide.js';
import { phaseData } from './phase-ui-fixtures.mjs';

// Local production build plus intercepted fixture APIs only; no live account.
const output = process.env.UCL_SCREENSHOTS;
if (output) fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox'] });
try {
  for (const width of [360, 390, 1280]) {
    const tournament = { ...phaseData['/api/tournaments/phase3'].tournament,
      name: 'UCL Test Cup', competitionFormat: 'UCL_CUP', groupMode: 'SINGLE_GROUP',
      status: 'ACTIVE', approvedEntries: 36, maxEntries: 36, isLeagueAdmin: true };
    tournament.formatGuide = describeTournamentFormat({ ...tournament, playoffSource: 'AUTO', playoffFormat: 'GLOBAL_SEEDED', playoffSeedingBasis: 'AUTO', legType: 'SINGLE_LEG', _count: { registrations: 36 }, groups: [] });
    let entries = phaseData['/api/tournaments/phase3/entries'].entries.map((entry, index) => ({ ...entry,
      fixtureCount: 1, members: [{ user: { id: index ? 'opponent' : user.id,
        fullName: `Player ${index + 1}`, player: { playerCode: `FCA-P-00000${index + 1}`, identity: null } } }] }));
    const home = { id: 'entry-1', entryName: 'Home Team', members: [{ id: user.id, fullName: user.fullName, inGameName: 'Player One' }] };
    const away = { id: 'entry-2', entryName: 'Away Team', members: [{ id: 'opponent', fullName: 'Opponent', inGameName: 'Opponent' }] };
    let personalFixtures = [{ id: 'fixture-1', sequence: 1, matchday: 1, roundName: 'MATCHDAY 1',
      status: 'UNSCHEDULED', scheduledAt: null, home, away, match: { id: 'phase3', status: 'UNSCHEDULED' },
      tournamentId: 'phase3', tournamentName: tournament.name, leagueId: 'phase3', leagueName: 'Arena League' }];
    let resultState = { isLeagueAdmin: true, canVerifyResult: true, confirmedResultSubmissionId: null, submissions: [] };
    const api = data => ({ success: true, data, error: null });
    const { context, page, errors, mutations } = await createUiContext(browser, { width, mode: 'DARK', overrides: {
      '/api/auth/preferences/dashboard': { preferences: { hiddenSections: [] } },
      '/api/players/me/dashboard': route => route.fulfill({ json: api({ career,
        memberships: phaseData['/api/leagues/my'].leagues, tournaments: [{ ...tournament, leagueName: 'Arena League' }], fixtures: personalFixtures }) }),
      '/api/leagues/phase3/tournaments': { tournaments: [tournament] },
      '/api/tournaments/phase3': { tournament },
      '/api/tournaments/phase3/entries': route => route.fulfill({ json: api({ entries, maxEntries: 36 }) }),
      '/api/tournaments/phase3/wizard': { ...phaseData['/api/tournaments/phase3/wizard'], configuration: {
        competitionFormat: 'UCL_CUP', groupMode: 'SINGLE_GROUP', qualifiersPerGroup: null,
        playoffFormat: 'PROTECTED_SEED', playoffSource: 'OVERALL_STANDINGS', playoffSeedingBasis: 'OVERALL_PERFORMANCE', playoffQualifiersTotal: 24, avoidSameGroupEarly: false,
      } },
      '/api/matches/phase3': { match: { ...phaseData['/api/matches/phase3'].match, isLeagueAdmin: true,
        tournament, fixture: { ...phaseData['/api/matches/phase3'].match.fixture, home, away, roundName: 'UCL FINAL', matchday: null } } },
      '/api/matches/phase3/results': route => route.fulfill({ json: api(resultState) }),
    }, onMutation: (route, headers) => {
      const url = new URL(route.request().url());
      const body = route.request().postDataJSON();
      if (url.pathname.includes('/entries/')) {
        assert.equal(Object.hasOwn(body, 'playerCodes'), false, 'Display edits must not replace locked rosters');
        entries = entries.map(entry => entry.id === 'entry-1' ? { ...entry, entryName: body.entryName } : entry);
      }
      if (url.pathname.endsWith('/confirm')) resultState = { isLeagueAdmin: true, canVerifyResult: true,
        confirmedResultSubmissionId: 'ucl-result', submissions: [{ id: 'ucl-result', status: 'CONFIRMED',
          homeScore: 1, awayScore: 1, homePenaltyScore: 5, awayPenaltyScore: 4,
          createdAt: new Date().toISOString(), rejectionReason: null, submittedBy: user, reviewedBy: user }] };
      return route.fulfill({ headers, json: api({ message: 'Saved', submission: { id: 'ucl-result' } }) });
    } });
    await page.goto('https://fcarena.in/dashboard');
    try { await page.getByRole('heading', { name: 'Fixture Ready', exact: true }).waitFor({ timeout: 10_000 }); }
    catch (error) {
      console.error(JSON.stringify({ url: page.url(), errors, body: (await page.locator('body').innerText()).slice(0, 2200) }));
      if (output) await page.screenshot({ path: path.join(output, `failure-${width}.png`), fullPage: true });
      throw error;
    }
    await checkLayout(page, `dashboard ${width}`);
    if (output) await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true });
    personalFixtures = personalFixtures.map(fixture => ({ ...fixture, status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), match: { id: 'phase3', status: 'SCHEDULED' } }));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', { name: 'Pending Match', exact: true }).waitFor();

    await page.goto('https://fcarena.in/tournaments/phase3/wizard/teams');
    await page.getByRole('button', { name: 'Edit Details', exact: true }).first().click();
    const teamName = page.getByRole('textbox', { name: 'Team name for Competition Entry 1', exact: true });
    await teamName.fill('Corrected team');
    assert.equal(await page.getByRole('textbox', { name: 'Player IDs for Competition Entry 1' }).isDisabled(), true);
    await checkLayout(page, `entry edit ${width}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Corrected team', { exact: true }).first().waitFor();

    await page.goto('https://fcarena.in/ucl-cup/phase3');
    await page.getByRole('region', { name: 'Tournament format and qualification' }).getByRole('heading', { name: 'UCL Cup', exact: true }).waitFor();
    await checkLayout(page, `ucl format ${width}`);
    if (output) await page.screenshot({ path: path.join(output, `ucl-guide-${width}.png`), fullPage: true });

    await page.goto('https://fcarena.in/matches/phase3');
    const form = page.locator('#result-entry form');
    await form.locator('[name=homeScore]').fill('1');
    await form.locator('[name=awayScore]').fill('1');
    await form.locator('[name=homePenaltyScore]').fill('5');
    await form.locator('[name=awayPenaltyScore]').fill('4');
    await checkLayout(page, `ucl penalty form ${width}`);
    if (output) { await form.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `ucl-penalties-${width}.png`) }); }
    await form.getByRole('button', { name: 'Save Result & Update Stats' }).click();
    await page.getByText('Penalties 5–4 · Home Team win', { exact: true }).waitFor();
    const submission = mutations.find(mutation => mutation.path === '/api/matches/phase3/results');
    assert.deepEqual(JSON.parse(submission.body), { homeScore: 1, awayScore: 1, homePenaltyScore: 5, awayPenaltyScore: 4 });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px: generated/pending dashboard fixtures, locked-roster display edit, UCL guide and penalty submission`);
  }
} finally { await browser.close(); }
