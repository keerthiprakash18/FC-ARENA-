import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import path from 'node:path';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

// Every test uses the local build and fixture-only APIs. No production account.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const corePaths = ['/dashboard', '/more', '/profile', '/career', '/leaderboards', '/league-war/phase3', '/matches/phase3', '/tournaments/phase3/standings', '/tournaments/phase3/playoffs', '/tournaments/phase3/wizard/setup', '/fixtures/generate', '/admin/disputes', '/admin/analytics', '/public/tournaments/PHASE3'];
const broadPaths = [
  '/', '/matches/phase3/dispute',
  '/login', '/register', '/forgot-password', '/reset-password', '/verify-email',
  '/about', '/help', '/privacy', '/terms', '/account-deletion',
  '/leagues', '/tournaments', '/fixtures', '/matches', '/fixtures/manage', '/fixtures/generator', '/match-system',
  '/notifications', '/settings', '/settings/appearance', '/announcements', '/ai', '/safety', '/fair-play',
  '/career/leagues', '/career/matches', '/career/tournaments', '/career/achievements', '/community/teams', '/community/invitations',
  '/awards', '/awards/golden-boot', '/awards/golden-glove', '/awards/player-of-tournament', '/awards/rising-star', '/awards/tournament-champion', '/awards/tournament-runner-up', '/awards/winning-streak', '/awards/ballon', '/awards/hall-of-fame', '/discover',
  '/awards/ballon/phase3', '/awards/ballon/phase3/players/phase3', '/discover/players/phase3',
  '/leagues/phase3', '/leagues/phase3/tournaments', '/leagues/phase3/members', '/leagues/phase3/standings', '/leagues/phase3/teams', '/leagues/phase3/fixtures',
  '/tournaments/phase3', '/tournaments/phase3/fixtures', '/tournaments/phase3/groups', '/tournaments/phase3/teams', '/tournaments/phase3/achievements',
  '/leagues/phase3/settings', '/leagues/phase3/roles', '/tournaments/phase3/registration', '/tournaments/phase3/settings', '/tournaments/phase3/stats', '/tournaments/phase3/rankings', '/tournaments/phase3/poster',
  '/admin/leagues', '/admin/tournaments', '/admin/teams', '/admin/fair-play', '/admin/system', '/admin/safety-reports', '/admin/ballon',
  '/admin/android', '/admin/results',
  '/league-war',
  ...['teams', 'groups', 'fixture-settings', 'fixture-preview', 'qualification', 'review'].map(step => `/tournaments/phase3/wizard/${step}`),
  ...['participants', 'rules', 'preview', 'save'].map(step => `/fixtures/generate/${step}`),
];
const issues = [];
async function audit(page, path) {
  await page.goto(`https://fcarena.in${path}`);
  await page.locator('h1, .fc-main').first().waitFor();
  // Allow fixture loads to settle before code-level accessibility inspection.
  await page.waitForTimeout(120);
  if (page.url().includes('/login') && !['/login', '/verify-email'].includes(path)) throw Error(`${path}: unexpected login redirect`);
  assert(!await page.getByText('FC ARENA could not load this screen', { exact: true }).count(), `${path}: route error`);
  if (path === '/tournaments/phase3/rankings') {
    const mobile = page.viewportSize().width < 640;
    assert.equal(await page.getByRole('list', { name: 'Player rankings' }).isVisible(), mobile);
    await page.getByRole('button', { name: 'Best Teams', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Best Teams', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('region', { name: 'Team rankings', exact: true }).isVisible(), mobile);
    assert(await page.getByText('Competition Entry 1', { exact: true }).filter({ visible: true }).count());
  }
  await checkLayout(page, path);
  const problems = await page.evaluate(() => {
    const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
    const fields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
    const missingNames = fields.filter(element => !element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby'));
    const duplicateIds = [...document.querySelectorAll('[id]')].map(element => element.id).filter((id, index, ids) => ids.indexOf(id) !== index);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const luminance = color => {
      context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const lowContrastLabels = [...document.querySelectorAll('.fc-main .field > label')].filter(visible).flatMap(label => {
      const foreground = luminance(getComputedStyle(label).color);
      const background = luminance(getComputedStyle(document.documentElement).getPropertyValue('--theme-surface').trim());
      const ratio = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      return ratio < 4.5 ? [{ text: label.textContent, ratio }] : [];
    });
    return { fields: missingNames.map(element => ({ tag: element.tagName, name: element.name, placeholder: element.getAttribute('placeholder') })), duplicateIds, lowContrastLabels };
  });
  if (problems.fields.length || problems.duplicateIds.length || problems.lowContrastLabels.length) issues.push({ path, ...problems });
}
try {
  for (const width of (process.env.PHASE5_SCOPE ? [] : [360, 390, 768, 1024, 1280, 1440])) {
    for (const theme of ['LUXURY_GOLD', 'CLASSIC_BLUE']) {
      for (const mode of ['LIGHT', 'DARK']) {
        const { page, context, errors, mutations } = await createUiContext(browser, { width, theme, mode });
        for (const routePath of corePaths) {
          await audit(page, routePath);
          if (process.env.PHASE5_SCREENSHOTS && [390, 1440].includes(width) && theme === 'LUXURY_GOLD' && mode === 'LIGHT' && ['/dashboard', '/tournaments/phase3/wizard/setup', '/matches/phase3'].includes(routePath)) {
            await page.screenshot({ path: path.join(process.env.PHASE5_SCREENSHOTS, `phase5-${routePath.replaceAll('/', '_')}-${width}.png`), fullPage: true, animations: 'disabled' });
          }
        }
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme.toLowerCase().replace('_', '-'));
        assert.equal(await page.locator('html').getAttribute('data-mode'), mode.toLowerCase());
        const contrasts = await page.evaluate(() => {
          const styles = getComputedStyle(document.documentElement);
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d');
          const luminance = value => {
            context.fillStyle = value.trim(); context.fillRect(0, 0, 1, 1);
            const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
            return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
          };
          const ratio = (foreground, background) => {
            const a = luminance(styles.getPropertyValue(foreground)), b = luminance(styles.getPropertyValue(background));
            return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          };
          const values = { text: ratio('--theme-text', '--theme-surface'), secondary: ratio('--theme-text-secondary', '--theme-surface'), muted: ratio('--theme-text-muted', '--theme-surface'), primary: ratio('--theme-on-primary', '--theme-primary') };
          return values;
        });
        for (const [name, ratio] of Object.entries(contrasts)) assert(ratio >= 4.5, `${theme}/${mode} ${name} contrast ${ratio}`);
        assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
        await context.close();
        console.log(`PASS Phase 5 ${width}/${theme}/${mode}: ${corePaths.length} core routes, theme/mode, semantics and overflow`);
      }
    }
  }
  for (const width of (process.env.PHASE5_SCOPE === 'zoom' ? [] : [390, 1440])) {
    const { page, context, errors, mutations } = await createUiContext(browser, { width, overrides: { '/api/leagues/my': { leagues: [] } } });
    for (const path of broadPaths) {
      try { await audit(page, path); }
      catch (error) { console.log('Broad route diagnostic', path, await page.locator('body').innerText(), errors); throw error; }
    }
    console.log('Broad accessibility findings', JSON.stringify(issues));
    assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
    await context.close();
    console.log(`PASS Phase 5 broad routes at ${width}: ${broadPaths.length} routes`);
  }
  for (const native of [false, true]) {
    const { page, context, errors } = await createUiContext(browser, { width: 768, native });
    for (const path of ['/dashboard', '/tournaments/phase3/wizard/setup', '/admin/disputes', '/leaderboards']) {
      await audit(page, path);
      // CSS zoom exercises 200% text/control enlargement; a 768px viewport also
      // exercises the reflow width corresponding to a 1536px desktop at 200%.
      await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
      await checkLayout(page, `200% enlargement ${path}/${native}`);
      await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    }
    await page.goto('https://fcarena.in/dashboard'); await page.locator('.fc-main').waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.fc-skip-link').evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.fc-main').evaluate(element => element === document.activeElement), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  for (const path of ['/career/leagues', '/career/achievements', '/tournaments/phase3/wizard/review', '/tournaments/phase3/wizard/qualification', '/tournaments/phase3/rankings']) {
    const { page, context, errors } = await createUiContext(browser, { width: 390, overrides: {
      ...(path.includes('qualification') ? { '/api/auth/me': (_, headers) => _.fulfill({ status: 503, headers, json: { success: false, data: null, error: { code: 'FIXTURE_UNAVAILABLE', message: 'Fixture temporarily unavailable.' } } }) }
        : path.startsWith('/career') ? { '/api/players/me/career': (_, headers) => _.fulfill({ status: 503, headers, json: { success: false, data: null, error: { code: 'FIXTURE_UNAVAILABLE', message: 'Fixture temporarily unavailable.' } } }) }
          : { [`/api/tournaments/phase3/${path.endsWith('review') ? 'wizard/review' : 'rankings'}`]: (_, headers) => _.fulfill({ status: 503, headers, json: { success: false, data: null, error: { code: 'FIXTURE_UNAVAILABLE', message: 'Fixture temporarily unavailable.' } } }) }),
    } });
    await page.goto(`https://fcarena.in${path}`);
    await page.getByRole('alert').filter({ hasText: 'Fixture temporarily unavailable.' }).waitFor();
    assert(await page.getByRole('button', { name: 'Try again', exact: true }).isVisible());
    assert.deepEqual(errors, []); await context.close();
  }
  const roleCheck = await createUiContext(browser, { width: 390, role: 'PLAYER' });
  await roleCheck.page.goto('https://fcarena.in/admin/disputes');
  const adminNav = roleCheck.page.getByRole('navigation', { name: 'Admin sections' });
  await adminNav.waitFor();
  assert.equal(await adminNav.getByRole('link', { name: 'System', exact: true }).count(), 0);
  assert.equal(await adminNav.getByRole('link', { name: 'Android', exact: true }).count(), 0);
  assert.deepEqual(roleCheck.errors, []); await roleCheck.context.close();
  console.log('Accessibility findings', JSON.stringify(issues));
  assert.deepEqual(issues, [], 'Visible fields need associated names; IDs must be unique');
} finally { await browser.close(); }
