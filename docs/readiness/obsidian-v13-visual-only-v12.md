# FC ARENA — V13 design-only backport candidate

This candidate is based on **verified historical V12 production source** 154b8440b92ca18f15fc186ee17019820cf8e116; it is NOT an assertion about today's live production release. Baseline must be checked by the Windows operator before doing anything. This branch includes only shared CSS and UI metadata, and tests. It intentionally excludes newer main API/auth, pending Duo progress migrations and other changes.

Files: V13 post-V12 CSS section in `arena-consolidated.css`, matching `obsidian-matchday.css`, scoped Cup Center styling, Next viewport brand color, static and browser visual tests, CI verification. The original V12 CSS prefix and full Cup Center module prefix are byte-preserved.

**Not a license to delete, migrate or restart:** No API/Prisma schema or migrations are changed. Off-host build must be from this exact SHA (after CI passes), verify package SHA and native bindings, then run historical-vs-current live read-only checks and isolated staging/recovery. Deploy only if current public WEB and API both match the pinned old release, backups/restore and uploads are freshly verified off-host, staging authenticated flow passes, and release-independent storage/rollback/cutover are proven. If current live != 154b8440b92ca18f15fc186ee17019820cf8e116, stop and reconcile the actual live baseline instead of overwriting it.

This is a release branch for operator staging; the mainline design work remains on PR #208 and should not be replaced by this backport. See current `main` AGENTS.md (newer) for stricter security and production policy.
