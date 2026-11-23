import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const css = read('apps/web/src/app/obsidian-matchday.css');
const layout = read('apps/web/src/app/layout.tsx');
const cup = read('apps/web/src/app/tournaments/cup.module.css');
const tokens = read('apps/web/src/app/design-tokens.css');

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(part => Number.parseInt(part, 16) / 255);
  return channels.reduce((sum, raw, i) => {
    const linear = raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('V13 can be switched off without altering the V12 cascade', () => {
  const prior = layout.indexOf("import './arena-consolidated.css';");
  const next = layout.indexOf("import './obsidian-matchday.css';");
  assert(prior >= 0 && next > prior, 'new visual layer must load after the V12 CSS');
  assert.equal(layout.match(/obsidian-matchday\.css/g)?.length, 1);
  assert.match(layout, /data-theme="luxury-gold"/);
  assert.match(layout, /data-mode="light"/);
  assert.match(css, /FC ARENA \/ OBSIDIAN MATCHDAY/);
  assert.doesNotMatch(css, /@import\s+url\(/i);
});

test('brand light and dark text and gold details meet at least AA contrast', () => {
  const pairs = [
    ['#14222e', '#ffffff'],
    ['#536372', '#ffffff'],
    ['#8a631f', '#ffffff'],
    ['#142b40', '#ffffff'],
    ['#d9b977', '#0c1722'],
    ['#f3f6f5', '#141e2a'],
    ['#b7c5d0', '#141e2a'],
    ['#e6c681', '#141e2a'],
  ];
  for (const [fg, bg] of pairs) {
    assert(contrast(fg, bg) >= 4.5, `${fg} on ${bg} does not meet AA`);
  }
  for (const hex of ['#0c1722', '#f5f6f4', '#d9b977', '#23815c', '#ba3948']) {
    assert(css.includes(hex), `missing brand role ${hex}`);
  }
});

test('club themes and user preferences remain supported without a new mode', () => {
  const names = [
    'classic-blue','city-sky','london-red','mersey-red','madrid-royal',
    'catalan-nights','munich-red','paris-night','milan-blue','milan-red','turin-mono',
  ];
  for (const name of names) {
    assert(tokens.includes(`data-theme="${name}"`), `missing saved club theme ${name}`);
    assert(layout.includes(`'${name}'`), `missing bootstrapped theme ${name}`);
  }
  assert.match(css, /All existing club palettes stay editable/);
  assert.doesNotMatch(css, /fc-arena-theme-preference\s*=/);
});

test('editorial pages no longer get a stadium card and featured moments remain distinct', () => {
  for (const fragment of [
    '.fc-page-heading {',
    'background: none !important',
    '.premium-home-hero',
    '.premium-fixture-page',
    '.fc-leaderboard-page',
    '.fc-profile-page',
    '.premium-prestige-gateway',
    '.premium-admin-controls',
    '.theme-bottom-nav',
    '@media (max-width: 640px)',
    '@media (forced-colors: active)',
    '@media (prefers-reduced-motion: reduce)',
  ]) {
    assert(css.includes(fragment), `missing premium experience coverage: ${fragment}`);
  }
  assert.match(css, /min-height: 44px/);
  assert.match(css, /outline: 3px solid var\(--theme-focus\)/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});

test('Cup Center restyling does not redefine the tournament Studio or its settings', () => {
  const marker = '/* OBSIDIAN MATCHDAY V13: Cup Center display-only refinement. */';
  const start = cup.indexOf(marker);
  assert(start > 0, 'Cup Center changes should be an isolated section');
  const addition = cup.slice(start);
  assert.match(addition, /\.center \/?\.hero|\.center \.hero/);
  assert.doesNotMatch(addition, /\.studio\s*\{/);
  assert.doesNotMatch(addition, /fetch\(|onClick|deleteTournament/);
  assert.match(addition, /forced-colors: active/);
});
