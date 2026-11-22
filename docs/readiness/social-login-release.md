# Social login release and approved schema transition

The application candidate is `dfec1456eb302b9ddef8e00f3eb89ebacde454f3` (PR #201). Google/Meta apps are not configured, so this release keeps their buttons unavailable. Required private account details and email/password sign-in work independently of provider activation.

The baseline is read from `/etc/fcarena/managed-release/current.json` and the four active services, never inferred from Git. Before activation, complete the existing off-host artifact, read-only readiness, encrypted PC recovery, isolated PostgreSQL 17 migration and authenticated synthetic replica/browser gates. Preserve the current runtime and all historical releases.

## Schema transition

The only allowed migration is `20261122160000_social_sign_in`, SHA256 `8264b8fc5ff9988e5b481d4a6788279c32a1cb9b85d66274793eda69f4683249`. It creates an empty `social_identities` table, two unique indexes and a cascading foreign key. It does not change existing user fields, rows, matches or results. A code rollback leaves this additive table intact.

Rehearse the exact candidate on an isolated PostgreSQL 17 restore, comparing existing tables before/after and running both baseline and candidate API health against the migrated clone. Keep all workers/external integrations disabled. Synthetic browser tests use a separate disposable database and accounts, never restored player data.

After these preparations, obtain the owner's **separate explicit production migration approval**, as required by `AGENTS.md`. Only then run the candidate's existing, frozen Prisma CLI against production under `/run/lock/fcarena-release.lock`, using the active API process's existing database configuration privately. Do not print environment values, use `start:prod`, install/build on the host, reset a database or restore over production.

Record a root-owned mode-0600 approval proof containing `status: APPLIED_AND_VERIFIED`, `approvedBy: owner`, approval time, baseline/candidate release IDs and absolute runtime paths, both normalized schema hashes, migration hash, encrypted backup checksum, isolated rehearsal path and exact post-migration ledger. The rehearsal records `status: PASS`, both release IDs, migration hash, `postgresMajor: 17`, `existingDataPreserved`, `baselineAfterMigrationHealthy` and `candidateAfterMigrationHealthy`.

The managed activator's optional `--approved-schema-proof` accepts only this reviewed SQL, unchanged historical migrations, the bound schema files, a fresh owner approval, a matching PostgreSQL 17 rehearsal, the latest restored off-host backup, and the exact finished production migration ledger. Missing or mismatched evidence blocks activation. The activator never applies SQL. Ordinary releases continue to require exact schema parity.

## Activation and verification

Use the normal managed activation with the exact runtime, release SHA, expected live baseline, synthetic staging proof and approved schema proof. It preserves stable API storage and the rollback pointer. Review callback access-log suppression before enabling provider credentials; do not enable a provider without its real-account and installed-Android browser-return tests.

Verify both API and web replicas directly and publicly, required signup fields, unavailable provider options, callback protections, login/profile completion in staging, `/web-release`, `/api/health`, and `npm run check:availability`. Run `VCCLHosting Production Release Verification` from current `main` for each component and the exact deployed application SHA. Record any omitted production login test under the owner's existing staging-plus-public approval.
