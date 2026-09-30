# Competition experience v3

English remains the only UI language, as requested. No Tamil localization is planned.

Delivered on top of v2:
- Local QR generation, invite URL prefill and downloadable QR (no external QR service).
- Verified result PNG sharing and calendar reminders with a 30-minute alarm.
- Clear submit/awaiting-review/verified actions, optional screenshot upload and collapsed admin correction controls.
- Verified head-to-head using stable opponent account IDs from authorized career records; completed competition archive.
- Personal tournament registration, verified statistics and table position, with links to registration and qualification standings; next fixture uses account identity.
- Save-draft-and-exit on tournament setup, resume the server-saved wizard step, progress and save guidance. Existing server validation and review summary retained.
- Notification fetch deduplication, short cache, mutation invalidation and account isolation.
- Retry screens for tournament overview, standings and playoffs, plus desktop find-my-rank repair.

Validation: production web/API builds and TypeScript passed; 91 API unit tests passed; notification-cache concurrency/mutation/account-isolation test passed; 77 existing browser route/viewport checks, 26 expanded QR/match/calendar checks, and 48 Android-user-agent touch/scroll checks passed. Android checks are browser emulation, not a physical-device run.

External limitations: OS push delivery needs a configured Firebase/native push project and permission/token integration; calendar reminders are available now. Historical rank movement is not fabricated because the backend has no stored rank snapshots. Head-to-head fields become available after the additive API deploy; older API responses remain supported.
