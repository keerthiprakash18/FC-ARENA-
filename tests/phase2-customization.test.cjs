const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
const organizer = read('apps/web/src/app/leagues/[leagueId]/tournaments/page.tsx');
const notifications = read('apps/web/src/app/settings/notifications/page.tsx');
const dashboard = read('apps/web/src/app/dashboard/page.tsx');

assert.match(organizer, /\/tournaments\/\$\{tournament\.id\}\/clone/);
assert.match(organizer, /Clone Tournament/);
assert.match(notifications, /\/notifications\/preferences/);
assert.match(notifications, /PATCH/);
assert.match(dashboard, /\/auth\/preferences\/dashboard/);
assert.match(dashboard, /hiddenSections/);
console.log('Phase 2 customization: organizer clone and persisted preference flows are wired');
