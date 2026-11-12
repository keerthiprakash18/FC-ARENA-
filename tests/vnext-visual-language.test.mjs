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
  assert.match(profile, /Verified Player/);
  assert.match(war, /aria-label="Close Create League War form"/);
  assert.match(war, /theme-input border-\[var\(--theme-control-border\)\]/);
});

test('language switch persists only a non-sensitive local preference and updates document lang', () => {
  const provider = read('apps/web/src/components/i18n/app-language.tsx');
  const layout = read('apps/web/src/app/layout.tsx');
  const settings = read('apps/web/src/app/settings/page.tsx');
  assert.match(provider, /fc-arena-ui-language/);
  assert.match(provider, /document\.documentElement\.lang/);
  assert.match(provider, /storage/);
  assert.match(provider, /'ta'/);
  assert.match(layout, /<AppLanguageProvider>/);
  assert.match(settings, /aria-pressed=\{language === 'ta'\}/);
  assert.match(settings, /Untranslated screens remain in English/);
});

test('navigation routes and active state are preserved in Tamil', () => {
  const bottom = read('apps/web/src/components/app/bottom-navigation.tsx');
  const shell = read('apps/web/src/components/app/app-shell.tsx');
  const search = read('apps/web/src/components/app/app-header.tsx');
  assert.match(bottom, /navLabel\(item\.href, item\.shortLabel, true\)/);
  assert.match(bottom, /aria-current/);
  assert.match(shell, /navLabel\(item\.href, item\.shortLabel\)/);
  assert.match(search, /navLabel\(item\.href, item\.label\)/);
  assert.match(search, /பக்கங்களைத் தேடுங்கள்/);
});
