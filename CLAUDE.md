# FC ARENA — AI assistant entrypoint

**Mandatory:** Read and follow the repository-root [AGENTS.md](AGENTS.md) before any feature work, release, staging or cleanup. The same policy governs Claude Code and all other assistants. See [VCL release/storage policy](ops/VCL_RELEASE_STORAGE_POLICY.md) for current live baseline.

- Feature implementation is **not** production deployment.
- GitHub Actions builds/test off-host. VCL production holds runtime and stable persistent data only.
- Do not delete historical releases, media or backups, change production DB, or restart services without the explicitly approved guarded release procedure.
- The GitHub manual predeploy workflow checks **read-only readiness**; it never activates a release.
- Verify actual live WEB/API SHA, backups, rollback and CI before claiming release success.
- If the environment lacks repo/server access, state exact missing steps and leave production unchanged.

Subdirectory `AGENTS.md` (including `apps/web/AGENTS.md`) supplies framework-specific rules in addition to this safety contract.
