param(
    [string]$StatusPath = (Join-Path ([IO.Path]::GetTempPath()) 'fcarena-brevo-repair-status.json')
)

$ErrorActionPreference = 'Stop'
$taskSucceeded = $false
$taskSecretPointer = [IntPtr]::Zero
$taskProcess = $null
$taskPhase = 'starting'
$taskSshExitCode = $null
$taskProviderStatus = $null

function Set-RepairStatus([string]$State) {
    @{ state = $State; phase = $taskPhase; sshExitCode = $taskSshExitCode; providerStatus = $taskProviderStatus; updatedAt = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json -Compress | Set-Content -LiteralPath $StatusPath -Encoding UTF8
}

try {
    $taskPhase = 'reading_key'
    Set-RepairStatus 'waiting_for_key'
    Write-Host 'FC ARENA - Repair password-reset email' -ForegroundColor Cyan
    Write-Host 'Server: 45.129.87.8'
    Write-Host 'Paste ONLY your new Brevo API key. It will stay hidden.'
    Write-Host 'Right-click or Ctrl+Shift+V to paste, then press Enter.'
    $taskSecureKey = Read-Host 'Brevo API key' -AsSecureString
    $taskSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureKey)
    $taskPlainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskSecretPointer).Trim()
    if ([string]::IsNullOrWhiteSpace($taskPlainKey)) { throw 'No key entered.' }
    $taskPhase = 'preparing_ssh'
    Set-RepairStatus 'checking_and_updating'

    $taskSource = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'repair-brevo.mjs'))
    $taskEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($taskSource))
    $taskRemoteCommand = 'node --input-type=module -e ''import("data:text/javascript;base64,' + $taskEncoded + '")'''
    $taskIdentity = Join-Path $env:USERPROFILE '.ssh\id_ed25519'
    $taskStart = New-Object Diagnostics.ProcessStartInfo
    $taskStart.FileName = (Get-Command ssh.exe -ErrorAction Stop).Source
    $taskStart.UseShellExecute = $false
    $taskStart.RedirectStandardInput = $true
    $taskStart.RedirectStandardOutput = $true
    $taskStart.RedirectStandardError = $true
    # The command line contains program code only. The key travels through stdin.
    $taskStart.Arguments = '-i "' + $taskIdentity + '" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=12 root@45.129.87.8 "' + $taskRemoteCommand.Replace('"', '\"') + '"'
    Set-RepairStatus 'checking_and_updating'
    $taskProcess = New-Object Diagnostics.Process
    $taskProcess.StartInfo = $taskStart
    if (-not $taskProcess.Start()) { throw 'Could not start SSH.' }
    $taskOutput = $taskProcess.StandardOutput.ReadToEndAsync()
    $taskErrorOutput = $taskProcess.StandardError.ReadToEndAsync()
    $taskPhase = 'sending_key'
    Set-RepairStatus 'checking_and_updating'
    $taskProcess.StandardInput.WriteLine($taskPlainKey)
    $taskProcess.StandardInput.Close()
    $taskPlainKey = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskSecretPointer)
    $taskSecretPointer = [IntPtr]::Zero
    $taskSecureKey.Dispose()
    $taskPhase = 'waiting_for_server'
    Set-RepairStatus 'checking_and_updating'
    if (-not $taskProcess.WaitForExit(150000)) {
        Set-RepairStatus 'verification_needed'
        throw 'The server check is still running. Check service status before retrying.'
    }
    $taskSshExitCode = $taskProcess.ExitCode
    $taskServerOutput = $taskOutput.GetAwaiter().GetResult()
    $taskServerError = $taskErrorOutput.GetAwaiter().GetResult()
    Write-Host $taskServerOutput
    Write-Host $taskServerError
    if ($taskServerError -match 'HTTP (\d{3})') { $taskProviderStatus = [int]$Matches[1] }
    if ($taskProcess.ExitCode -ne 0) { throw 'The repair did not complete. See the message above.' }
    $taskSucceeded = $true
    $taskPhase = 'finished'
    Set-RepairStatus 'complete'
    Write-Host 'Done. Return to Codex and test Forgot Password.' -ForegroundColor Green
} catch {
    if (-not (Test-Path -LiteralPath $StatusPath) -or
        (Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json).state -ne 'verification_needed') {
        Set-RepairStatus 'failed'
    }
    Write-Host 'Repair did not complete. Return to Codex; do not share the key.' -ForegroundColor Yellow
    Write-Host ('Stopped during: ' + $taskPhase)
} finally {
    $taskPlainKey = $null
    if ($taskSecretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskSecretPointer)
    }
    if ($null -ne $taskProcess) { $taskProcess.Dispose() }
}

Read-Host 'Press Enter to close this window'
if (-not $taskSucceeded) { exit 1 }
