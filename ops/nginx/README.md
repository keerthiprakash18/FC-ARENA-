# Same-origin API connections on the VPS

## Transport performance

Include `fcarena-performance.conf` in both HTTPS server blocks. On the current
Nginx 1.24 server, add `http2` to each existing `listen ... ssl` directive.
Keep the auth location's `gzip off`; event streams are intentionally absent
from `gzip_types`. Do not enable proxy buffering for streams. Validate with
`nginx -t`, reload, then check HTTP/2 negotiation and compressed JSON after
the new workers have started. This changes transport only, with no database
or application cache changes.

Keep the original site files and snippet backups for rollback. The live
2026-11-02 verification is under
`/opt/fcarena-deployments/network-20261102-http2-r2/verification.json`.

The browser now uses `/api` for JSON, uploads and live event streams. Copy
`fcarena-api.conf` to `/etc/nginx/snippets/fcarena-api.conf` and include it in
the website's HTTPS server block alongside the auth snippet:

```nginx
include /etc/nginx/snippets/fcarena-auth.conf;
include /etc/nginx/snippets/fcarena-api.conf;
```

Run `nginx -t` before reloading. Direct proxying to the loopback API keeps one
trusted proxy hop and avoids an extra browser DNS lookup, TLS handshake and
CORS preflight. Keep the existing `client_max_body_size` for uploads. The API
snippet disables response buffering so match event streams remain live.

Next also provides an `/api/:path*` rewrite for local development and hosts
without Nginx. `API_PROXY_TARGET` configures its upstream at build time. On the
VPS, install the direct Nginx route before deploying the same-origin client;
do not send all production users through a second Next proxy hop.

## Authentication

Copy `fcarena-auth.conf` to `/etc/nginx/snippets/fcarena-auth.conf` and include it
inside the HTTPS server block for `fcarena.in` and `www.fcarena.in`, before the
existing website location:

```nginx
include /etc/nginx/snippets/fcarena-auth.conf;
```

Validate with `nginx -t` before reloading Nginx. Keep the API on loopback and
`TRUST_PROXY_HOPS=1`: both the website auth route and `api.fcarena.in` then have
one trusted proxy before Nest. Cookies retain their `/api/auth` path and the
browser continues using same-origin URLs.

Without this location, the VPS's Next auth rewrite adds a second proxy hop.
The API can then see every website user as `127.0.0.1`, sharing login and
password-reset rate limits across unrelated users. Raising the numeric trust
hop count would also affect the shorter direct-API route; route auth directly
instead.

To repair Brevo credentials from Windows, run `ops/mail/repair-brevo.ps1` from
the repository root. Use a restricted API key with Transactional email access
and authorize the VPS's outbound IP in Brevo first. The prompt hides the key,
validates it through a read-only endpoint, saves a private server backup,
replaces duplicate key entries and restarts the API with a health check.
