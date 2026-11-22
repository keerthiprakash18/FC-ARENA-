# Required account details and Google/Facebook sign-in

The required-profile web/API release `dfec1456eb302b9ddef8e00f3eb89ebacde454f3` was activated on VCCLHosting on 22 November 2026 after the owner's explicit migration/deployment approval. The additive identity-table migration was rehearsed on a PostgreSQL 17 restore before production. Google OAuth and Meta apps have not been created, so their sign-in options remain unavailable until private configuration and real-provider tests are complete. No provider credentials or signed Android release changed.

## Account behavior

Email registration requires a real date from 1900 through today in India, and a WhatsApp number. Indian ten-digit numbers beginning with 6-9 normalize to `+91`; international numbers use a country code. Validation checks number syntax; it does not assert that WhatsApp has verified or registered that number. New Google/Facebook accounts must also supply an In-Game Name. These private account fields do not turn on the existing optional public WhatsApp contact or sharing preference.

Existing accounts keep their IDs, results and sessions. After sign-in, the web UI sends an account missing either detail to `/profile/complete` before ordinary app navigation, with no skip action. Account settings and sign-out remain accessible. This is profile completion, not a new permission level: the API still authenticates existing accounts normally, and the authenticated completion endpoint validates both values.

OAuth uses an authorization code, a state cookie, Google PKCE/nonce and verified Google ID-token claims/signature. A second one-use PKCE-bound handoff delivers the result to the original browser/WebView tab. Redis holds attempts, codes and completion tickets with expiry so both API processes can handle the flow. A matching email never automatically links accounts: the existing FC Arena password is required. Provider access/refresh tokens are not stored. Account deletion removes provider identity links.

## Create the provider applications

Google: use an owned project in [Google Auth Platform](https://console.cloud.google.com/auth/overview). Configure branding, audience and the consent screen, then create a **Web application** OAuth client. Register the exact redirect:

`https://api.fcarena.in/api/auth/social/callback/google`

Use scopes `openid email profile`. Add authorized test users while the app is in testing. Store its client ID and secret privately as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. No Google SDK or client secret is embedded in the website. Check the current [Google web-server OAuth instructions](https://developers.google.com/identity/protocols/oauth2/web-server) for console and publishing requirements.

Facebook: create an owned app with the Facebook Login use case at [Meta for Developers](https://developers.facebook.com/apps/). Add web platform/domain `fcarena.in`, the existing privacy page `https://fcarena.in/privacy`, and account-deletion instructions `https://fcarena.in/account-deletion`. Enable the web OAuth code flow and register:

`https://api.fcarena.in/api/auth/social/callback/facebook`

Store the app ID as `FACEBOOK_CLIENT_ID`, its app secret as `FACEBOOK_CLIENT_SECRET`, and the supported Graph API version shown by that app as `FACEBOOK_GRAPH_VERSION` (format `vNN.0`). The implementation requests only `email public_profile`. If Facebook does not share an email for a new account, the player is asked to use Google/email instead. Test with app roles/testers first and meet Meta's current live-mode/review requirements before enabling it for everyone. See [Facebook Login documentation](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/) and [Graph versioning](https://developers.facebook.com/docs/graph-api/guides/versioning).

Never put secrets in chat, GitHub, screenshots, build artifacts, or any `NEXT_PUBLIC_` variable. Provider availability is read from server configuration; absent credentials show disabled “Coming soon” options while email sign-in works.

## Local verification

PowerShell, repository checkout `C:\Users\micha\Music\FCARENAKP\.tmp-release\auth-update`, Node.js 24, disposable local PostgreSQL 17 and Redis required:

```powershell
Set-Location 'C:\Users\micha\Music\FCARENAKP\.tmp-release\auth-update'
npm ci
# Configure apps/api/.env privately from .env.example; do not overwrite an existing file.
# Use a dedicated loopback database whose name ends in _test for E2E checks.
# For local OAuth, use one consistent hostname in both origins, for example:
# SOCIAL_API_ORIGIN=http://localhost:4000
# SOCIAL_WEB_ORIGIN=http://localhost:3000
# Add matching localhost callback URIs to the provider apps if permitted there.
npm exec --workspace=apps/api -- prisma migrate deploy
npm run build:api
npm run build:web
npm run dev
```

Normal local run is `npm ci`, configured local environment, then `npm run dev`. Builds never need a production database. Unit tests mock provider transport and sign synthetic Google JWTs; HTTP integration uses disposable PostgreSQL/Redis and synthetic provider identities. Provider-console approval and a real-account browser smoke remain required once the apps exist.

## Android browser return

The current Android host already sends navigation to `api.fcarena.in` into an external browser and handles trusted `https://fcarena.in` App Links in its existing WebView. This lets Google sign-in run outside the embedded WebView, as required by [Google's embedded-browser policy](https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/). If the external browser does not open the app automatically, the callback displays **Open FC ARENA app**, using an explicit `in.fcarena.app` intent. The original WebView must still hold its tab's verifier. If it was killed or sign-in expired, the player starts again; there is no cross-device polling or bearer token in the link.

No native source was changed, so this feature does not itself require a new AAB. Before activation, verify the installed Play app's App Links and cold/warm browser return on a real device with the configured providers. The native user agent must not be spoofed to bypass Google's policy.

## Production activation prerequisites

1. Review/merge the source PR after API/Web, PostgreSQL 17 migrations/E2E, security and mobile browser gates pass. Create and configure the provider apps privately, first with authorized testers.
2. The additive migration `20261122160000_social_sign_in` creates `social_identities`; it does not backfill, delete or rewrite existing users. Rehearse it and the exact artifact in disposable staging. Preserve the existing nullable profile columns for old/deleted users.
3. Obtain separate owner approval for the production schema step, then take fresh approved encrypted DB/media backup and verify recovery. Apply the reviewed migration with the existing production migration runbook. Do not run the API's `start:prod` implicitly to apply migrations.
4. The managed runtime rejects schema differences unless the specifically reviewed [migration approval proof](social-login-release.md) passes. The identity-table migration and activation checks were completed for this release; never bypass the guard for another schema change. Build immutable runtime artifacts off-host and retain the compatible rollback. The added table can remain during an app rollback; never drop it as automatic cleanup. If an old API version handles account deletion during rollback, separately review removal of provider links for disabled users before reactivation.
5. Configure root-only API environment values without overwriting existing entries or changing precedence; both API instances must share the same credentials, origins and Redis. Apply `access_log off` in the dedicated auth location and include `ops/nginx/fcarena-social-callback.conf` in the web HTTPS block so codes/state never enter URL logs. Keep the managed upstream names, client-IP forwarding and existing auth gzip policy. Validate with `nginx -t` before reload. Also exclude callback query strings from any external request analytics/APM.
6. Activate the reviewed artifact using the migration-aware release procedure, then check `/web-release`, `/api/health`, `/api/auth/social/providers` and `npm run check:availability`. Run the main-branch production verifier for web and API with the exact deployed SHA.
7. Verify real Google and Facebook sign-in/cancel, new-account completion, duplicate email/password connection, expired/replayed links, logout/refresh, private contact sharing and Android browser return. Review the Play Data Safety/required-data declaration before enabling newly required account contact collection.

The completed release does not authorize another production migration or provider activation through this guide alone. Create the provider apps, configure private environment values and complete the real Google/Facebook and installed-Android return tests before enabling those providers.
