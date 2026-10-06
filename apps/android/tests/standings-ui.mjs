// Fixture-only responsive regression: real table rows must remain comparable on phones.
// SMOKE_WEB_ORIGIN=http://127.0.0.1:3100 node apps/android/tests/standings-ui.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament } from './phase-ui-fixtures.mjs';

const capture = process.env.STANDINGS_CAPTURE;
const screenshotDirectory = process.env.STANDINGS_SCREENSHOTS;
if (screenshotDirectory) await fs.mkdir(screenshotDirectory, { recursive: true });
const crest = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 36"><path fill="#d9b765" d="M2 2h28v22L16 34 2 24z"/><path fill="#0d263d" d="M8 8h16v12l-8 7-8-7z"/></svg>')}`;
const names = ['Kerala Kings', 'Arjun Roy / Rahul Shah', 'North East United Football Club', 'Mumbai City', 'FCUnbrokenVeryLongTeamName', 'Arena XI'];
const rows = Array.from({ length: 12 }, (_, index) => ({
  registrationId: `table-entry-${index + 1}`, position: index % 6 + 1,
  entryName: names[index % 6], played: 38, wins: 28 - index, draws: 4, losses: 6 + index,
  goalsFor: index === 0 ? 123 : 82 - index * 3, goalsAgainst: index === 5 ? 123 : 32 + index,
  goalDifference: [91, 46, 42, 0, -8, -56][index % 6], points: 88 - index * 3, form: 'WWDLW',
}));
const groups = ['Group A', 'Group B'].map((name, index) => ({
  id: `group-${index + 1}`, name, position: index + 1,
  entries: rows.slice(index * 6, index * 6 + 6).map((row, entryIndex) => ({
    id: row.registrationId, entryName: row.entryName, entryLogoUrl: entryIndex === 0 ? crest : null, members: [],
  })),
}));
const publicRows = rows.map((row, index) => ({ ...row, position: index + 1, name: row.entryName }));
const overrides = {
  '/api/tournaments/phase3/standings': { tournament, standings: rows },
  '/api/tournaments/phase3/groups': { tournament, groups, unassigned: [] },
  '/api/tournaments/phase3/rankings': {
    ...phaseData['/api/tournaments/phase3/rankings'],
    categories: { ...phaseData['/api/tournaments/phase3/rankings'].categories, bestTeams: { available: true, reason: null, entries: publicRows } },
  },
  '/api/public/tournaments/PHASE3': {
    ...phaseData['/api/public/tournaments/PHASE3'], standings: publicRows,
    groups: groups.map(group => ({ ...group, entries: group.entries.map(entry => ({ id: entry.id, name: entry.entryName, logoUrl: entry.entryLogoUrl })) })),
  },
};
const routes = [
  { url: '/tournaments/phase3/standings', name: 'groups', section: '.premium-standings-table', expected: [rows.slice(0, 6), rows.slice(6)] },
  { url: '/public/tournaments/PHASE3', name: 'public', section: '#standings', expected: [publicRows] },
  { url: '/tournaments/phase3/rankings', name: 'teams', section: 'section:has(.fc-compact-standings), section:has([aria-label="Team rankings"])', expected: [publicRows] },
];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
let checks = 0;

async function auditContrast(sections) {
  const findings = await sections.evaluateAll(sections => {
    const context = document.createElement('canvas').getContext('2d');
    const rgba = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value);
    };
    const over = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3])).concat(1);
    const luminance = rgb => rgb.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    return sections.flatMap(section => [...section.querySelectorAll('.fc-compact-standings :is(th,td,.fc-compact-team-name,p), .premium-standings-group-header :is(h2,p,span)')].flatMap(element => {
      if (!element.getClientRects().length || ![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) return [];
      const ancestors = [];
      for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      const background = ancestors.reduce((color, node) => over(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255, 1]);
      const foreground = over(rgba(getComputedStyle(element).color), background);
      const a = luminance(foreground), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      return ratio < 4.5 ? [{ text: element.textContent.trim(), ratio }] : [];
    }));
  });
  assert.deepEqual(findings, [], 'standings text and group headers must be readable in every theme');
}

