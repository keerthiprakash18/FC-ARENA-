# OCR storage and result scanning

The production API runs as `fcarena-api` with `ProtectSystem=strict`. Its
configured `OCR_UPLOAD_DIR` must be owned by that account, all parent directories
must allow traversal, and the exact directory must be in `ReadWritePaths`.
The default `apps/api/storage/match-results` and `storage/ocr-cache` locations are
already covered by `ops/security/fcarena-api-hardening.conf`.

The legacy deployment uses `/opt/fcarena/storage/match-results`. Root ownership,
mode `0700`, and its absence from the service write allowlist caused screenshot
uploads to fail before an extraction record could be created. `repair-storage.py`
checks this exact legacy directory by default. Run it with `--apply` to back up
permissions and any existing drop-in, give the API account ownership of only OCR
artifacts, allow group traversal of the parent, and add the OCR directory to the
write allowlist. It probes a temporary file under the service account and a
read-only filesystem sandbox, restarts the API, and checks health. It restores the
original permissions and drop-in if verification fails. It neither moves images
nor edits database records. Backups are private under `/opt/fcarena-deployments`.

Keep screenshot contents out of diagnostics. Use anonymous detected scores and
confidence values. To exercise the actual engine locally, run:

```powershell
$env:FC_OCR_INTEGRATION = '1'
npm run test --workspace=apps/api -- src/ocr src/security/safe-exception.filter.spec.ts
```

Final-time header crops read each goal total independently so the decorative
centre emblem cannot become an extra digit. Word confidence and coordinates are
retained for participant matching. Unknown team order stays below the autofill
threshold; users can explicitly choose a detected score order before submitting.
