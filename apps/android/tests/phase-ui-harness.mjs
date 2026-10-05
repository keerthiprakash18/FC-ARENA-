import assert from 'node:assert/strict';
import { phaseData, draft } from './phase-ui-fixtures.mjs';

export const user = {
  id: 'phase3', fullName: 'Phase Three Player', email: 'fixture@example.invalid', phoneNumber: null,
  role: 'SUPER_ADMIN', status: 'ACTIVE', themePreference: 'LUXURY_GOLD',
  player: { playerCode: 'P3', profileImageUrl: null, identity: { inGameName: 'Phase Three Player', gameUid: '123', isVerified: true } },
};
export const career = {
  profile: { ...user.player, primaryLeague: null, secondaryLeague: null },
  lifetimeStatistics: { matches: 4, wins: 2, draws: 1, losses: 1, goalsFor: 6, goalsAgainst: 4, goalDifference: 2, winRate: 50, form: ['W', 'D', 'L'], tournaments: 1, achievements: 0 },
  matchHistory: [], tournamentHistory: [], leagueHistory: [], achievements: [],
};

export async function createUiContext(browser, { width, native = false, reducedMotion = 'reduce', theme = 'LUXURY_GOLD', mode = 'LIGHT', role = 'SUPER_ADMIN', overrides = {}, onMutation } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 850 }, serviceWorkers: 'block', reducedMotion,
    ...(native ? { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 FC-Arena-Android/1.0' } : {}),
  });
  const errors = [], mutations = [];
  await context.addInitScript(({ draft, theme, mode }) => {
    localStorage.setItem('fc-arena:fixture-generator-draft:v2', JSON.stringify(draft));
    localStorage.setItem('fc-arena-theme-preference', theme);
    localStorage.setItem('fc-arena-display-mode', mode);
  }, { draft, theme, mode });
  const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'access-control-allow-origin': 'https://fcarena.in', 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'Authorization,Content-Type' };
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/matches/phase3/events') return route.fulfill({ headers: { ...headers, 'content-type': 'text/event-stream' }, body: 'event: connected\ndata: {"type":"connected"}\n\n' });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (!['GET', 'HEAD'].includes(request.method()) && url.pathname !== '/api/auth/refresh') {
        mutations.push({ method: request.method(), path: url.pathname, body: request.postData() });
        if (onMutation) return onMutation(route, headers);
        errors.push(`Unexpected mutation: ${request.method()} ${url.pathname}`);
        return route.abort();
      }
      if (Object.hasOwn(overrides, url.pathname)) {
        const override = overrides[url.pathname];
        if (typeof override === 'function') return override(route, headers);
        return route.fulfill({ headers, json: { success: true, data: override, error: null } });
      }
      const defaults = {
        '/api/auth/refresh': { accessToken: 'fixture-only', expiresIn: 3600 },
        '/api/auth/me': { user: { ...user, role, themePreference: theme } },
        '/api/notifications': { notifications: [], unreadCount: 0 },
        '/api/players/me/career': career,
        '/api/players/me/dashboard': { career, memberships: [], tournaments: [], fixtures: [] },
      };
      const data = defaults[url.pathname] ?? phaseData[url.pathname];
      if (!data) { errors.push(`Unmocked API: ${url.pathname}`); return route.abort(); }
      return route.fulfill({ headers, json: { success: true, data, error: null } });
    }
    if (url.hostname !== 'fcarena.in') { errors.push(`Unexpected request: ${url.origin}${url.pathname}`); return route.abort(); }
    try {
      const response = await fetch(`${origin}${url.pathname}${url.search}`, { headers: { ...request.headers(), host: new URL(origin).host } });
      const headers = Object.fromEntries(response.headers);
      for (const key of ['content-encoding', 'transfer-encoding', 'content-length']) delete headers[key];
      return route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
    } catch (error) { errors.push(String(error)); return route.abort(); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && message.text().includes('FC ARENA route error')) errors.push(message.text()); });
  return { context, page, errors, mutations };
}

export async function checkLayout(page, label) {
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, idleAnimations: document.getAnimations().filter(animation => animation.effect?.getTiming().iterations === Infinity).length }));
  if (metrics.scrollWidth > metrics.width + 1) console.log('Overflow diagnostic', label, await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(element).position !== 'absolute').map(element => ({ tag: element.tagName, class: element.className, text: element.textContent?.slice(0, 80), right: element.getBoundingClientRect().right })).slice(0, 12)));
  assert(metrics.scrollWidth <= metrics.width + 1, `${label}: horizontal overflow ${metrics.scrollWidth}`);
  assert.equal(metrics.idleAnimations, 0, `${label}: idle continuous animation`);
}
