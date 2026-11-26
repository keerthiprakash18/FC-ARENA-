$ErrorActionPreference = 'Stop'
$python = 'C:\Users\micha\AppData\Local\Programs\Python\Python313\python.exe'
$base = 'C:\Users\micha\Music\FCARENAKP\.tmp-release\storage-maintenance'
$recovery = 'C:\Users\micha\Music\FCARENAKP\.tmp-release\recovery\managed-backups'
$common = @('--host', 'root@45.129.87.8', '--identity', 'C:\Users\micha\.ssh\id_ed25519')
& $python "$recovery\pc_backup.py" verify --private-directory $recovery *> "$base\last-recovery-verification.private.log"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $python "$base\storage_offhost.py" @common --directory 'C:\Users\micha\Music\FCARENAKP\.tmp-release\release-archives' --cycle *> "$base\last-run.private.log"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $python "$base\receive_release_escrow.py" @common --directory 'C:\Users\micha\Music\FCARENAKP\.tmp-release\release-archives\retired-releases' --cycle *> "$base\last-release-relocation.private.log"
exit $LASTEXITCODE
