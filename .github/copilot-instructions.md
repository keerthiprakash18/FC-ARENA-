# FC ARENA — GitHub Copilot repository instructions

**Before editing or deploying, read [AGENTS.md](../AGENTS.md) in full.** It is the authoritative, repository-wide operational contract for Codex, ChatGPT, Copilot, Claude and human contributors.

- Work on feature branches and use tests/PRs; preserve all existing tournament, user, match, award, profile and admin functionality.
- GitHub Actions builds off-host; **never build on VCL production** in the normal release workflow or accumulate duplicate build/storage directories.
- Feature work/merge **does not** imply production deployment. User-requested deployment requires explicit authorization plus passing checks, fresh verified backups, reversible activation and live identity/feature verification.
- Protect V12 live, V11 rollback and all persistent data until current real-world references are reverified.
- **No production DB changes, blind resets or old release deletions.** Retention automation is not yet approved/active. Do not ignore security CI blockers (Issue #192) or outstanding work (Issue #193).
- If evidence or access is missing, explain the blocker and leave production unchanged. Never claim live deployment based solely on a GitHub commit or successful build.

Operational reference: [ops/VCL_RELEASE_STORAGE_POLICY.md](../ops/VCL_RELEASE_STORAGE_POLICY.md). Framework-specific instructions (e.g. `apps/web/AGENTS.md`) also apply.
