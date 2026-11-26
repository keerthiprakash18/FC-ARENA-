// Exercise task hierarchy with synthetic data only; no production access.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout, career, user } from './phase-ui-harness.mjs';
import { phaseData, tournament, entries } from './phase-ui-fixtures.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-mobile-ui';
mkdirSync(output, { recursive: true });
const season = phaseData['/api/ballon/seasons/phase3/rankings'].season;
const rows = [1, 2, 3].map(position => ({
  ...phaseData['/api/ballon/seasons/phase3/rankings'].rows[0], position,
  userId: position === 1 ? user.id : `rival-${position}`,
  fullName: ['Arjun Roy', 'Rahul Shah', 'Daniel Thomas'][position - 1],
  rating: [93.4, 89.2, 86.7][position - 1],
}));
const fixture = {
  ...phaseData['/api/tournaments/phase3/fixtures'].fixtures[0],
  tournamentId: tournament.id, tournamentName: tournament.name,
  leagueId: tournament.leagueId, leagueName: tournament.league.name,
  home: entries[0], away: entries[1], match: { id: 'phase3', status: 'SCHEDULED' },
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
};
const overrides = {
  '/api/players/opponent/whatsapp': { available: false, url: null },
  '/api/players/me/dashboard': {
    career, memberships: phaseData['/api/leagues/my'].leagues,
    tournaments: [{ ...tournament, status: 'ACTIVE' }], fixtures: [fixture],
  },
  '/api/leagues/phase3/rankings/history': { history: [] },
  '/api/leagues/phase3/tournaments': { tournaments: [{ ...tournament, status: 'REGISTRATION_OPEN' }] },
  '/api/notifications': {
    unreadCount: 2,
    notifications: [
      { id: 'notice-1', type: 'MATCH_REMINDER', title: 'Matchday reminder', message: 'Your next cup match is ready.', href: null, eventAt: '2026-11-25T12:00:00Z', readAt: null },
      { id: 'notice-2', type: 'ACHIEVEMENT_RECEIVED', title: 'Achievement unlocked', message: 'Your verified milestone.', href: null, eventAt: '2026-11-25T12:00:00Z', readAt: null },
    ],
  },
  '/api/awards/overview': {
    ...phaseData['/api/awards/overview'],
    currentBallon: { season, rankings: { locked: false, rows } },
    trophyCabinet: { GOLDEN_BOOT: 2 },
  },
};
const routes = ['/dashboard', '/fixtures', '/leaderboards', '/awards', '/awards/golden-boot', '/profile', '/career', '/more', '/tournaments', '/notifications', '/login'];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
let checks = 0;
try {
  for (const width of [320, 390, 1280]) for (const mode of ['LIGHT', 'DARK']) {
    const f = await createUiContext(browser, {
      width, mode, direct: true, native: width < 500, reducedMotion: 'reduce', overrides,
    });
    try {
      for (const route of routes) {
        const page = f.page;
        await page.goto(origin + route);
        await page.locator('h1, h2').first().waitFor();
        if (route === '/dashboard') {
          const match = page.getByRole('region', { name: 'Match overview', exact: true });
          await match.waitFor();
          assert.equal(await match.getByRole('link', { name: 'View Match', exact: false }).count(), 1);
          assert.equal(await page.getByRole('heading', { name: 'Your next steps', exact: true }).count(), 0,
            'A visible match card must not be repeated in the action queue');
          assert.equal(await match.getByRole('link').filter({ hasText: 'View match details' }).count(), 0);
          await match.getByRole('button', { name: /Competition Entry 2/ }).click();
          await page.getByRole('dialog').getByText('Player 2', { exact: true }).first().waitFor();
          await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
          if (width >= 1100) {
            const welcome = await page.locator('.premium-home-hero').boundingBox();
            const next = await match.boundingBox();
            assert(Math.abs(welcome.y - next.y) < 3, 'Desktop welcome and next match share the main row');
          }
        }
        if (route === '/fixtures') {
          const heading = page.locator('.premium-hero--editorial');
          assert.equal(await heading.locator('svg.premium-pitch').count(), 0);
          assert.equal(await heading.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
          const filters = page.getByRole('group', { name: 'Filter matches by status' });
          await filters.waitFor();
          await filters.getByRole('button', { name: 'COMPLETED', exact: true }).click();
          assert.equal(await filters.getByRole('button', { name: 'COMPLETED', exact: true }).getAttribute('aria-pressed'), 'true');
          await filters.getByRole('button', { name: 'ALL', exact: true }).click();
        }
        if (route === '/leaderboards') {
          const history = page.locator('.fc-rank-history');
          await history.waitFor();
          assert.equal(await history.getAttribute('open'), null);
          await history.locator('summary').click();
          await history.getByText('No historical daily snapshots recorded yet.', { exact: true }).waitFor();
          await history.locator('summary').click();
        }
        if (route === '/awards') {
          const podium = page.getByRole('region', { name: 'Season podium' });
          await podium.waitFor();
          assert.equal(await podium.getByRole('link').count(), 3);
          assert.equal(await podium.locator('[data-rank="1"] .premium-rating').textContent(), '93.4');
          assert(await page.locator('.premium-awards-hero').evaluate(el =>
            Boolean(el.compareDocumentPosition(document.querySelector('.fc-awards-guide')) & Node.DOCUMENT_POSITION_FOLLOWING)),
          'Real rankings lead; supplementary award guidance follows');
          const guide = page.getByRole('region', { name: 'Find your tournament and Duo awards' });
          await guide.getByText('Where are my awards?', { exact: true }).click();
          assert(await guide.getByText('Summary → Team Trophy Archive', { exact: false }).isVisible());
          assert.equal(await guide.getByRole('link').count(), 2);
        }
        if (route === '/profile') {
          const save = page.getByRole('button', { name: 'Save profile', exact: true });
          const fullName = page.locator('input[name="fullName"]');
          await save.waitFor();
          const originalName = await fullName.inputValue();
          assert(await save.evaluate(el => Boolean(document.querySelector('input[name="gameUid"]').compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)),
            'Save action follows all editable identity fields in document and keyboard order');
          assert((await save.boundingBox()).height >= 44, 'Profile save has a finger-sized target');
          await fullName.fill('x');
          await save.click();
          await page.getByRole('alert').filter({ hasText: 'Full name must be between 2 and 120 characters.' }).waitFor();
          assert.deepEqual(f.mutations, [], 'Invalid profile edits must not issue a mutation');
          await fullName.fill(originalName);
        }
        if (route === '/career') {
          const breakdown = page.getByRole('region', { name: 'Match outcomes' });
          await breakdown.waitFor();
          for (const [label, count] of [['Wins', 2], ['Draws', 1], ['Losses', 1]]) {
            const meter = breakdown.getByRole('meter', { name: `${label}: ${count} of 4 matches` });
            assert.equal(await meter.getAttribute('value'), String(count));
            assert.equal(await meter.getAttribute('max'), '4');
          }
        }
        if (route === '/more') {
          const search = page.getByRole('searchbox', { name: 'Find a feature' });
          await search.waitFor();
          await search.fill('Tournament Management');
          const results = page.getByRole('region', { name: 'Feature search results' });
          await results.getByRole('link', { name: /Tournament Management/ }).waitFor();
          await search.fill('no-feature-matches-this');
          await results.getByRole('heading', { name: 'No matching features' }).waitFor();
          await page.getByRole('button', { name: 'Clear search' }).click();
          const essentials = page.getByRole('region', { name: 'Player essentials' });
          await essentials.waitFor();
          const awardsLink = essentials.getByRole('link', { name: /Awards & DUO\/TEAM Honours/ });
          assert.equal(await awardsLink.getAttribute('href'), '/awards');
          assert.equal(await awardsLink.evaluate(el => getComputedStyle(el).display), 'flex');
          assert(await awardsLink.evaluate(el => {
            const icon = el.firstElementChild.getBoundingClientRect();
            const copy = el.children[1].getBoundingClientRect();
            return icon.right <= copy.left && Math.abs(icon.top + icon.height / 2 - copy.top - copy.height / 2) < 2;
          }), 'Directory icons and copy share one readable row');
        }
        if (route === '/tournaments') {
          const capacity = page.getByRole('progressbar', { name: 'Responsive Cup: 2 approved of 8 entry limit' });
          await capacity.waitFor();
          assert.equal(await capacity.getAttribute('value'), '2');
          assert.equal(await capacity.getAttribute('max'), '8');
        }
        if (route === '/notifications') {
          const search = page.getByRole('searchbox', { name: 'Search loaded notifications' });
          await search.waitFor();
          await page.getByRole('heading', { name: 'Matchday reminder', exact: true }).waitFor();
          await search.fill('milestone');
          await page.getByRole('heading', { name: 'Achievement unlocked', exact: true }).waitFor();
          assert.equal(await page.getByRole('heading', { name: 'Matchday reminder', exact: true }).count(), 0);
          await search.fill('no such notification');
          await page.getByRole('heading', { name: 'No matching notifications' }).waitFor();
          await page.getByRole('button', { name: 'Clear search' }).click();
          await page.getByRole('heading', { name: 'Matchday reminder', exact: true }).waitFor();
        }
        if (route === '/login') {
          // Navigate with the keyboard to ensure focus-visible, not just :focus.
          await page.keyboard.press('Tab');
          const field = await page.locator('input:focus-visible').count();
          assert(field > 0, 'The first login field can be reached with the keyboard');
          const outline = await page.locator('input:focus-visible').evaluate(el => {
            const s = getComputedStyle(el); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
          });
          assert(outline.style !== 'none' && outline.width >= 2, 'Login fields have a visible keyboard ring');
          const hintContrast = await page.locator('.field p').first().evaluate(el => {
            const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
            const luminance = channels => channels.slice(0, 3).reduce((sum, value, i) => {
              const v = value / 255;
              return sum + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
            }, 0);
            const bg = rgb(getComputedStyle(document.querySelector('input')).backgroundColor);
            const fg = rgb(getComputedStyle(el).color);
            const alpha = fg[3] ?? 1;
            const a = luminance(fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)));
            const b = luminance(bg);
            return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          });
          assert(hintContrast >= 4.5, `Login help text requires AA contrast (${hintContrast.toFixed(2)})`);
          assert(await page.getByRole('region', { name: 'Other sign-in options' }).getByRole('button').evaluateAll(buttons =>
            buttons.every(button => button.scrollWidth <= button.clientWidth + 1)), 'Provider labels must fit mobile controls');
        }
        await checkLayout(page, `Hierarchy ${route}/${width}/${mode}`);
        assert.equal(new URL(page.url()).pathname, route);
        if (width === 390) {
          await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
          await page.screenshot({ path: join(output, `hierarchy-${route.replaceAll('/', '_')}-${mode.toLowerCase()}.png`), animations: 'disabled' });
        }
        checks++;
      }
      assert.deepEqual(f.errors, []);
      assert.deepEqual(f.mutations, [], 'A UI audit must not mutate accounts, scores or competition data');
      console.log(`PASS hierarchy ${width}px ${mode}: ${routes.length} screens, match identity, ranking and disclosures`);
    } finally { await f.context.close(); }
  }
  // Exercise the actual search UI as a non-admin account using synthetic data.
  // This is a navigation visibility test; server-side authorization remains authoritative.
  const playerContext = await createUiContext(browser, {
    width: 390, direct: true, native: true, role: 'USER',
    overrides: { '/api/leagues/my': {
      leagues: phaseData['/api/leagues/my'].leagues.map(membership => ({ ...membership, adminRole: null })),
    } },
  });
  try {
    const page = playerContext.page;
    await page.goto(origin + '/more');
    const search = page.getByRole('searchbox', { name: 'Find a feature' });
    await search.waitFor();
    await search.fill('admin');
    const results = page.getByRole('region', { name: 'Feature search results' });
    await results.waitFor();
    assert.equal(await results.locator('a[href^="/admin/"]').count(), 0);
    await search.fill('awards');
    await results.getByRole('link', { name: /Awards & DUO\/TEAM Honours/ }).waitFor();
    assert.equal(await results.locator('a[href^="/admin/"]').count(), 0);
    assert.deepEqual(playerContext.errors, []);
    assert.deepEqual(playerContext.mutations, []);
    console.log('PASS non-admin feature search preserves awards access without admin links');
  } finally { await playerContext.context.close(); }
  console.log(`PASS premium hierarchy: ${checks} route/viewport/mode cases`);
} finally { await browser.close(); }
