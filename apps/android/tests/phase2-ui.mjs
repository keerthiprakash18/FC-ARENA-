// Phase 2 visual consolidation checks. API calls are intercepted.
// Run after a production build with a local server on 127.0.0.1:3000.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const user = {
  id: 'phase2',
  fullName: 'Phase Two Player',
  role: 'PLAYER',
  themePreference: 'LUXURY_GOLD',
  player: { identity: { inGameName: 'Arena Player' } },
};
const career = {
  profile: {
    fullName: user.fullName,
    playerCode: 'PHASE2',
    profileImageUrl: null,
    identity: { inGameName: 'Arena Player', isVerified: true },
    primaryLeague: null,
    secondaryLeague: null,
  },
  lifetimeStatistics: {
    matches: 20,
    wins: 10,
    draws: 5,
    losses: 5,
    goalsFor: 40,
    goalsAgainst: 20,
    goalDifference: 20,
    winRate: 50,
    form: ['W', 'D', 'L'],
    tournaments: 2,
    achievements: 0,
  },
  matchHistory: [],
  tournamentHistory: [],
  leagueHistory: [],
  achievements: [],
};
const publicTournament = {
  tournament: {
    id: 'phase2',
    code: 'PHASE2',
    name: 'FC Arena Invitational',
    logoUrl: null,
    description: 'A public competition for responsive brand checks.',
    rules: 'Play fair and report verified results.',
    mode: 'SOLO',
    format: 'ROUND_ROBIN',
    competitionFormat: 'LEAGUE',
    status: 'PUBLISHED',
    startAt: null,
    endAt: null,
    league: { name: 'Arena League', logoUrl: null, region: 'Global' },
  },
  groups: [],
  fixtures: [],
  standings: [{
    position: 1,
    registrationId: 'player-1',
    name: 'Responsive Player',
    played: 3,
    wins: 2,
    draws: 1,
    losses: 0,
    goalsFor: 8,
    goalsAgainst: 3,
    goalDifference: 5,
    points: 7,
    form: 'WWD',
  }],
  topPlayers: [],
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
const errors = [];

async function prepare(page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      let data;
      switch (url.pathname) {
        case '/api/auth/refresh':
          data = { accessToken: 'phase2-only', expiresIn: 3600 };
          break;
        case '/api/auth/me':
          data = { user };
          break;
        case '/api/notifications':
          data = { notifications: [], unreadCount: 0 };
          break;
        case '/api/players/me/career':
          data = career;
          break;
        case '/api/public/tournaments/PHASE2':
          data = publicTournament;
          break;
        default:
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
    for (const key of ['content-encoding', 'transfer-encoding', 'content-length']) {
      delete headers[key];
    }
    return route.fulfill({
      status: response.status,
      headers,
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

try {
  for (const width of [360, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 850 },
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await prepare(page);

    await page.goto('https://fcarena.in/career');
    await page.locator('.fc-main').waitFor();
    await page.getByRole('navigation', { name: 'Career sections' }).waitFor();

    await page.goto('https://fcarena.in/public/tournaments/PHASE2');
    await page.locator('.fc-public-page').waitFor();
    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return {
        width: innerWidth,
        scrollWidth: root.scrollWidth,
        canvas: styles.getPropertyValue('--theme-background').trim(),
        header: Boolean(document.querySelector('.fc-public-header')),
      };
    });

    assert(metrics.scrollWidth <= width + 1, `Horizontal overflow at ${width}px`);
    assert.equal(metrics.canvas, '#f6f4ee');
    assert(metrics.header, 'Public brand header is missing');
    await context.close();
    console.log(`PASS Phase 2 width ${width}: contextual navigation, public brand, responsive canvas`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
