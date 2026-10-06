// Phase 3 UX checks. API calls are intercepted and no production account is used.
// Run after a production build and local server on 127.0.0.1:3000.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { draft, phaseData } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const user = {
  id: 'phase3',
  fullName: 'Phase Three Player',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  email: 'phase3@example.invalid',
  phoneNumber: null,
  themePreference: 'LUXURY_GOLD',
  player: {
    playerCode: 'P3',
    profileImageUrl: null,
    identity: { inGameName: 'Phase Three Player', isVerified: true },
  },
};
const career = {
  profile: {
    fullName: user.fullName,
    playerCode: 'P3',
    profileImageUrl: null,
    identity: user.player.identity,
    primaryLeague: null,
    secondaryLeague: null,
  },
  lifetimeStatistics: {
    matches: 4, wins: 2, draws: 1, losses: 1, goalsFor: 6,
    goalsAgainst: 4, goalDifference: 2, winRate: 50, form: ['W', 'D', 'L'],
    tournaments: 1, achievements: 0,
  },
  matchHistory: [], tournamentHistory: [], leagueHistory: [], achievements: [],
};
const dashboard = {
  career,
  memberships: [],
  tournaments: [],
  fixtures: [],
};
const publicTournament = {
  tournament: {
    id: 'phase3', code: 'PHASE3', name: 'Responsive Cup', logoUrl: null,
    description: 'Public table UX fixture.', rules: null, mode: 'SOLO',
    format: 'ROUND_ROBIN', competitionFormat: 'LEAGUE', status: 'PUBLISHED',
    startAt: null, endAt: null,
    league: { name: 'Arena League', logoUrl: null, region: 'Global' },
  },
  groups: [], fixtures: [], topPlayers: [],
  standings: [1, 2, 3].map(position => ({
    position, registrationId: `entry-${position}`, name: `Long Competition Entry ${position}`,
    played: 4, wins: position === 1 ? 3 : 2, draws: 1, losses: 0,
    goalsFor: 9, goalsAgainst: 4, goalDifference: 5, points: position === 1 ? 10 : 7,
    form: 'WWD',
  })),
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
const errors = [];

async function prepare(page) {
  page.on('console', message => { if (message.type() === 'error') console.log(`Browser console: ${message.text()}`); });
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`Phase 3 page error: ${error.message}`);
  });
  await page.context().route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      let data;
      switch (url.pathname) {
        case '/api/auth/refresh': data = { accessToken: 'phase3-only', expiresIn: 3600 }; break;
        case '/api/auth/me': data = { user }; break;
        case '/api/notifications': data = { notifications: [], unreadCount: 0 }; break;
        case '/api/players/me/career': data = career; break;
        case '/api/players/me/dashboard': data = dashboard; break;
        case '/api/public/tournaments/PHASE3': data = publicTournament; break;
        default:
          if (Object.hasOwn(phaseData, url.pathname)) { data = phaseData[url.pathname]; break; }
          errors.push(`Unmocked API: ${request.method()} ${url.pathname}`);
          return route.abort();
      }
      return route.fulfill({
        headers: {
          'access-control-allow-origin': 'https://fcarena.in',
          'access-control-allow-credentials': 'true',
        },
        json: { success: true, data, error: null },
      });
    }
    if (url.hostname !== 'fcarena.in') {
      errors.push(`Unexpected request: ${url.origin}`);
      return route.abort();
    }
    const response = await fetch(`${origin}${url.pathname}${url.search}`, {
      headers: { ...request.headers(), host: new URL(origin).host },
    });
    const headers = Object.fromEntries(response.headers);
    for (const key of ['content-encoding', 'transfer-encoding', 'content-length']) delete headers[key];
    return route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  });
}

