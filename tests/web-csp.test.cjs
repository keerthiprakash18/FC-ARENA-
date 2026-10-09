const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const proxy = fs.readFileSync(path.join(root, "apps/web/src/proxy.ts"), "utf8");
const nextConfig = fs.readFileSync(path.join(root, "apps/web/next.config.ts"), "utf8");
const layout = fs.readFileSync(path.join(root, "apps/web/src/app/layout.tsx"), "utf8");

test("web CSP is request-scoped and nonce based", () => {
  assert.match(proxy, /crypto\.randomUUID\(\)/);
  assert.match(proxy, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.match(proxy, /style-src 'self' 'nonce-\$\{nonce\}'/);
  assert.match(proxy, /style-src-attr 'unsafe-inline'/);
  assert.doesNotMatch(proxy, /script-src[^\n]*'unsafe-inline'/);
  assert.doesNotMatch(proxy, /style-src 'self' 'unsafe-inline'/);
});

test("root layout consumes the request nonce for its custom inline script", () => {
  assert.match(layout, /await headers\(\)/);
  assert.match(layout, /\.get\('x-nonce'\)/);
  assert.match(layout, /<script\s+nonce=\{nonce\}/);
});

test("static Next headers do not inject a second CSP", () => {
  assert.doesNotMatch(nextConfig, /Content-Security-Policy/);
});
