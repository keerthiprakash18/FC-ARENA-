// Populated premium UI checks. Every API is fixture-only, including admin mutations.
// Run against the production build using the same local server as phase-ui-harness.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, career } from './phase-ui-harness.mjs';
import { phaseData, tournament, entries, war } from './phase-ui-fixtures.mjs';

const capture = process.env.PREMIUM_CAPTURE;
const before = capture === 'before';
const screenshotDirectory = process.env.PREMIUM_SCREENSHOTS;
if (screenshotDirectory) await fs.mkdir(screenshotDirectory, { recursive: true });
const season = { ...phaseData['/api/ballon/seasons/phase3/rankings'].season, status: 'LIVE' };
const rows = [1, 2, 3].map(position => ({
  ...phaseData['/api/ballon/seasons/phase3/rankings'].rows[0], position,
  userId: position === 1 ? 'phase3' : `rival-${position}`,
  fullName: ['Arjun Roy', 'Rahul Shah', 'Daniel Thomas'][position - 1],
  rating: [93.4, 89.2, 86.7][position - 1],
}));
const competition = { ...tournament, status: 'PUBLISHED' };
const schedule = phaseData['/api/tournaments/phase3/fixtures'].fixtures.map(fixture => ({
  ...fixture, scheduledAt: '2027-01-01T12:00:00Z',
  match: { id: 'phase3', matchCode: 'M-P3', status: 'SCHEDULED' },
}));
const dashboardFixture = {
  ...schedule[0], tournamentId: 'phase3', tournamentName: competition.name,
  leagueId: 'phase3', leagueName: competition.league.name,
};
const populatedCareer = {
  ...career, profile: { ...career.profile, fullName: 'Arjun Roy', identity: { ...career.profile.identity, inGameName: 'Arjun Roy' } },
  tournamentHistory: [{ tournament: competition, registration: entries[0], statistics: career.lifetimeStatistics }],
};
const publicData = {
  ...phaseData['/api/public/tournaments/PHASE3'], tournament: competition,
  fixtures: [
    { id: 'public-upcoming', fixtureCode: 'F1', roundName: 'Semi Final', matchday: 1, scheduledAt: '2027-01-01T12:00:00Z', venue: null, status: 'SCHEDULED', home: entries[0].entryName, away: entries[1].entryName, result: null },
    { id: 'public-result', fixtureCode: 'F2', roundName: 'Round 1', matchday: 1, scheduledAt: null, venue: null, status: 'COMPLETED', home: entries[0].entryName, away: entries[1].entryName, result: { homeScore: 3, awayScore: 1 } },
  ],
  topPlayers: rows.map(row => ({ ...row, name: row.fullName, matches: 5, wins: 3, goalsFor: 8, goalDifference: 4 })),
};
const overrides = {
  '/api/players/me/career': populatedCareer,
  '/api/players/me/dashboard': { career: populatedCareer, memberships: phaseData['/api/leagues/my'].leagues, tournaments: [competition], fixtures: [dashboardFixture] },
  '/api/tournaments/phase3': { tournament: competition },
  '/api/leagues/phase3/tournaments': { tournaments: [competition] },
  '/api/tournaments/phase3/fixtures': { tournament: competition, fixtures: schedule },
  '/api/awards/overview': { ...phaseData['/api/awards/overview'], currentBallon: { season, rankings: { locked: false, rows } }, trophyCabinet: { GOLDEN_BOOT: 2, GOLDEN_GLOVE: 1 } },
  '/api/ballon/seasons/phase3/rankings': { season, rows, locked: false },
  '/api/public/tournaments/PHASE3': publicData,
  '/api/league-wars': { wars: [{ ...war, roster: { home: 1, away: 1 } }] },
  '/api/fair-play/players/phase3': { fairPlay: phaseData['/api/fair-play/players/phase3'].summary },
};
const routes = [
  '/dashboard', '/leagues/phase3', '/tournaments/phase3', '/matches/phase3',
  '/awards', '/awards/ballon/phase3', '/league-war/phase3', '/fixtures',
  '/admin/analytics', '/public/tournaments/PHASE3', '/discover/players/phase3',
  '/tournaments/phase3/standings', '/tournaments/phase3/playoffs', '/league-war',
];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const findings = [];
let checks = 0;

