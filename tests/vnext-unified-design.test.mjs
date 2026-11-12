import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const styles = read('apps/web/src/app/vnext-interaction-system.css');
const layout = read('apps/web/src/app/layout.tsx');
const tokens = read('apps/web/src/app/design-tokens.css');

test('single design foundation is loaded after other authored UI layers', () => {
  assert.match(layout, /import '\.\/vnext-interaction-system\.css';/);
  assert.ok(layout.indexOf("import './vnext-interaction-system.css'") >
            layout.indexOf("import './native-android.css'"));
  assert.match(styles, /\.fc-premium \.fc-main/);
  assert.doesNotMatch(styles, /@import\s+url/);
});

test('same interaction and tap-target standards apply across feature screens', () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /outline-offset: 3px/);
  assert.match(styles, /44px/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /max-width: 430px/);
  assert.match(styles, /max-width: 100%/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /forced-colors: active/);
});

test('brand and multi-mode colors come from existing theme tokens', () => {
  assert.match(styles, /var\(--theme-primary\)/);
  assert.match(styles, /var\(--theme-primary-bright/);
  assert.match(styles, /var\(--fc-control-radius\)/);
  assert.match(tokens, /--fc-control-height: 44px/);
  assert.match(tokens, /\[data-mode="dark"\]/);
});

test('shared page headings and status labels remain usable at 360px', () => {
  const ui = read('apps/web/src/components/fc/fc-ui.tsx');
  const css = read('apps/web/src/app/vnext-visual-polish.css');
  assert.match(css, /\.fc-page-heading-actions\s*\{[^}]*min-width: 0;[^}]*flex-wrap: wrap;/);
  assert.match(ui, /inline-flex max-w-full items-center rounded-full/);
  assert.match(ui, /<header className="fc-page-heading">/);
});

test('UI foundation cannot alter back-end records or require an API', () => {
  assert.doesNotMatch(styles, /https?:\/\//);
  assert.doesNotMatch(styles, /\b(fetch|axios|POST|DELETE|PATCH)\b/i);
  const modules = [
    'apps/web/src/app/dashboard/page.tsx',
    'apps/web/src/app/profile/page.tsx',
    'apps/web/src/app/leaderboards/page.tsx',
    'apps/web/src/app/tournaments/page.tsx',
    'apps/web/src/app/fixtures/page.tsx',
    'apps/web/src/app/league-war/page.tsx',
    'apps/web/src/app/notifications/page.tsx',
    'apps/web/src/app/arena-talk/page.tsx',
    'apps/web/src/app/awards/page.tsx',
    'apps/web/src/app/admin/analytics/page.tsx',
  ];
  modules.forEach(relative => assert.ok(fs.existsSync(path.join(root, relative)), relative));
});
