# FC ARENA Android stabilization release gate

Stabilization checks passed on the pre-bump candidate. Current release candidate is **9 / 1.0.7**.
It must be merged and uploaded only after the post-bump validation remains green. Package stays `in.fcarena.app`.

1. Pass Android release lint, debug APK, release bundle and real-swipe tests
   on Android 13/14/15/16, plus repeated launch/resume checks.
2. Pass web lint/production build, CodeQL and Security Hardening CI.
3. Review the final diff, bump version, rerun checks and merge only green code.
4. Run final validation on the merge commit. The native stylesheet must also
   be deployed to https://fcarena.in; the wrapper loads the live frontend.
5. Build using the existing FC Arena upload keystore. Verify the signer SHA-256
   against the known upload certificate (not merely the Play app-signing key).
   An unsigned CI validation bundle is never a Play upload artifact.
6. Name the verified bundle `FC_ARENA_v1.0.7_build9_signed.aab` and record its
   file SHA-256 and source commit.
7. Play Console → Testing → Internal testing → Create new release → upload
   the signed Build 9 → review and roll out to internal testers.
8. Install/update through the actual Play internal-test link. Check cold open,
   five open/close cycles, login/logout and retained login, full dashboard
   scrolling, all tabs, profile photo picker/upload, Android back, bottom bar,
   Wi-Fi/mobile data, and background/resume. Check fatal errors/ANRs.
9. Only after that passes, promote the SAME Build 9 to Closed testing.

Do not rotate signing keys, reset production data, or claim physical-device
acceptance based only on fixture-driven emulator tests.
