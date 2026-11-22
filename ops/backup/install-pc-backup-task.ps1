param([string]$PrivateDirectory = 'C:\Users\micha\Music\FCARENAKP\.tmp-release\recovery\managed-backups')
$ErrorActionPreference = 'Stop'
$privateRoot = (Resolve-Path -LiteralPath $PrivateDirectory).Path
if ($privateRoot -ne 'C:\Users\micha\Music\FCARENAKP\.tmp-release\recovery\managed-backups') { throw 'Use only the approved private recovery directory.' }
if (-not (Test-Path -LiteralPath (Join-Path $privateRoot 'last-verified-restore.json'))) { throw 'First complete a real recovery verification.' }
$pythonPath = (Get-Command python.exe -ErrorAction Stop).Source
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'pc_backup.py') -Destination (Join-Path $privateRoot 'pc_backup.py')
$receiver = Join-Path $privateRoot 'pc_backup.py'
$log = Join-Path $privateRoot 'scheduled-pull.private.log'
$wrapper = Join-Path $privateRoot 'scheduled-pull.ps1'
$body = "`$ErrorActionPreference = 'Stop'`r`n& '$($pythonPath.Replace("'","''"))' '$($receiver.Replace("'","''"))' pull --private-directory '$($privateRoot.Replace("'","''"))' *> '$($log.Replace("'","''"))'`r`nexit `$LASTEXITCODE`r`n"
[System.IO.File]::WriteAllText($wrapper,$body)
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wrapper`"" -WorkingDirectory $privateRoot
$triggers = @((New-ScheduledTaskTrigger -AtLogOn -User $account), (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1)))
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$taskName = 'FC Arena Private Encrypted Backup'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'Do not overwrite an existing backup task.' }
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'Pull encrypted FC Arena backup to this private PC; verify all files and isolated database restore weekly. Requires this Windows user to be signed in.' | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName,State
