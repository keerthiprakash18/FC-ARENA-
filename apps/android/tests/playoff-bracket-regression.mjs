import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const screenshots = new URL('../../../.cache/playoffs/', import.meta.url);
await mkdir(screenshots, { recursive: true });
const entry = name => ({ id: name, entryName: name, entryLogoUrl: null, members: [] });
const source = (id, outcome = 'WINNER') => ({ id, fixtureCode: id, outcome });
const onMutation = (route, headers) => {
  if (new URL(route.request().url()).pathname === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
  throw new Error(`Unexpected mutation ${route.request().url()}`);
};
function fixture(id, round, position, extra = {}) {
  return { id, fixtureCode: id, sequence: round, roundNumber: round, roundName: `Round ${round}`, phase: 'PLAYOFF', bracketPosition: position,
    matchday: null, scheduledAt: null, venue: null, group: null, status: 'SCHEDULED', home: entry('Alpha'), away: entry('Beta'),
    homeSource: null, awaySource: null, match: { id: `match-${id}`, matchCode: id, status: 'SCHEDULED', confirmedResult: null }, ...extra };
}
const confirmed = (id, homeScore, awayScore) => ({ status: 'COMPLETED', match: { id: `match-${id}`, matchCode: id, status: 'COMPLETED', confirmedResult: { homeScore, awayScore, status: 'CONFIRMED' } } });
const ucl = [fixture('left1', 1, 1, { roundName: 'UCL SEMI-FINAL · LEG 1', matchday: 1, ...confirmed('left1', 2, 1) }),
  fixture('left2', 1, 1, { roundName: 'UCL SEMI-FINAL · LEG 2', matchday: 2, home: entry('Beta'), away: entry('Alpha') }),
  fixture('right1', 1, 2, { roundName: 'UCL SEMI-FINAL · LEG 1', matchday: 1, home: entry('Gamma'), away: entry('Delta'), ...confirmed('right1', 1, 0) }),
  fixture('right2', 1, 2, { roundName: 'UCL SEMI-FINAL · LEG 2', matchday: 2, home: entry('Delta'), away: entry('Gamma'), ...confirmed('right2', 0, 1) }),
  fixture('final', 2, 1, { roundName: 'UCL FINAL', home: null, away: entry('Gamma'), homeSource: source('left2'), awaySource: source('right2') })];
const standard = [fixture('quarter1', 1, 1), fixture('quarter2', 1, 2), fixture('quarter3', 1, 3), fixture('quarter4', 1, 4),
  fixture('semi1', 2, 1, { homeSource: source('quarter1'), awaySource: source('quarter2') }),
  fixture('semi2', 2, 2, { homeSource: source('quarter3'), awaySource: source('quarter4') }),
  fixture('final', 3, 1, { roundName: 'FINAL', homeSource: source('semi1'), awaySource: source('semi2') })];
const doubleChance = [fixture('qualifier', 1, 1, { roundName: 'QUALIFYING FINAL' }), fixture('elimination', 1, 1, { roundName: 'ELIMINATION FINAL' }),
  fixture('second', 2, 1, { roundName: 'SECOND CHANCE', homeSource: source('qualifier', 'LOSER'), awaySource: source('elimination') }),
  fixture('final', 3, 1, { roundName: 'FINAL', homeSource: source('qualifier'), awaySource: source('second') })];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
try {
  for (const width of [390, 1280]) {
    for (const [label, fixtures, competitionFormat, playoffFormat] of [
      ['ucl', ucl, 'UCL_CUP', 'PROTECTED_SEED'], ['standard', standard, 'KNOCKOUT', 'GLOBAL_SEEDED'],
      ['double-chance', doubleChance, 'ELITE_CUP', 'DOUBLE_CHANCE'], ['bye', [standard[0], { ...standard.at(-1), roundNumber: 2, homeSource: source('quarter1'), awaySource: null }], 'KNOCKOUT', 'PROTECTED_SEED'],
    ]) {
      const cup = { ...tournament, name: `Arena ${label} Championship`, competitionFormat, playoffFormat, playoffSource: 'DIRECT_ENTRIES', playoffSeedingBasis: 'MANUAL', isLeagueAdmin: false };
      const { context, page, errors } = await createUiContext(browser, { width, direct: true, native: width === 390, mode: width === 390 ? 'LIGHT' : 'DARK', reducedMotion: width === 390 ? 'reduce' : 'no-preference', onMutation,
        overrides: { '/api/tournaments/phase3': { tournament: cup }, '/api/tournaments/phase3/fixtures': { fixtures },
          '/api/public/tournaments/PHASE3': { ...phaseData['/api/public/tournaments/PHASE3'], tournament: cup, bracketFixtures: fixtures } } });
      try {
        await context.grantPermissions(['local-network-access'], { origin });
        await page.goto(`${origin}/tournaments/phase3/playoffs`);
        const bracket = page.getByRole('region', { name: 'Interactive playoff bracket', exact: true });
        await bracket.waitFor();
        assert.equal(await bracket.locator('button[aria-pressed]').count(), label === 'ucl' ? 3 : fixtures.length);
        const animation = await bracket.locator('button[aria-pressed]').first().evaluate(element => getComputedStyle(element).animationName);
        assert.equal(animation === 'none', width === 390, 'bracket respects the device motion preference');
        await page.getByRole('button', { name: 'Fit bracket', exact: true }).click();
        await bracket.locator('button[aria-pressed]').first().click();
        const selected = await bracket.locator('button[aria-pressed="true"]').evaluate(element => ({
          background: getComputedStyle(element).backgroundColor,
          surface: getComputedStyle(element.closest('[data-bracket-layout]')).backgroundColor,
          focused: getComputedStyle(element).outlineStyle === 'solid',
        }));
        assert.equal(selected.background, selected.surface, 'selected ties use the current theme surface');
        assert.equal(selected.focused, true, 'the selected tie has a visible outline');
        await page.getByRole('region', { name: 'Selected tie details' }).waitFor();
        if (label === 'ucl') {
          assert.match(await page.getByRole('region', { name: 'Selected tie details' }).innerText(), /Leg 1[\s\S]*Leg 2/);
          assert.equal(await page.getByRole('link', { name: 'Open Match Room →', exact: true }).count(), 2);
        }
        if (label === 'double-chance') assert.equal(await bracket.locator('path[data-outcome="LOSER"]').count(), 1);
        await checkLayout(page, `${label} ${width}`);
        await page.getByRole('region', { name: 'Tournament championship bracket', exact: true }).screenshot({ path: new URL(`${label}-bracket-${width}.png`, screenshots).pathname.replace(/^\/(\w:)/, '$1') });
        await page.screenshot({ path: new URL(`${label}-${width}.png`, screenshots).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
        await page.goto(`${origin}/public/tournaments/PHASE3`);
        await page.getByRole('region', { name: 'Interactive playoff bracket', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Fit bracket', exact: true }).click();
        await page.getByRole('region', { name: 'Interactive playoff bracket', exact: true }).locator('button[aria-pressed]').first().click();
        assert.equal(await page.getByRole('link', { name: /Open Match Room/ }).count(), 0);
        await checkLayout(page, `public ${label} ${width}`);
        assert.deepEqual(errors, []);
        console.log(`PASS ${label}: private + public bracket at ${width}px`);
      } finally { await context.close(); }
    }
    let unlocked = false;
    const base = phaseData['/api/matches/phase3'].match;
    const { context, page, errors, mutations } = await createUiContext(browser, { width, direct: true, native: width === 390, mode: 'DARK', onMutation,
      overrides: {
        '/api/matches/phase3': (route, headers) => route.fulfill({ headers, json: { success: true, error: null, data: { match: { ...base,
          tournament: { ...base.tournament, competitionFormat: 'UCL_CUP' }, fixture: { ...base.fixture, roundName: 'UCL SEMI-FINAL · LEG 2', matchday: 2 },
          returnLeg: { canUpload: unlocked, firstLegMatchId: 'first-leg', firstLegFixtureCode: 'F1', firstLegScore: unlocked ? { homeScore: 1, awayScore: 2 } : null,
            message: unlocked ? null : 'Upload and verify the first-leg result before uploading or submitting the second-leg result.' } } } } }),
        '/api/matches/first-leg/events': (route, headers) => route.fulfill({ headers: { ...headers, 'content-type': 'text/event-stream' }, body: 'event: connected\ndata: {"type":"connected"}\n\n' }),
      } });
    try {
      await context.grantPermissions(['local-network-access'], { origin });
      await page.goto(`${origin}/matches/phase3`);
      await page.getByRole('status', { name: 'Second leg locked' }).waitFor();
      assert.equal(await page.getByLabel('Match result screenshot', { exact: true }).count(), 0);
      assert.equal(await page.locator('#result-entry').count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Open first leg F1' }).getAttribute('href'), '/matches/first-leg');
      unlocked = true;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.getByLabel('Match result screenshot', { exact: true }).waitFor({ state: 'attached' });
      await page.locator('#result-entry').waitFor();
      assert.equal(await page.getByRole('status', { name: 'Second leg locked' }).count(), 0);
      assert.match(await page.locator('[role="status"]').allTextContents().then(x => x.join(' ')), /Verified first leg/);
      await checkLayout(page, `return-leg unlock ${width}`);
      assert.deepEqual(mutations.filter(mutation => mutation.path !== '/api/telemetry/web-vitals'), []); assert.deepEqual(errors, []);
      console.log(`PASS return leg at ${width}px: upload + manual form locked, verification unlocks without reload`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