async function auditMobileTable(table, expected) {
  assert.deepEqual(await table.locator('thead th').allTextContents(), ['#', 'Team / Duo', 'P', 'W', 'D', 'L', 'Pts']);
  const mainRows = table.locator('tbody > tr:visible');
  assert.equal(await mainRows.count(), expected.length, 'one visible row per team before details are opened');
  for (let index = 0; index < expected.length; index++) {
    const row = mainRows.nth(index), fixture = expected[index];
    const cells = await row.evaluate(row => [...row.children].map(cell => cell.querySelector('.fc-compact-team-name')?.textContent ?? cell.textContent));
    assert.deepEqual(cells.map(cell => cell.trim()), [String(fixture.position), fixture.entryName, String(fixture.played), String(fixture.wins), String(fixture.draws), String(fixture.losses), String(fixture.points)]);
  }
  const metrics = await table.evaluate(element => {
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, height: r.height }; };
    const heads = [...element.querySelectorAll('thead th')].map(rect);
    const rows = [...element.querySelectorAll('tbody tr')].filter(row => !row.hidden);
    return {
      fontSize: parseFloat(getComputedStyle(rows[0].querySelector('td')).fontSize),
      headers: heads,
      rows: rows.map(row => ({ rect: rect(row), cells: [...row.children].map(rect) })),
      crests: rows.map(row => rect(row.querySelector('.premium-crest'))),
      clipping: rows.flatMap(row => [...row.querySelectorAll('td')].filter(cell => cell.scrollWidth > cell.clientWidth + 1).map(cell => cell.textContent)),
      viewport: rect(element.parentElement), overflow: element.parentElement.scrollWidth > element.parentElement.clientWidth + 1,
    };
  });
  assert(metrics.fontSize >= 13, 'readable mobile stats');
  assert.equal(metrics.overflow, false, `all seven columns fit at the target phone widths (container ${metrics.viewport.right - metrics.viewport.left}px)`);
  assert.deepEqual(metrics.clipping, [], 'stat values are never clipped');
  for (const row of metrics.rows) {
    assert(row.rect.height <= 56 && row.rect.height >= 44, `compact row height ${row.rect.height}`);
    for (let col = 0; col < 7; col++) {
      assert(Math.abs(row.cells[col].left - metrics.headers[col].left) < 1, 'header/row left alignment');
      assert(Math.abs(row.cells[col].right - metrics.headers[col].right) < 1, 'header/row right alignment');
      assert(row.cells[col].left >= metrics.viewport.left - 1 && row.cells[col].right <= metrics.viewport.right + 1, 'every column remains visible');
    }
  }
  assert(metrics.crests.every(crest => crest.height >= 24 && crest.right - crest.left >= 24), 'crest stays visible');
  assert(metrics.rows[5].rect.top - metrics.rows[0].rect.top <= 280, 'at least six teams fit in a compact comparison block');

  const first = mainRows.first().getByRole('button');
  await first.focus();
  await first.press('Enter');
  assert.equal(await first.getAttribute('aria-expanded'), 'true');
  const detail = table.locator('.fc-compact-detail-row:visible');
  assert.equal(await detail.count(), 1);
  assert.equal(await detail.locator('strong').textContent(), expected[0].entryName);
  assert.deepEqual(await detail.locator('dt').allTextContents(), ['GF', 'GA', 'GD', 'Form']);
  assert.deepEqual(await detail.locator('dd').allTextContents(), [String(expected[0].goalsFor), String(expected[0].goalsAgainst), `${expected[0].goalDifference > 0 ? '+' : ''}${expected[0].goalDifference}`, expected[0].form]);
  assert(await detail.evaluate(element => {
    const stats = [...element.querySelectorAll('dl > div')].map(stat => stat.getBoundingClientRect().top);
    return Math.max(...stats) - Math.min(...stats) <= 1 && element.getBoundingClientRect().height <= 80;
  }), 'GF/GA/GD/form fit together in a compact secondary row');
  const longNameButton = table.locator('.fc-compact-team-row').nth(4).getByRole('button');
  await longNameButton.click();
  assert.equal(await detail.count(), 1, 'details remain secondary and only one is open');
  assert.equal(await detail.locator('strong').textContent(), expected[4].entryName, 'long names remain available on tap');
  assert.deepEqual(await detail.locator('dd').allTextContents(), [String(expected[4].goalsFor), String(expected[4].goalsAgainst), String(expected[4].goalDifference), expected[4].form]);
  assert(await detail.evaluate(element => document.documentElement.scrollWidth <= innerWidth + 1), 'expanded details stay within the page');
  await longNameButton.click();
  assert.equal(await detail.count(), 0);
  assert.equal(await table.locator('tbody > tr:visible').count(), expected.length);
}

