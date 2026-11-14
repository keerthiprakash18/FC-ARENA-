import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('new visual layer uses all existing club themes and remains responsive', () => {
  const layout = read('apps/web/src/app/layout.tsx');
  const css = read('apps/web/src/app/vnext-visual-polish.css');
  assert.match(layout, /import '\.\/vnext-visual-polish\.css'/);
  assert.match(css, /--theme-primary/);
  assert.match(css, /--theme-surface/);
  assert.match(css, /--theme-border/);
  assert.match(css, /--theme-control-border/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /@import.*https?:\/\//);
});

test('profile and league-war design follow shared hierarchy and themed controls', () => {
  const profile = read('apps/web/src/app/profile/page.tsx');
  const war = read('apps/web/src/app/league-war/page.tsx');
  assert.match(profile, /fc-profile-page space-y-6/);
  assert.match(profile, /<FcPageHeader/);
  assert.match(profile, /aria-label="Profile photo"/);
  assert.match(profile, /Verified game identity/);
  assert.match(profile, /Game identity status/);
  assert.doesNotMatch(profile, /Verification Pending/);
  assert.match(war, /aria-label="Close Create League War form"/);
  assert.match(war, /theme-input border-\[var\(--theme-control-border\)\]/);
});

test('the English interface declares its language without loading a language preference', () => {
  const layout = read('apps/web/src/app/layout.tsx');
  const settings = read('apps/web/src/app/settings/page.tsx');
  assert.match(layout, /lang="en"/);
  assert.doesNotMatch(layout, /AppLanguageProvider|fc-arena-ui-language/);
  assert.doesNotMatch(settings, /App language|useAppLanguage/);
});

test('navigation exposes English labels and current-page semantics', () => {
  const bottom = read('apps/web/src/components/app/bottom-navigation.tsx');
  const shell = read('apps/web/src/components/app/app-shell.tsx');
  const search = read('apps/web/src/components/app/app-header.tsx');
  assert.match(bottom, /item\.shortLabel/);
  assert.match(bottom, /aria-current/);
  assert.match(shell, /item\.shortLabel/);
  assert.match(search, /Search app sections/);
  assert.doesNotMatch(bottom + shell + search, /[\u0B80-\u0BFF]/u);
});
