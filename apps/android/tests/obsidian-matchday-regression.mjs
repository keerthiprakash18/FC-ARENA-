// Obsidian Matchday browser checks against local Web + intercepted API fixtures.
// No production data/account access or writes. Native viewport uses the same
// user agent employed by the Android WebView regression harness.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-mobile-ui';
mkdirSync(output, { recursive: true });
const themes = [
  'luxury-gold', 'classic-blue', 'city-sky', 'london-red', 'mersey-red',
  'madrid-royal', 'catalan-nights', 'munich-red', 'paris-night',
  'milan-blue', 'milan-red', 'turin-mono',
];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
try {
  for (const width of [360, 390, 430, 768, 1440]) for (const mode of ['LIGHT','DARK']) {
    const native = width <= 430;
    const fixture = await createUiContext(browser, {
      width, mode, theme: 'LUXURY_GOLD', native, direct: true, reducedMotion: 'reduce'
    });
    try {
      await fixture.page.goto(origin + '/dashboard');
      await fixture.page.locator('.premium-home-hero').waitFor();
      await fixture.page.locator('.home-core-actions').waitFor();
      const report = await fixture.page.evaluate(() => {
        const root = document.documentElement;
        const shell = document.querySelector('.fc-app-shell');
        const hero = document.querySelector('.premium-home-hero');
        const sidebar = document.querySelector('.theme-sidebar');
        const nav = document.querySelector('.theme-bottom-nav');
        return {
          mode: root.dataset.mode,
          theme: root.dataset.theme,
          canvas: getComputedStyle(root).getPropertyValue('--theme-background').trim(),
          sidebar: getComputedStyle(sidebar).backgroundColor,
          heroRadius: getComputedStyle(hero).borderRadius,
          horizontalOverflow: root.scrollWidth > innerWidth + 1,
          shell: Boolean(shell),
          visibleNav: Boolean(nav) && getComputedStyle(nav).display !== 'none',
          navDestinations: nav?.querySelectorAll('a').length ?? 0,
          primaryControls: document.querySelectorAll('.home-core-actions a').length,
        };
      });
      assert.equal(report.theme, 'luxury-gold');
      assert.equal(report.mode, mode.toLowerCase());
      assert.equal(report.canvas, mode === 'LIGHT' ? '#f5f6f4' : '#0c131c');
      assert.equal(report.sidebar, 'rgb(12, 23, 34)');
      assert(report.shell);
      assert(!report.horizontalOverflow, `Dashboard overflow at ${width} / ${mode}`);
      assert.equal(report.primaryControls, 4, 'Quick actions retain all four existing destinations');
      assert.equal(report.navDestinations, 5, 'All mobile nav destinations remain');
      if (width <= 768) assert(report.visibleNav, 'Mobile navigation must remain visible');
      await checkLayout(fixture.page, `Obsidian dashboard ${width} ${mode}`);

      // Verify all saved club themes and both modes still have valid colors,
      // no horizontal overrun and no focus trap across the current shell.
      if (width === 390) {
        const results = await fixture.page.evaluate(themes => {
          const root = document.documentElement, issues = [];
          const before = { theme: root.dataset.theme, mode: root.dataset.mode };
          for (const theme of themes) for (const mode of ['light','dark']) {
            root.dataset.theme = theme;
            root.dataset.mode = mode;
            const styles = getComputedStyle(root);
            if (!styles.getPropertyValue('--theme-text').trim()) issues.push(`missing text: ${theme}/${mode}`);
            if (!styles.getPropertyValue('--theme-surface').trim()) issues.push(`missing surface: ${theme}/${mode}`);
            if (root.scrollWidth > innerWidth + 1) issues.push(`overflow: ${theme}/${mode}`);
          }
          root.dataset.theme = before.theme;
          root.dataset.mode = before.mode;
          return issues;
        }, themes);
        assert.deepEqual(results, [], 'All twelve themes must fit 390px');
      }
      await fixture.page.screenshot({
        path: join(output, `obsidian-dashboard-${mode.toLowerCase()}-${width}.png`),
        fullPage: true, animations: 'disabled'
      });
      assert.deepEqual(fixture.mutations, [], 'Design inspection must not trigger API writes');
      assert.deepEqual(fixture.errors, [], 'No JavaScript/fixture errors on Dashboard');
      console.log(`PASS dashboard ${width}px ${mode} with ${native ? 'Android WebView' : 'web'} layout`);
    } finally {
      await fixture.context.close();
    }
  }

  // Headings in Admin and other routine destinations must not inherit the
  // old dark stadium treatment. The details of the admin data remain mocked.
  for (const width of [390, 1440]) {
    const fixture = await createUiContext(browser, {
      width, mode: 'LIGHT', theme: 'LUXURY_GOLD', native: width < 500, direct: true,
      reducedMotion: 'reduce',
    });
    try {
      await fixture.page.goto(origin + '/admin/tournaments');
      const heading = fixture.page.locator('.fc-page-heading');
      await heading.waitFor();
      const background = await heading.evaluate(el => getComputedStyle(el).backgroundImage);
      assert.equal(background, 'none', 'Admin headings should be editorial, not stadium heroes');
      await checkLayout(fixture.page, `Obsidian admin ${width}`);
      await fixture.page.screenshot({
        path: join(output, `obsidian-admin-${width}.png`),
        fullPage: true, animations: 'disabled'
      });
      assert.deepEqual(fixture.mutations, [], 'Admin design review is read-only');
      console.log(`PASS admin editorial header ${width}px`);
    } finally {
      await fixture.context.close();
    }
  }
} finally {
  await browser.close();
}