async function audit(options) {
  const { context, page, errors, mutations } = await createUiContext(browser, { ...options, overrides });
  try {
    for (const route of routes) {
      await page.goto(`https://fcarena.in${route.url}`);
      if (route.name === 'teams') await page.getByRole('button', { name: 'Best Teams', exact: true }).click();
      const sections = page.locator(route.section);
      await sections.first().waitFor();
      await page.waitForTimeout(100);
      await checkLayout(page, `${route.name}/${options.width}/${options.theme}/${options.mode}/${options.native || false}`);
      if (capture !== 'before') {
        assert.equal(await sections.locator('.fc-mobile-standings, .fc-public-mobile-table').count(), 0, 'no card-per-team standings renderer');
        const visibleTables = sections.locator('table:visible');
        assert.equal(await visibleTables.count(), route.expected.length);
        if (options.width < 640) {
          await auditContrast(sections);
          for (let index = 0; index < route.expected.length; index++) await auditMobileTable(visibleTables.nth(index), route.expected[index]);
          if (route.name === 'groups') assert.equal(await visibleTables.first().locator('[data-highlighted="true"]').count(), 2, 'existing top-two emphasis is preserved');
          if (route.name !== 'teams') {
            const image = visibleTables.first().locator('.premium-crest img').first();
            assert(await image.evaluate(img => img.complete && img.naturalWidth > 0), 'existing team logo renders');
          }
        } else {
          for (let index = 0; index < route.expected.length; index++) {
            const table = visibleTables.nth(index);
            assert.equal(await table.locator('tbody tr').count(), route.expected[index].length, 'desktop retains every row');
            assert(await table.getByRole('columnheader', { name: 'W', exact: true }).isVisible(), 'desktop/tablet keeps detailed statistics');
            const points = table.locator('thead th');
            const pointIndex = (await points.allTextContents()).findIndex(text => text.trim() === 'PTS');
            assert.deepEqual((await table.locator('tbody tr').evaluateAll((rows, index) => rows.map(row => row.children[index].textContent.trim()), pointIndex)), route.expected[index].map(row => String(row.points)));
            assert(await table.evaluate((table, index) => {
              const container = table.parentElement;
              container.scrollLeft = container.scrollWidth;
              const region = container.getBoundingClientRect(), points = table.querySelector('tbody tr').children[index].getBoundingClientRect();
              const visible = points.left >= region.left - 1 && points.right <= region.right + 1;
              container.scrollLeft = 0;
              return visible;
            }, pointIndex), 'tablet/desktop points remain reachable inside the table container');
          }
        }
      }
      if (screenshotDirectory && options.theme === 'LUXURY_GOLD' && options.mode === 'LIGHT' && !options.native) {
        await sections.first().evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 90));
        await page.screenshot({ path: path.join(screenshotDirectory, `${route.name}-${options.width}.png`), animations: 'disabled' });
        await sections.first().screenshot({ path: path.join(screenshotDirectory, `${route.name}-table-${options.width}.png`), animations: 'disabled' });
      }
      checks++;
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, [], 'UI inspection and row expansion cause no API mutations');
    console.log(`PASS standings ${options.width}/${options.theme}/${options.mode}/${options.native ? 'Android-UA' : 'browser'}`);
  } finally { await context.close(); }
}

try {
  for (const width of [360, 390, 412, 430, 768, 1440]) {
    for (const theme of capture ? ['LUXURY_GOLD'] : ['LUXURY_GOLD', 'CLASSIC_BLUE']) {
      for (const mode of capture ? ['LIGHT'] : ['LIGHT', 'DARK']) await audit({ width, theme, mode });
    }
  }
  if (!capture) for (const width of [360, 390, 412, 430]) for (const mode of ['LIGHT', 'DARK']) await audit({ width, theme: 'LUXURY_GOLD', mode, native: true });
  console.log(`PASS standings total: ${checks} populated route/viewport/theme checks`);
} finally { await browser.close(); }
