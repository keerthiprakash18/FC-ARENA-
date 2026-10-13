const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const mainActivity = fs.readFileSync(
  path.join(root, 'apps/android/app/src/main/java/in/fcarena/app/MainActivity.java'),
  'utf8',
);

test('Android update performs one fresh document load without clearing user state', () => {
  for (const signature of [
    'FORCE_FRESH_WEB_KEY = "force_fresh_web_after_update"',
    '.putBoolean(FORCE_FRESH_WEB_KEY, true)',
    'WebSettings.LOAD_NO_CACHE',
    'withFreshWebToken(initialUrl)',
    'FRESH_WEB_QUERY_KEY = "fc_native_refresh"',
    '.putBoolean(FORCE_FRESH_WEB_KEY, false)',
    'WebSettings.LOAD_DEFAULT',
  ]) {
    assert.ok(mainActivity.includes(signature), `Missing fresh-update contract: ${signature}`);
  }

  assert.ok(
    mainActivity.indexOf('if (shouldForceFreshWeb())') <
      mainActivity.indexOf('webView.restoreState(savedInstanceState)'),
    'Fresh-update path must run before WebView state restoration',
  );

  for (const [label, pattern] of [
    ['clearCache(true)', /\.\s*clearCache\s*\(\s*true\s*\)/],
    ['removeAllCookies', /\.\s*removeAllCookies\s*\(/],
    ['deleteAllData', /\.\s*deleteAllData\s*\(/],
  ]) {
    assert.equal(
      pattern.test(mainActivity),
      false,
      `Update refresh must not destroy login/settings via ${label}`,
    );
  }
});


test('Android WebView renders the canonical mobile web layout', () => {
  for (const signature of [
    'enforceCanonicalWebLayout(view)',
    "removeAttribute('data-native-app')",
    'public void onPageCommitVisible(WebView view, String url)',
  ]) {
    assert.ok(
      mainActivity.includes(signature),
      `Missing Android/web layout parity contract: ${signature}`,
    );
  }

  assert.ok(
    mainActivity.indexOf('enforceCanonicalWebLayout(view)') <
      mainActivity.lastIndexOf('enforceCanonicalWebLayout(view)'),
    'Layout parity must be enforced both when content becomes visible and after page load',
  );
});