try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 850 }, serviceWorkers: 'block', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await prepare(page);
    await context.addInitScript(value => localStorage.setItem('fc-arena:fixture-generator-draft:v2', JSON.stringify(value)), draft);

    await page.goto('https://fcarena.in/dashboard');
    await page.locator('.fc-main').waitFor({ timeout: 15000 }).catch(async error => {
      console.log('Dashboard diagnostic', page.url(), await page.locator('body').innerText(), errors);
      throw error;
    });
    if (width < 1024) {
      const primary = page.getByRole('navigation', { name: 'Primary navigation' });
      assert.equal(await primary.getByRole('link').count(), 7, `Six direct product destinations plus More at ${width}px`);
      for (const href of ['/dashboard', '/leagues', '/tournaments', '/fixtures', '/awards', '/league-war']) assert.equal(await primary.locator(`a[href="${href}"]`).count(), 1);
      await page.goto('https://fcarena.in/league-war');
      await page.locator('.fc-main').waitFor();
      assert.equal(await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'League War', exact: true }).getAttribute('aria-current'), 'page');
    } else {
      const search = page.getByRole('combobox', { name: 'Search app sections' });
      await search.fill('career');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      assert.equal(await search.getAttribute('aria-activedescendant'), 'fc-search-option-0');
      await page.keyboard.press('Escape');
      assert.equal(await search.getAttribute('aria-expanded'), 'false');
      assert(await search.evaluate(element => element === document.activeElement));
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/career');
    }

    await page.goto('https://fcarena.in/public/tournaments/PHASE3');
    await page.locator('.fc-public-page').waitFor();
    assert.equal(await page.locator('.fc-public-mobile-table').count(), 1);
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      mobileTable: getComputedStyle(document.querySelector('.fc-public-mobile-table')).display,
    }));
    assert(metrics.scrollWidth <= width + 1, `Horizontal overflow at ${width}px`);
    if (width < 640) assert.notEqual(metrics.mobileTable, 'none');
    for (const step of ['setup', 'teams', 'groups', 'fixture-settings', 'fixture-preview', 'qualification', 'review']) {
      await page.goto(`https://fcarena.in/tournaments/phase3/wizard/${step}`);
      await page.locator('.fc-wizard-shell').waitFor();
      assert.equal(await page.getByRole('progressbar').count(), 1);
      const nav = page.getByRole('navigation', { name: 'Tournament builder steps' });
      const active = nav.locator('[aria-current="page"]');
      await page.waitForFunction(() => {
        const nav = document.querySelector('[aria-label="Tournament builder steps"]');
        const active = nav.querySelector('[aria-current="page"]');
        const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect();
        return a.left >= n.left - 1 && a.right <= n.right + 1;
      });
      assert(await active.isVisible());
      if (step === 'setup') {
        assert.equal(await page.locator('.field label').evaluateAll(labels => labels.filter(label => !label.control).length), 0);
        assert.equal(await page.getByText('Branding & description (optional)', { exact: true }).evaluate(element => element.parentElement.open), false);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${step} overflow at ${width}`);
    }

    for (const path of ['/fixtures/generate', '/fixtures/generate/participants', '/fixtures/generate/rules', '/fixtures/generate/preview', '/fixtures/generate/save', '/league-war/phase3', '/leaderboards', '/tournaments/phase3/standings', '/admin/analytics', '/admin/system', '/admin/fair-play', '/admin/disputes', '/admin/safety-reports']) {
      await page.goto(`https://fcarena.in${path}`);
      await page.locator('.fc-main').waitFor();
      assert.equal(new URL(page.url()).pathname, path, `Route remains ${path}`);
      if (path === '/fixtures/generate') {
        await page.locator('#fixture-list-name').fill('');
        await page.getByRole('button', { name: 'Next — Add Participants →' }).click();
        assert.equal(await page.locator('#fixture-list-name').getAttribute('aria-invalid'), 'true');
        assert(await page.locator('#fixture-name-error').isVisible());
        assert(await page.locator('#fixture-list-name').evaluate(element => element === document.activeElement));
      }
      if (path === '/fixtures/generate/rules') assert.equal(await page.getByText('Optional scheduling & matchday names', { exact: true }).evaluate(element => element.parentElement.open), false);
      if (path === '/admin/analytics') await page.getByRole('region', { name: 'Admin workspace' }).waitFor();
      if (path === '/admin/disputes' || path === '/admin/safety-reports') {
        const filter = page.getByRole('region', { name: 'Review filters' });
        await filter.getByText('2 results', { exact: false }).waitFor();
        await page.getByLabel('Review status').selectOption('OPEN');
        await filter.getByText('1 result', { exact: false }).waitFor();
        await page.getByLabel('Search review queue').fill('no-match');
        await filter.getByText('0 results', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Reset filters' }).click();
        await filter.getByText('2 results', { exact: false }).waitFor();
        if (path === '/admin/disputes') {
          await page.getByRole('button', { name: 'Resolve', exact: true }).click();
          assert.equal(await page.locator('#dispute-note-dispute-1').getAttribute('aria-invalid'), 'true');
          assert(await page.locator('#dispute-error-dispute-1').isVisible());
        }
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} overflow at ${width}`);
    }
    await context.close();
    console.log(`PASS Phase 3 width ${width}: navigation, keyboard search, seven wizard steps, five generator steps, rivalry, tables, admin filters and field errors`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
