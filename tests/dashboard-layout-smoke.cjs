// Build with NEXT_PUBLIC_API_URL=https://api.fcarena.in/api npm run build:web,
// then run node tests/dashboard-layout-smoke.cjs. API fixtures are local only.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const { chromium } = createRequire(path.join(root, 'apps/android/tests/package.json'))('playwright');
const origin = 'http://127.0.0.1:3197';
const server = spawn(process.execPath, [webRequire.resolve('next/dist/bin/next'), 'start', '--port', '3197', '--hostname', '127.0.0.1'], { cwd: path.join(root, 'apps/web'), stdio: 'ignore' });
let browser;

async function run() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Local test server exited');
    if (await fetch(origin).then(response => response.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  let checks = 0;
  for (const native of [false, true]) {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      ...(native ? { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 FC-Arena-Android/1.0.16', isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    let mode = 'light';
    let state = 'empty';
    let hiddenSections = [];
    const playerName = 'A_Very_Long_Player_Name_For_Mobile_Alignment';
    const user = { id: 'layout-user', fullName: playerName, status: 'ACTIVE', role: 'PLAYER', themePreference: 'CLASSIC_BLUE', player: { playerCode: 'FCA-P-TEST', identity: { inGameName: playerName, isVerified: false } } };
    const league = { id: 'league', name: 'Layout Test League', code: 'TEST', members: 2, maxMembers: 32 };
    const tournament = { id: 'cup', leagueId: league.id, leagueName: league.name, name: 'Layout Test Cup', status: 'ACTIVE', approvedEntries: 2, maxEntries: 32, competitionFormat: 'UCL_CUP' };
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.startsWith('/api/')) {
        let data;
        switch (url.pathname) {
          case '/api/auth/refresh': data = { accessToken: 'layout-test-only', expiresIn: 3600 }; break;
          case '/api/auth/me': data = { user }; break;
          case '/api/auth/preferences/dashboard': data = { preferences: { hiddenSections } }; break;
          case '/api/notifications': data = { notifications: [], unreadCount: 0 }; break;
          case '/api/telemetry/web-vitals': data = { accepted: true }; break;
          case '/api/players/me/dashboard':
            data = {
              career: {
                profile: { ...user.player, primaryLeague: { league }, secondaryLeague: null },
                lifetimeStatistics: { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, winRate: 0 },
                tournamentHistory: [{ tournament: { id: 'cup' }, registration: { id: 'home' } }], matchHistory: [],
              },
              memberships: [{ membershipType: 'PRIMARY', adminRole: null, league }], tournaments: [tournament],
              fixtures: state === 'empty' ? [] : [{
                id: 'fixture', tournamentId: 'cup', tournamentName: tournament.name, leagueName: league.name, sequence: 1, matchday: 1, roundName: 'League phase',
                status: state === 'live' ? 'IN_PROGRESS' : 'SCHEDULED', scheduledAt: new Date(Date.now() + 172800000).toISOString(),
                home: { id: 'home', entryName: 'Manchester City Long Team Name', members: [{ id: user.id, fullName: playerName }] },
                away: { id: 'away', entryName: 'Real Madrid Long Team Name', members: [] },
                match: { id: 'match', status: state === 'live' ? 'IN_PROGRESS' : 'SCHEDULED' },
              }],
            };
            break;
          default: errors.push(`Unmocked API: ${url.pathname}`); return route.abort();
        }
        return route.fulfill({ headers, json: { success: true, data, error: null } });
      }
      if (url.origin === origin) return route.continue();
      errors.push(`Unexpected network request: ${url.origin}${url.pathname}`);
      return route.abort();
    });
    await page.addInitScript(() => localStorage.setItem('fc-onboarding:layout-user', 'dismissed'));
    for (const width of native ? [360, 390, 412, 430] : [360, 390, 412, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      for (mode of ['light', 'dark']) {
        for (state of ['empty', 'upcoming', 'live']) {
          await page.goto(`${origin}/dashboard`);
          await page.locator('.fc-next-match-panel').waitFor();
          const toggle = page.getByRole('button', { name: mode === 'dark' ? 'Switch to Dark Mode' : 'Switch to Light Mode' });
          if (await toggle.count()) await toggle.click();
          const geometry = await page.evaluate(() => {
            const luminance = color => {
              const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255)
                .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
              return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
            };
            const heroBackground = luminance(getComputedStyle(document.querySelector('.fc-dashboard-hero')).backgroundColor);
            const heroText = luminance(getComputedStyle(document.querySelector('.fc-dashboard-hero h1')).color);
            const rect = selector => {
              const node = document.querySelector(selector);
              if (!node) return null;
              const box = node.getBoundingClientRect();
              return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, lineHeight: parseFloat(getComputedStyle(node).lineHeight) };
            };
            return {
              hero: rect('.fc-dashboard-hero'), heroContent: rect('.fc-dashboard-hero > .relative'), section: rect('.fc-dashboard-section'),
              next: rect('.fc-next-match-panel'), league: rect('.fc-league-panel'), heading: rect('.fc-next-match-panel h3'),
              heroContrast: (Math.max(heroBackground, heroText) + 0.05) / (Math.min(heroBackground, heroText) + 0.05),
              pageWidth: document.documentElement.scrollWidth, viewport: innerWidth,
            };
          });
          assert.equal(await page.getByText('Your action inbox', { exact: true }).count(), 0, 'Marked inbox strip should be removed');
          assert.equal(await page.getByText('Reminders & approvals →', { exact: true }).count(), 0);
          assert(geometry.pageWidth <= geometry.viewport + 1, 'No horizontal document overflow');
          assert(geometry.heroContrast >= 4.5, 'Welcome title must remain readable in both display modes');
          const gap = geometry.section.y - geometry.hero.bottom;
          assert(gap >= 15 && gap <= 25, 'Welcome and Next Match cards need one consistent gap');
          assert(Math.abs(geometry.next.y - geometry.section.y) <= 1, 'Next Match must align with the top of its row');
          if (width < 1280) {
            assert(Math.abs(geometry.next.width - geometry.hero.width) <= 1, 'Stacked Next Match must fill the same width as the welcome card');
          } else {
            assert(geometry.next.width >= geometry.section.width * 0.55, 'Desktop match card must fill its grid column');
            assert(Math.abs(geometry.next.y - geometry.league.y) <= 1, 'Desktop cards must be top aligned');
          }
          assert(geometry.heroContent.width >= geometry.hero.width - 3, 'Hero must not have double horizontal padding');
          if (state === 'empty') {
            assert(geometry.heading.width >= geometry.next.width - 100, 'Empty heading should use the card width, not an icon column');
            assert(geometry.heading.height <= geometry.heading.lineHeight * 3 + 1, 'Empty heading should wrap by words in at most three lines');
            assert(geometry.next.height < 380, 'Empty Next Match should remain compact');
            await page.locator('.fc-next-match-panel a').filter({ hasText: 'View Fixtures' }).scrollIntoViewIfNeeded();
          } else {
            assert.equal(await page.locator('.fc-next-match-panel h2').innerText(), state === 'live' ? 'Live Match' : 'Next Match');
            assert.equal(await page.locator('.fc-next-match-panel a[href="/matches/match"]').count(), 1);
            const teams = await page.locator('.premium-match-sides > div').evaluateAll(nodes => nodes.map(node => ({ client: node.clientWidth, scroll: node.scrollWidth })));
            assert(teams.every(team => team.scroll <= team.client + 1), 'Long team names must stay inside their columns');
          }
          if (process.env.SMOKE_OUTPUT && width === 390 && state === 'empty') {
            await page.evaluate(() => scrollTo(0, 0));
            await page.screenshot({ path: path.join(process.env.SMOKE_OUTPUT, `dashboard-${native ? 'android' : 'web'}-${mode}.png`) });
          }
          checks++;
          console.log(`PASS ${native ? 'Android UA' : 'Web'} ${width}px ${mode} ${state}`);
        }
      }
    }
    hiddenSections = ['league'];
    await page.setViewportSize({ width: 1440, height: 850 });
    await page.goto(`${origin}/dashboard`);
    await page.locator('.fc-next-match-panel').waitFor();
    const nextWidth = await page.locator('.fc-next-match-panel').evaluate(node => node.getBoundingClientRect().width);
    const sectionWidth = await page.locator('.fc-dashboard-section').first().evaluate(node => node.getBoundingClientRect().width);
    assert(Math.abs(nextWidth - sectionWidth) <= 1, 'Hiding My League should leave a full-width match card, not an empty column');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`PASS: ${checks} dashboard scenarios, web/Android user agents, empty/upcoming/live matches, light/dark modes and hidden league layout.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  server.kill();
});
