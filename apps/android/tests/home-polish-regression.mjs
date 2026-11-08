import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, career, user, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const cup = { ...phaseData['/api/tournaments/phase3'].tournament, status: 'ACTIVE', leagueId: 'phase3', leagueName: 'Arena League' };
const fixture = { id: 'home-fixture', sequence: 1, matchday: 1, roundName: 'MATCHDAY 1', status: 'SCHEDULED',
  scheduledAt: new Date(Date.now() + 86400000).toISOString(), tournamentId: 'phase3', tournamentName: cup.name,
  leagueId: 'phase3', leagueName: 'Arena League', match: { id: 'phase3', status: 'SCHEDULED' },
  home: { id: 'home', entryName: 'Home Club', members: [{ id: user.id, fullName: user.fullName, inGameName: 'Player One' }] },
  away: { id: 'away', entryName: 'Away Club', members: [{ id: 'opponent', fullName: 'Away Player', inGameName: 'Away FC' }] } };

async function contextFor(width, mode, scenario = 'empty') {
  const active = scenario === 'active' || scenario === 'hidden';
  const noProfile = scenario === 'profile';
  let reads = 0;
  const currentUser = noProfile ? { ...user, player: { ...user.player, identity: null } } : user;
  const data = { career: noProfile ? { ...career, profile: { ...career.profile, identity: null } } : career,
    memberships: active ? phaseData['/api/leagues/my'].leagues : [], tournaments: active ? [cup] : [], fixtures: active ? [fixture] : [] };
  const result = await createUiContext(browser, { width, mode, direct: true, native: width < 500,
    overrides: {
      '/api/auth/me': { user: currentUser },
      '/api/auth/preferences/dashboard': { preferences: { hiddenSections: scenario === 'hidden'
        ? ['nextMatch', 'league', 'activeTournament', 'stats', 'quickActions', 'activity'] : [] } },
      '/api/players/me/dashboard': (route, headers) => {
        reads++;
        return route.fulfill({ headers, json: { success: true, data, error: null } });
      },
    }, onMutation: (route, headers) => {
      assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
      return route.fulfill({ status: 204, headers });
    },
  });
  return { ...result, reads: () => reads };
}

