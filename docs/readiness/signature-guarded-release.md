# Signature Edition guarded release

`FC_ARENA_SIGNATURE_GUARDED_DEPLOY.py` admits one exact PR #230 candidate.
`--preflight` performs read-only local/GitHub/SSH checks. `--apply` additionally
requires a separate owner approval for the candidate, archive bytes, current live
baseline and final acceptance document. Neither mode builds, migrates, removes
files or duplicates persistent storage. Do not invoke apply until the owner has
approved final acceptance. Play publication remains a separate action.

The prepared runtime must already have an independently verified, root-owned,
mode 0600 `staging-proof.json` next to it. The existing managed activation tool
requires exact candidate/baseline identities, fresh authenticated browser/API,
Redis and replica-failover evidence, schema parity, backup and storage admission.
The proof must also bind `artifactSha256`, `acceptanceSha256` and
`ownerApprovalSha256`. Its normal release lock and rollback implementation remain
authoritative. This wrapper does not create a staging proof or infer approval.

Run from the reviewed checkout, with private evidence outside Git:

```text
python FC_ARENA_SIGNATURE_GUARDED_DEPLOY.py --preflight \
  --release FULL_CANDIDATE_SHA --baseline FULL_LIVE_SHA \
  --artifact-dir PRIVATE_DOWNLOADED_ARTIFACT_DIRECTORY --build-run ACTIONS_RUN_ID \
  --evidence PRIVATE_FINAL_ACCEPTANCE_JSON --host EXISTING_SSH_HOST \
  --identity EXISTING_SSH_KEY --managed-sha256 REVIEWED_INSTALLED_TOOL_SHA256
```

Final acceptance JSON requires `status: "PASS"`, `release`, `artifactSha256`,
`verifiedAtUtc`, and `gates`. Each gate has `status: "PASS"`, `verifiedAtUtc`,
`evidenceFile` (an actual regular file), and `evidenceSha256`. All evidence must be
within 24 hours, and the actual bytes must match. Required gates are:
`accountDeletion`, `mediaCleanup`, `concurrentPrivacy`, `themes`, `matchCenter`,
`motion`, `accessibility`, `performance`, `security`, `functional`,
`companyCompliance`, `playConsole`, `physicalAndroid`, `isolatedStaging`,
`backupRestore`, `rollback`. An unavailable external gate must stay unavailable;
never substitute a synthetic test or source check for it.

The separately issued private owner document requires `approvedBy: "owner"`,
`action: "ACTIVATE_SIGNATURE_WEB_API"`, `approvedAtUtc`, `release`,
`baselineRelease`, `artifactSha256`, and `acceptanceSha256` (the hash of the final
acceptance JSON). Approval expires after 24 hours. Apply uses the same arguments
plus `--runtime EXISTING_VERIFIED_RUNTIME --owner-approval PRIVATE_OWNER_JSON`.
There is no generated approval template with preapproved values.

All source CI and the exact off-host build must succeed. An expected revision,
artifact, evidence file, current baseline, managed tool hash, health or recovery
change blocks activation. Preflight prints `productionActivated: false`.
Activation is delegated only after every gate passes; the managed tool restores
the baseline on activation failure. Rehearse the rollback on isolated resources
before owner acceptance. Do not use a production rollback command as a rehearsal.
If SSH is lost during apply, the wrapper reports activation as `unknown`; inspect
actual release identities and managed recovery evidence before taking any action.
