# FC Arena development and releases

Preserve existing changes. Implement the requested change and run the relevant checks. When asked to deploy, use the release path below and verify the intended version on the production target.

## Production hosting

VCCLHosting is the production host for both services. InterServer is retired. Use the active VCCLHosting release paths, service units, and environment references for production work.

- `apps/web` serves [fcarena.in](https://fcarena.in/) through `fcarena-web`. Use the Linux build and staged systemd switch in the [web release runbook](docs/readiness/fc-arena-release-design.md). Verify the staged commit at [the web release endpoint](https://fcarena.in/web-release). Check the affected screen, including the Android WebView when applicable.
- `apps/api` serves [api.fcarena.in/api](https://api.fcarena.in/api/health) through `fcarena-api` on VCCLHosting. Check the active service paths and release identity before staging from a frozen Git commit. Follow the [production recovery runbook](docs/readiness/step-19-rollback-dr.md) for backups and schema changes. Verify API, database, and Redis health and the expected API release after activation.
- `apps/android` ships native changes through Google Play as `in.fcarena.app`. Follow the [Android release runbook](docs/readiness/step-18-release-system.md). Build with the original upload key and next unused version code. On Windows, run `powershell.exe -NoProfile -File .\apps\android\build-signed-release.ps1` from the frozen repository root and use its local signing prompt. Verify the signed AAB and intended Play track.

GitHub backend CI tests the source. Activate the approved artifact on VCCLHosting using the staged release procedure. After activation, dispatch `production-web-release.yml` from `main` with `component=web` or `component=api` and `release_sha` set to the full commit SHA deployed for that component. A docs-only or workflow-only commit can be verified against the currently deployed application SHA.

## Checks and handoff

- For local development, configure the documented environment and use Node.js 24 with `npm ci` and `npm run dev`. Use `npm run build:web` or `npm run build:api` for builds and `npm run check:availability` to check production.
- If access prevents a release step, give the exact pending step, working directory, shell, source commit or artifact, production target, and verification command. Report the actual deployed release or Play track after verification.
