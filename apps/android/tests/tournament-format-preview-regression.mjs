import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament } from './phase-ui-fixtures.mjs';
import { describeTournamentFormat } from '../../api/dist/tournaments/tournament-format-guide.js';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = path.resolve('.cache/format-preview/screenshots'); fs.mkdirSync(output, { recursive: true });
const base = { name: 'Arena Champions · Season 2026', competitionFormat: 'UCL_CUP', mode: 'SOLO', teamSize: 1, maxEntries: 36, status: 'ONGOING', groupMode: 'SINGLE_GROUP', legType: 'SINGLE_LEG', fixtureMode: 'AUTOMATIC', playoffSource: 'AUTO', qualifiersPerGroup: null, playoffQualifiersTotal: null, playoffFormat: 'GLOBAL_SEEDED', playoffSeedingBasis: 'AUTO', _count: { registrations: 22 }, groups: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
let layouts = 0, modes = 0, themeContrasts = 0;
const themes = ['luxury-gold', 'classic-blue', 'city-sky', 'london-red', 'mersey-red', 'madrid-royal', 'catalan-nights', 'munich-red', 'paris-night', 'milan-blue', 'milan-red', 'turin-mono'];
async function contextFor(width, height, mode, input = base, route = '/tournaments/phase3', reducedMotion = 'reduce') {
  const guide = describeTournamentFormat(input), t = { ...tournament, competitionFormat: input.competitionFormat, formatGuide: guide };
  const fixture = await createUiContext(browser, { width, mode, native: width < 500, direct: true, role: 'USER', reducedMotion, overrides: {
    '/api/tournaments/phase3': { tournament: t },
    '/api/tournaments/phase3/standings': { ...phaseData['/api/tournaments/phase3/standings'], tournament: t },
    '/api/public/tournaments/PHASE3': { ...phaseData['/api/public/tournaments/PHASE3'], tournament: t },
  }, onMutation: (route, headers) => {
    assert.equal(new URL(route.request().url()).pathname, '/api/telemetry/web-vitals');
    return route.fulfill({ status: 204, headers });
  } });
  await fixture.page.setViewportSize({ width, height });
  fixture.page.setDefaultTimeout(45000);
  await fixture.page.goto(origin + route, { timeout: 90000 });
  await fixture.page.getByRole('button', { name: /^View format diagram/ }).click();
  await fixture.page.getByRole('dialog', { name: 'Format diagram', exact: true }).waitFor();
  return { ...fixture, guide };
}
async function inspectImage(page) {
  const result = await page.locator('.fc-format-graph').evaluate(svg => {
    const luminance = rgb => {
      const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return values.reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    };
    const issues = [], ratios = [];
    for (const node of svg.querySelectorAll('[data-node]')) {
      const surface = node.querySelector('rect'), rect = surface.getBBox(), bg = luminance(getComputedStyle(surface).fill);
      for (const text of node.querySelectorAll('text')) {
        const b = text.getBBox(), fg = luminance(getComputedStyle(text).fill);
        ratios.push((Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05));
        if (b.x < 8 || b.x + b.width > rect.width - 7 || b.y < 6 || b.y + b.height > rect.height - 3) issues.push({ node: node.dataset.node, text: text.textContent, box: { x: b.x, y: b.y, w: b.width, h: b.height }, width: rect.width });
      }
    }
    return { issues, minimumContrast: Math.min(...ratios) };
  });
  assert.deepEqual(result.issues, [], 'All image labels stay inside their cards');
  assert(result.minimumContrast >= 4.5, `Image text contrast ${result.minimumContrast}`);
}
try {
  for (const [width, height] of [[320, 740], [390, 850], [768, 900], [1280, 850], [390, 560], [844, 390]]) for (const mode of ['LIGHT', 'DARK']) {
    const { page, context, errors } = await contextFor(width, height, mode);
    const dialog = page.getByRole('dialog', { name: 'Format diagram', exact: true });
    assert.equal(await dialog.locator('[data-node="direct"] .fc-format-node-value').textContent(), '4');
    assert.equal(await dialog.locator('[data-node="playoff"] .fc-format-node-value').textContent(), '8');
    assert.equal(await dialog.locator('[data-node="eliminated"] .fc-format-node-value').textContent(), '10');
    assert.equal(await dialog.locator('[data-node="round-8"] .fc-format-node-value').textContent(), '8');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    for (const name of ['Close format diagram', 'Zoom in', 'Zoom out', 'Fit']) {
      const box = await dialog.getByRole('button', { name, exact: true }).boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= height && box.x >= 0 && box.x + box.width <= width, `${name} remains reachable at ${width}×${height}`);
    }
    await inspectImage(page);
    const fittedWidth = await dialog.locator('.fc-format-graph').evaluate(svg => svg.getBoundingClientRect().width);
    await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
    assert.match(await dialog.getByLabel('Zoom level').innerText(), /125%/);
    await page.waitForFunction(fittedWidth => { const svg = document.querySelector('.fc-format-graph'); return Math.round(svg.getBoundingClientRect().width / fittedWidth * 100) === 125; }, fittedWidth);
    await dialog.getByRole('button', { name: 'Fit', exact: true }).click();
    await page.keyboard.press('Tab'); assert(await page.evaluate(() => !!document.activeElement.closest('dialog')));
    await dialog.locator('.fc-format-image-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert(await dialog.getByRole('button', { name: 'Close format diagram', exact: true }).isVisible());
    await dialog.locator('.fc-format-image-scroll').evaluate(element => { element.scrollTop = 0; });
    if (mode === 'DARK' && [390, 1280].includes(width) && height === 850) await page.screenshot({ path: path.join(output, `format-${width}-dark.png`) });
    await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0);
    assert(await page.getByRole('button', { name: /^View format diagram/ }).evaluate(button => button === document.activeElement));
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.getByRole('button', { name: /^View format diagram/ }).click();
    assert.match(await page.getByLabel('Zoom level').innerText(), /100%/);
    await page.mouse.click(1, 1); assert.equal(await dialog.count(), 0);
    await checkLayout(page, `Format preview ${width}×${height} ${mode}`); assert.deepEqual(errors, []); await context.close(); layouts++;
  }
  for (const [name, input] of [
    ['ucl-36', { ...base, _count: { registrations: 36 } }],
    ['double-chance', { ...base, competitionFormat: 'ELITE_CUP', playoffFormat: 'DOUBLE_CHANCE', _count: { registrations: 16 } }],
    ['three-double', { ...base, competitionFormat: 'ELITE_CUP', playoffFormat: 'DOUBLE_CHANCE', _count: { registrations: 3 } }],
    ['protected-six', { ...base, competitionFormat: 'ELITE_CUP', playoffFormat: 'PROTECTED_SEED', playoffQualifiersTotal: 6 }],
    ['league', { ...base, competitionFormat: 'LEAGUE_ROUND_ROBIN' }],
    ['pending', { ...base, competitionFormat: 'GROUP_STAGE_KNOCKOUT', playoffSource: 'GROUP_QUALIFIERS' }],
    ['custom', { ...base, competitionFormat: 'CUSTOM_MANUAL' }],
  ]) {
    const { page, context, errors } = await contextFor(1280, 900, 'DARK', input);
    await inspectImage(page);
    if (name.includes('double')) {
      assert(await page.locator('[data-second-chance]').count());
      await page.getByText('Read diagram as text', { exact: true }).click();
      assert.match(await page.locator('.fc-format-image-text').innerText(), /Second chance/);
      if (name === 'double-chance') await page.screenshot({ path: path.join(output, 'double-chance-dark.png') });
    }
    if (['pending', 'custom', 'league'].includes(name)) assert.equal(await page.locator('[data-node^="round-"]').count(), 0);
    if (name === 'pending') assert.equal(await page.locator('[data-node="champion"]').count(), 0);
    assert.deepEqual(errors, []); await context.close(); modes++;
  }
  const { page, context, errors } = await contextFor(1280, 850, 'LIGHT', base, '/public/tournaments/PHASE3', 'no-preference');
  for (const mode of ['light', 'dark']) for (const theme of themes) {
    await page.evaluate(({ theme, mode }) => { document.documentElement.dataset.mode = mode; document.documentElement.dataset.theme = theme; }, { theme, mode });
    await inspectImage(page); themeContrasts++;
  }
  await page.waitForTimeout(700); assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0, 'Entry animations finish and leave no ongoing motion');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert(await page.getByRole('button', { name: 'Zoom in', exact: true }).isDisabled());
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  assert(await page.getByRole('button', { name: 'Zoom out', exact: true }).isDisabled());
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.getByRole('button', { name: 'Close format diagram', exact: true }).click();
  assert.deepEqual(errors, []); await context.close();
  console.log(JSON.stringify({ layouts, formatVariants: modes, themeContrasts, accessibility: 'focus, Escape, backdrop, readable SVG text', output }));
} finally { await browser.close(); }
