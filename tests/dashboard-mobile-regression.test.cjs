const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('classic dashboard hero contract stays intact', () => {
  const dashboard = read('apps/web/src/app/dashboard/page.tsx');

  for (const signature of [
    'fc-dashboard-hero fc-stadium-surface relative min-h-[220px] overflow-hidden rounded-2xl border',
    'relative z-10 grid min-h-[220px] gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[auto_minmax(0,1fr)_300px]',
    'WELCOME BACK',
    'Your next match. Your club. Your season.',
  ]) {
    assert.ok(
      dashboard.includes(signature),
      `Dashboard hero signature changed: ${signature}`,
    );
  }
});

test('mobile bottom navigation remains five equal columns', () => {
  const premiumCss = read('apps/web/src/app/premium-redesign.css');
  const navigation = read('apps/web/src/components/app/primary-navigation.ts');

  assert.match(
    premiumCss,
    /\.premium-primary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/s,
  );

  const primaryItems = [
    "href: '/dashboard'",
    "href: '/leagues'",
    "href: '/tournaments'",
    "href: '/fixtures'",
    "href: '/more'",
  ];

  for (const item of primaryItems) {
    assert.ok(navigation.includes(item), `Missing primary mobile destination: ${item}`);
  }
});

test('mobile visual smoke covers target production widths', () => {
  const smoke = read('apps/android/tests/smoke.mjs');
  for (const width of [360, 390, 412, 430]) {
    assert.ok(smoke.includes(String(width)), `Missing mobile smoke width: ${width}`);
  }
});


test('native Android dashboard matches mobile web geometry', () => {
  const nativeCss = read('apps/web/src/app/native-android.css');

  for (const signature of [
    'padding-top: 20px !important;',
    'padding-left: 16px !important;',
    'padding-right: 16px !important;',
    'min-height: 220px !important;',
    'padding: 20px !important;',
    'gap: 16px !important;',
    'font-size: clamp(28px, 5vw, 42px) !important;',
    'line-height: 1.1 !important;',
    'margin-top: 12px !important;',
    'font-size: 14px !important;',
    'line-height: 24px !important;',
    'row-gap: 16px !important;',
    'gap: 18px !important;',
    'grid-template-columns: repeat(5, minmax(0, 1fr)) !important;',
  ]) {
    assert.ok(
      nativeCss.includes(signature),
      `Native Android mobile parity signature changed: ${signature}`,
    );
  }

  assert.doesNotMatch(
    nativeCss,
    /\.fc-premium\s+\.theme-bottom-nav\s*>\s*\.premium-primary-grid\s*\{[^}]*repeat\(7,/s,
    'Native bottom navigation must not reserve seven columns for five tabs',
  );
});
