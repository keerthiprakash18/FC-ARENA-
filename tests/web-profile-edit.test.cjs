const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const profile = fs.readFileSync(
  path.join(__dirname, '..', 'apps/web/src/app/profile/page.tsx'),
  'utf8',
);

test('profile page exposes editable fields through the authenticated profile endpoint', () => {
  assert.match(profile, /authenticatedRequest<\{/);
  assert.match(profile, /"\/players\/me\/profile"/);
  assert.match(profile, /method: "PATCH"/);
  assert.match(profile, /name="?fullName"?/);
  assert.match(profile, /Email is read-only/);
  assert.match(profile, /readOnly/);
});

test('profile page disables verified identity fields', () => {
  assert.match(profile, /const identityLocked = Boolean\(identity\?\.isVerified \|\| identity\?\.lockedAt\)/);
  assert.match(profile, /disabled=\{profileBusy \|\| identityLocked\}/);
  assert.match(profile, /Verified identity is locked and cannot be edited/);
});
