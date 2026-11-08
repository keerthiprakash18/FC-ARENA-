import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament } from './phase-ui-fixtures.mjs';
import { describeTournamentFormat } from '../../api/dist/tournaments/tournament-format-guide.js';

const output = path.resolve('.cache/competition-clarity/screenshots'); fs.mkdirSync(output, { recursive: true });
const base = { competitionFormat: 'UCL_CUP', mode: 'SOLO', teamSize: 1, maxEntries: 36, status: 'ONGOING', groupMode: 'SINGLE_GROUP', legType: 'SINGLE_LEG', fixtureMode: 'AUTOMATIC', playoffSource: 'AUTO', qualifiersPerGroup: null, playoffQualifiersTotal: null, playoffFormat: 'GLOBAL_SEEDED', playoffSeedingBasis: 'AUTO', _count: { registrations: 36 }, groups: [] };
const themes = ['luxury-gold', 'classic-blue', 'city-sky', 'london-red', 'mersey-red', 'madrid-royal', 'catalan-nights', 'munich-red', 'paris-night', 'milan-blue', 'milan-red', 'turin-mono'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
let contrastChecks = 0, tableChecks = 0, submissions = 0;
async function contrast(locator) {
  return locator.evaluate(element => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    const luminance = value => rgb(value).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const style = getComputedStyle(element); let parent = element, bg;
    while (parent) { bg = getComputedStyle(parent).backgroundColor; if (!bg.endsWith(', 0)') && bg !== 'transparent') break; parent = parent.parentElement; }
    const fgL = luminance(style.color), bgL = luminance(bg);
    return { ratio: (Math.max(fgL, bgL) + .05) / (Math.min(fgL, bgL) + .05), fg: style.color, bg, opacity: style.opacity };
  });
}
const mutate = async (route, headers) => {
  const p = new URL(route.request().url()).pathname;
  if (p === '/api/telemetry/web-vitals') return route.fulfill({ status: 204, headers });
  if (p === '/api/matches/phase3/results') {
    assert.deepEqual(JSON.parse(route.request().postData()), { homeScore: 2, awayScore: 1 }); submissions++;
    return route.fulfill({ headers, json: { success: true, data: { submission: { id: 'saved' }, message: 'Submitted' }, error: null } });
  }
  if (p === '/api/results/saved/confirm') return route.fulfill({ headers, json: { success: true, data: { message: 'Confirmed' }, error: null } });
  throw new Error(`Unexpected mutation ${p}`);
};
try {
  for (const width of [320, 390, 1280, 1920]) {
    const match = { ...phaseData['/api/matches/phase3'].match, isLeagueAdmin: true, tournament: { ...tournament, formatGuide: describeTournamentFormat(base) } };
    const { page, context, errors } = await createUiContext(browser, { width, native: width < 500, mode: 'DARK', overrides: {
      '/api/matches/phase3': { match }, '/api/matches/phase3/results': { ...phaseData['/api/matches/phase3/results'], isLeagueAdmin: true, canVerifyResult: true },
    }, onMutation: mutate });
    await page.goto('https://fcarena.in/matches/phase3');
    const button = page.getByRole('button', { name: 'Save Result & Update Stats', exact: true }); await button.waitFor();
    await page.getByText('Tournament format & qualification', { exact: true }).click();
    await page.getByRole('heading', { name: 'UCL Cup', exact: true }).waitFor();
    assert.match(await page.locator('.fc-format-qualification').innerText(), /Top 8.*9–24/s);
    for (const mode of ['light', 'dark']) for (const theme of themes) {
      await page.evaluate(({ mode, theme }) => { document.documentElement.dataset.mode = mode; document.documentElement.dataset.theme = theme; }, { mode, theme });
      // Measure the settled palette, after the theme's color transition.
      await page.waitForTimeout(220);
      for (const disabled of [false, true]) {
        await button.evaluate((b, disabled) => { b.disabled = disabled; }, disabled);
        const c = await contrast(button); assert(c.ratio >= 4.5, `${width} ${mode} ${theme} disabled=${disabled}: ${JSON.stringify(c)}`); contrastChecks++;
      }
      await button.evaluate(b => { b.disabled = false; });
      for (const selector of ['.fc-format-guide h2', '.fc-format-qualification > p', '.fc-format-facts dt', '.fc-format-muted']) {
        const c = await contrast(page.locator(selector).first()); assert(c.ratio >= 4.5, `${selector} ${mode} ${theme}: ${JSON.stringify(c)}`); contrastChecks++;
      }
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'luxury-gold'; document.documentElement.dataset.mode = 'dark'; });
    await checkLayout(page, `Match room ${width}`);
    await page.locator('input[name="homeScore"]').fill('2'); await page.locator('input[name="awayScore"]').fill('1'); await button.click();
    await page.getByText(/Confirmed Player career stats/).waitFor();
    if ([390, 1920].includes(width)) { await page.locator('#result-entry').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `dark-result-${width}.png`) }); }
    assert.deepEqual(errors, []); await context.close();
  }
  const cases = [
    ['ucl', base, [], 8, 16],
    ['elite', { ...base, competitionFormat: 'ELITE_CUP', _count: { registrations: 10 } }, [], 8, 0],
    ['league', { ...base, competitionFormat: 'LEAGUE_ROUND_ROBIN', _count: { registrations: 10 } }, [], 0, 0],
    ['random', { ...base, competitionFormat: 'ELITE_CUP', playoffSeedingBasis: 'RANDOM', _count: { registrations: 10 } }, [], 0, 0],
    ['groups', { ...base, competitionFormat: 'GROUP_STAGE_KNOCKOUT', groupMode: 'MULTIPLE_GROUPS', qualifiersPerGroup: 3, _count: { registrations: 12 }, groups: [0, 1, 2].map(i => ({ name: `Group ${i}`, _count: { registrations: 4 } })) }, [4, 4, 4], 9, 0],
    ['pending', { ...base, competitionFormat: 'GROUP_STAGE_KNOCKOUT', playoffSource: 'GROUP_QUALIFIERS', _count: { registrations: 10 } }, [], 0, 0],
  ];
  for (const width of [390, 1280]) for (const [label, input, groupSizes, qualifying, playoff] of cases) {
    const guide = describeTournamentFormat(input), t = { ...tournament, competitionFormat: input.competitionFormat, formatGuide: guide };
    // Reverse alphabetical labels make accidental client-side re-sorting visible.
    const standings = Array.from({ length: input._count.registrations }, (_, i) => ({ ...phaseData['/api/tournaments/phase3/standings'].standings[0], position: i + 1, registrationId: `entry-${i}`, entryName: i === 0 ? 'ZZZ official first' : i === 1 ? 'AAA official second' : `Club ${i}` }));
    const groups = groupSizes.map((size, i) => ({ id: `g-${i}`, name: `Group ${i}`, position: i + 1, entries: standings.slice(i * size, i * size + size).map(row => ({ id: row.registrationId, entryName: row.entryName, members: [] })) }));
    const { page, context, errors } = await createUiContext(browser, { width, mode: 'DARK', overrides: { '/api/tournaments/phase3/standings': { tournament: t, standings }, '/api/tournaments/phase3/groups': { groups } }, onMutation: mutate });
    await page.goto('https://fcarena.in/tournaments/phase3/standings'); await page.locator('.fc-format-guide').waitFor();
    const prefix = width < 640 ? '.fc-compact-team-row' : '.fc-qualification-rank';
    assert.equal(await page.locator(`${prefix}[data-qualification="playoff"]`).count(), playoff);
    assert.equal(await page.locator(`${prefix}[data-qualification="direct"],${prefix}[data-qualification="qualify"]`).count(), qualifying);
    if (!groups.length) { const table = width < 640 ? '.fc-compact-standings-table' : '.premium-standings-table table'; assert.match(await page.locator(table).last().locator('tbody tr').first().innerText(), /ZZZ official first/); }
    if (label === 'pending') assert.match(await page.locator('.fc-format-guide').innerText(), /Setup pending/);
    await checkLayout(page, `${label} standings ${width}`); assert.deepEqual(errors, []); tableChecks++;
    if (label === 'ucl' && width === 390) await page.screenshot({ path: path.join(output, 'ucl-guide-mobile.png'), fullPage: true });
    await context.close();
  }
  console.log(JSON.stringify({ contrastChecks, tableChecks, submissions, screenshotDirectory: output }));
} finally { await browser.close(); }