try {
  for (const width of [320, 390, 1280]) for (const mode of ['LIGHT', 'DARK']) {
    const f = await contextFor(width, mode);
    try {
      await f.page.goto(origin + '/dashboard');
      const action = f.page.locator('.premium-home-hero').getByRole('link', { name: /Join a League/ });
      await action.waitFor();
      assert.equal(await action.getAttribute('href'), '/leagues');
      const button = await action.boundingBox();
      assert(button.height >= 44 && button.y + button.height < 778, 'First action must be visible above mobile navigation');
      assert.equal(await f.page.locator('.fc-main .theme-primary-button').count(), 1, 'Empty Home has one clear primary action');
      assert.equal(await f.page.locator('.home-empty-row').count(), 3, 'Empty competition information remains available in three compact rows');
      assert.equal(await f.page.locator('.fc-next-match-panel,.fc-league-panel,.fc-tournament-panel').count(), 0);
      if (width < 500) {
        const height = await f.page.evaluate(() => document.documentElement.scrollHeight);
        assert(height < 1750, `Empty mobile Home should fit a compact reading flow: ${height}`);
        const hero = await f.page.locator('.premium-home-hero').boundingBox();
        assert(hero.height < 285, `Welcome should not dominate the first screen: ${hero.height}`);
      }
      assert.equal(await f.page.locator('.home-core-actions > a').count(), 4);
      const tools = f.page.locator('.home-more-tools');
      assert.equal(await tools.getByRole('link', { name: /Awards/ }).count(), 0);
      await tools.locator('summary').focus(); await f.page.keyboard.press('Enter');
      await tools.getByRole('link', { name: /Awards/ }).waitFor();
      assert.equal(await tools.getByRole('link', { name: /League War/ }).getAttribute('href'), '/league-war');
      assert.equal(await tools.getByRole('link', { name: /Update Profile/ }).getAttribute('href'), '/profile');
      const before = f.reads();
      await f.page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await f.page.waitForTimeout(300);
      assert(f.reads() <= before + 1, 'Foreground refresh must not fan out into duplicate dashboard reads');
      assert.equal(await tools.getAttribute('open'), '', 'A background refresh preserves expanded tools');
      await tools.locator('summary').focus(); await f.page.keyboard.press('Enter');

      const onboarding = f.page.getByRole('region', { name: 'Getting started', exact: true });
      const steps = onboarding.locator('nav');
      assert.equal(await steps.isVisible(), false, 'Getting-started detail is initially compact');
      await onboarding.locator('summary').focus(); await f.page.keyboard.press('Enter');
      assert.equal(await steps.getByRole('link').count(), 3);
      await onboarding.getByRole('button', { name: 'Dismiss', exact: true }).click();
      assert.equal(await f.page.evaluate(() => localStorage.getItem('fc-onboarding:phase3')), 'dismissed');
      await f.page.reload(); await action.waitFor();
      assert.equal(await f.page.getByRole('region', { name: 'Getting started', exact: true }).count(), 0);
      await checkLayout(f.page, `Home ${width}px ${mode}`); assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px ${mode}: compact empty Home, one leading action, keyboard disclosures and persisted dismissal`);
    } finally { await f.context.close(); }
  }

  for (const width of [320, 390, 1280]) {
    const f = await contextFor(width, 'DARK', 'active');
    try {
      await f.page.goto(origin + '/dashboard');
      const match = f.page.locator('.fc-next-match-panel');
      const action = match.getByRole('link', { name: /^View Match/ }); await action.waitFor();
      assert.equal(await action.getAttribute('href'), '/matches/phase3');
      assert.equal(await f.page.locator('.premium-home-hero .theme-primary-button').count(), 0, 'The real match keeps the primary action');
      const jump = f.page.getByRole('link', { name: /See next match/ });
      assert.equal(await jump.getAttribute('href'), '#dashboard-next-match');
      const metrics = await action.boundingBox();
      if (width === 390) assert(metrics.y + metrics.height < 778, 'The next-match action must be in the first mobile screen');
      await jump.click();
      const target = await f.page.locator('#dashboard-next-match').boundingBox();
      const header = await f.page.locator('.theme-top-header').boundingBox();
      assert(target.y >= header.y + header.height - 1, 'Sticky header must not hide the next-match anchor');
      await match.getByRole('button', { name: 'View players representing Away Club', exact: true }).click();
      await f.page.getByRole('dialog').getByText('Away Player', { exact: true }).waitFor();
      await f.page.keyboard.press('Escape');
      assert.equal(await f.page.locator('.home-empty-row').count(), 0);
      await checkLayout(f.page, `Active Home ${width}px`); assert.deepEqual(f.errors, []);
      console.log(`PASS ${width}px: match action, opponent details and header-safe jump remain accessible`);
    } finally { await f.context.close(); }
  }

  for (const scenario of ['profile', 'hidden']) {
    const f = await contextFor(390, 'LIGHT', scenario);
    try {
      await f.page.goto(origin + '/dashboard');
      const action = f.page.locator('.premium-home-hero').getByRole('link', { name: scenario === 'profile' ? /Complete Profile/ : /Open Match Centre/ });
      await action.waitFor(); assert.equal(await action.getAttribute('href'), scenario === 'profile' ? '/profile' : '/matches/phase3');
      if (scenario === 'hidden') {
        assert.equal(await f.page.locator('.fc-next-match-panel,.fc-league-panel,.fc-tournament-panel,.home-empty-row').count(), 0);
        assert.equal(await f.page.locator('.home-overview-stats').isVisible(), false);
        assert.equal(await f.page.locator('.fc-quick-actions-panel').isVisible(), false);
        assert.equal(await f.page.locator('.fc-activity-panel').isVisible(), false);
      }
      assert.deepEqual(f.errors, []); await checkLayout(f.page, scenario);
      console.log(`PASS ${scenario}: the right next action and saved section preferences are respected`);
    } finally { await f.context.close(); }
  }
} finally { await browser.close(); }
