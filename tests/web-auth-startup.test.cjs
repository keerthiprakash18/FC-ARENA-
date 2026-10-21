const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const homePage = fs.readFileSync(
  path.join(root, 'apps/web/src/app/page.tsx'),
  'utf8',
);
const redirect = fs.readFileSync(
  path.join(root, 'apps/web/src/components/auth/home-session-redirect.tsx'),
  'utf8',
);

test('public home restores a valid session instead of showing sign-in after restart', () => {
  assert.match(homePage, /HomeSessionRedirect/);
  assert.match(redirect, /getCurrentUser\(\)/);
  assert.match(redirect, /router\.replace\('\/dashboard'\)/);
  assert.match(redirect, /\.catch\(\(\) =>/);
});