async function mastheadContrast(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const rgba = color => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value);
    };
    const over = (foreground, background) => foreground.slice(0, 3).map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3])).concat(1);
    const luminance = rgb => {
      const channels = rgb.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    return [...document.querySelectorAll('.premium-hero :is(h1,h2,p,strong,small,span,a,button)')].flatMap(element => {
      if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden' || ![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) return [];
      const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      const background = ancestors.reduce((color, node) => over(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255, 1]);
      const style = getComputedStyle(element), foreground = over(rgba(style.color), background);
      const a = luminance(foreground), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.67 && parseInt(style.fontWeight) >= 700);
      return ratio + .02 < (large ? 3 : 4.5) ? [{ text: element.textContent.trim().slice(0, 90), ratio: Number(ratio.toFixed(2)), color: style.color, className: element.className }] : [];
    });
  });
}

async function audit(options) {
  const { page, context, errors, mutations } = await createUiContext(browser, { ...options, overrides });
  try {
    for (const route of routes) {
      await page.goto(`https://fcarena.in${route}`);
      await page.locator('h1, .fc-main').first().waitFor();
      await page.waitForTimeout(160);
      assert.equal(new URL(page.url()).pathname, route);
      assert.equal(await page.getByText('FC ARENA could not load this screen', { exact: true }).count(), 0);
      await checkLayout(page, `${route}/${options.width}/${options.theme}/${options.mode}/${options.native || false}`);
      if (!before) {
        assert.equal(await page.locator('body').getAttribute('data-ui-build'), 'premium-redesign');
        const contrast = await mastheadContrast(page);
        if (contrast.length) findings.push({ route, ...options, contrast });
        if (options.width < 1024 && !route.startsWith('/public/')) {
          const rail = page.getByRole('navigation', { name: 'Primary navigation' });
          assert.equal(await rail.getByRole('link').count(), 7);
          await page.waitForFunction(() => {
            const rail = document.querySelector('[aria-label="Primary navigation"]');
            const active = rail?.querySelector('[aria-current="page"]');
            if (!active) return true;
            const r = rail.getBoundingClientRect(), a = active.getBoundingClientRect();
            return a.left >= r.left - 1 && a.right <= r.right + 1;
          });
          const active = rail.locator('[aria-current="page"]');
          if (await active.count()) assert(parseFloat(await active.locator('span').last().evaluate(element => getComputedStyle(element).fontSize)) >= 11);
        }
        if (route === '/matches/phase3') assert(await page.locator('.premium-scoreboard').evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.premium-match-task')) & Node.DOCUMENT_POSITION_FOLLOWING)));
        if (route === '/awards' || route === '/awards/ballon/phase3') {
          const podium = page.getByRole('region', { name: 'Season podium' });
          // A labelled section is exposed as a region by the browser.
          assert.equal(await podium.getByRole('link').count(), 3);
          for (const row of rows) assert.equal(await podium.locator(`[data-rank="${row.position}"] .premium-rating`).textContent(), String(row.rating));
        }
        if (route === '/public/tournaments/PHASE3') {
          assert(await page.locator('#results').getByText('3 : 1', { exact: true }).isVisible());
          await page.getByRole('navigation', { name: 'Public tournament sections' }).getByRole('link', { name: 'Results', exact: true }).click();
          assert.equal(new URL(page.url()).hash, '#results');
          await page.evaluate(() => window.scrollTo(0, 0));
        }
      }
      if (screenshotDirectory && [390, 1440].includes(options.width) && options.theme === 'LUXURY_GOLD' && options.mode === 'LIGHT' && !options.native) {
        await page.screenshot({ path: path.join(screenshotDirectory, `${route.replaceAll('/', '_')}-${options.width}.png`), fullPage: true, animations: 'disabled' });
      }
      checks++;
    }
    assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
    console.log(`PASS premium ${options.width}/${options.theme}/${options.mode}/${options.native ? 'Android-UA' : 'browser'}: ${routes.length} populated routes`);
  } finally { await context.close(); }
}

try {
  for (const width of capture ? [390, 1440] : [360, 390, 412, 430, 768, 1024, 1440]) {
    for (const theme of capture ? ['LUXURY_GOLD'] : ['LUXURY_GOLD', 'CLASSIC_BLUE']) {
      for (const mode of capture ? ['LIGHT'] : ['LIGHT', 'DARK']) await audit({ width, theme, mode });
    }
  }
  if (!capture) {
    for (const width of [360, 390, 412, 430]) for (const mode of ['LIGHT', 'DARK']) await audit({ width, theme: 'LUXURY_GOLD', mode, native: true });

    // Accessible direct navigation must also reveal a keyboard-focused item.
    const keyboard = await createUiContext(browser, { width: 360, overrides });
    try {
      await keyboard.page.goto('https://fcarena.in/awards');
      const rail = keyboard.page.getByRole('navigation', { name: 'Primary navigation' });
      const home = rail.getByRole('link', { name: 'Home', exact: true });
      await home.focus();
      await keyboard.page.keyboard.press('Tab');
      assert(await rail.getByRole('link', { name: 'League', exact: true }).evaluate(element => {
        const r = element.parentElement.getBoundingClientRect(), a = element.getBoundingClientRect();
        return element === document.activeElement && a.left >= r.left - 1 && a.right <= r.right + 1;
      }));
      assert.deepEqual(keyboard.errors, []);
    } finally { await keyboard.context.close(); }

    // Both eligible league roles retain Start; a normal player cannot see it.
    for (const adminRole of ['OWNER', 'ADMIN', null]) {
      let started = false;
      const draftSeason = { ...season, status: 'DRAFT', eligibleLeagueIds: ['phase3'] };
      const admin = await createUiContext(browser, {
        width: 390, role: 'PLAYER', overrides: {
          '/api/leagues/my': { leagues: [{ ...phaseData['/api/leagues/my'].leagues[0], adminRole }] },
          '/api/admin/ballon/seasons': { seasons: [draftSeason] },
          '/api/awards/overview': (route, headers) => route.fulfill({ headers, json: { success: true, data: { ...phaseData['/api/awards/overview'], currentBallon: started ? { season, rankings: { locked: false, rows } } : null }, error: null } }),
        }, onMutation: (route, headers) => {
          assert.equal(route.request().method(), 'POST');
          assert.equal(new URL(route.request().url()).pathname, '/api/admin/ballon/seasons/phase3/start');
          started = true;
          return route.fulfill({ headers, json: { success: true, data: { season }, error: null } });
        },
      });
      try {
        await admin.page.goto('https://fcarena.in/awards');
        await admin.page.getByRole('heading', { name: 'Awards', exact: true }).waitFor();
        if (adminRole) {
          await admin.page.getByText(`Administrator controls · ${adminRole}`, { exact: true }).click();
          await admin.page.getByRole('button', { name: 'Start Ballon Season', exact: true }).click();
          await admin.page.getByText('FC Arena Ballon season is now LIVE.', { exact: false }).waitFor();
          assert.equal(started, true); assert.equal(admin.mutations.length, 1);
        } else {
          await admin.page.waitForTimeout(200);
          assert.equal(await admin.page.getByText('Ballon Admin Controls', { exact: true }).count(), 0);
          assert.equal(await admin.page.getByRole('button', { name: 'Start Ballon Season', exact: true }).count(), 0);
          assert.deepEqual(admin.mutations, []);
        }
        assert.deepEqual(admin.errors, []);
      } finally { await admin.context.close(); }
    }
    console.log('PASS premium keyboard rail and OWNER/ADMIN Start / PLAYER exclusion');
  }
  console.log('Premium masthead contrast findings', JSON.stringify(findings));
  assert.deepEqual(findings, [], 'Premium masthead text must have readable contrast');
  console.log(`PASS premium total: ${checks} populated route/viewport/theme checks`);
} finally { await browser.close(); }
