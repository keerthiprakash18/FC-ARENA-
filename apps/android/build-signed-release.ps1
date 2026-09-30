param(
    [string]$KeystorePath,
    [string]$KeyAlias
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedVersionCode = "10"
$ExpectedVersionName = "1.0.8"
$ExpectedUploadFingerprint = "23:96:BA:D7:80:3E:DB:34:D8:31:EA:CB:4B:02:00:47:37:C7:AD:E8:A4:E6:8A:F8:CC:36:2D:AE:32:5B:B9:E2"
$FinalName = "FC_ARENA_v1.0.8_build10_signed.aab"
$GradleVersion = "8.13"

function Normalize-Fingerprint {
    param([string]$Value)
    return (($Value -replace "[^0-9A-Fa-f]", "").ToUpperInvariant())
}

function Get-PlainText {
    param([Security.SecureString]$SecureString)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Resolve-Tool {
    param(
        [string]$Name,
        [string]$JavaToolName
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    if ($env:JAVA_HOME) {
        $candidate = Join-Path $env:JAVA_HOME ("bin\" + $JavaToolName)
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw "$Name was not found. Install JDK 17 or set JAVA_HOME before running this script."
}

function Get-GradleExecutable {
    param([string]$Version)

    $existing = Get-Command "gradle.bat" -ErrorAction SilentlyContinue
    if (-not $existing) {
        $existing = Get-Command "gradle" -ErrorAction SilentlyContinue
    }
    if ($existing) {
        Write-Host "Using installed Gradle: $($existing.Source)"
        return $existing.Source
    }

    $base = if ($env:LOCALAPPDATA) {
        Join-Path $env:LOCALAPPDATA "FC-Arena\Gradle"
    } else {
        Join-Path $env:TEMP "FC-Arena-Gradle"
    }

    $installDir = Join-Path $base "gradle-$Version"
    $gradleExe = Join-Path $installDir "bin\gradle.bat"

    if (Test-Path $gradleExe) {
        Write-Host "Using cached Gradle ${Version}: $gradleExe"
        return $gradleExe
    }

    New-Item -ItemType Directory -Force -Path $base | Out-Null

    $zipPath = Join-Path $base "gradle-$Version-bin.zip"
    $shaPath = "$zipPath.sha256"
    $zipUrl = "https://services.gradle.org/distributions/gradle-$Version-bin.zip"
    $shaUrl = "$zipUrl.sha256"

    Write-Host "Gradle not installed. Downloading official Gradle $Version..."
    Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zipPath
    Invoke-WebRequest -UseBasicParsing -Uri $shaUrl -OutFile $shaPath

    $expectedHash = (Get-Content $shaPath -Raw).Trim().Split(" ")[0].ToUpperInvariant()
    $actualHash = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash.ToUpperInvariant()

    if ($actualHash -ne $expectedHash) {
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        throw "Gradle distribution SHA-256 mismatch. Download removed."
    }

    Write-Host "Gradle download SHA-256 verified."
    Expand-Archive -Path $zipPath -DestinationPath $base -Force

    if (-not (Test-Path $gradleExe)) {
        throw "Gradle $Version extraction completed but gradle.bat was not found."
    }

    return $gradleExe
}

$AndroidDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $AndroidDir "..\..")).Path
$BuildGradle = Join-Path $AndroidDir "app\build.gradle"
$ReleaseDir = Join-Path $AndroidDir "release"
$RawAab = Join-Path $AndroidDir "app\build\outputs\bundle\release\app-release.aab"
$FinalAab = Join-Path $ReleaseDir $FinalName
$MetadataFile = "$FinalAab.sha256.txt"
$LocalProperties = Join-Path $AndroidDir "local.properties"

# Gradle's Android plugin needs an SDK path. Reuse an existing local.properties,
# otherwise discover the normal Windows SDK locations and create the git-ignored
# local.properties automatically.
if (-not (Test-Path $LocalProperties -PathType Leaf)) {
    $sdkCandidates = @(
        $env:ANDROID_SDK_ROOT,
        $env:ANDROID_HOME,
        $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Android\Sdk" })
    ) | Where-Object { $_ -and (Test-Path $_ -PathType Container) }

    if ($sdkCandidates.Count -eq 0) {
        throw "Android SDK not found. Install Android SDK 36 or set ANDROID_SDK_ROOT/ANDROID_HOME."
    }

    $sdkPath = (Resolve-Path $sdkCandidates[0]).Path.Replace("\\", "/")
    Set-Content -Path $LocalProperties -Value "sdk.dir=$sdkPath" -Encoding ASCII
    Write-Host "Created git-ignored local.properties for Android SDK: $sdkPath"
}

Write-Host ""
Write-Host "FC ARENA Build 10 signed release"
Write-Host "Repository: $RepoRoot"
Write-Host ""

$git = Get-Command "git" -ErrorAction SilentlyContinue
if (-not $git) {
    throw "Git is required so the script can verify the exact tested source commit."
}

$branch = (& $git.Source -C $RepoRoot rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
    throw "Current branch is '$branch'. Run: git checkout main; git pull origin main"
}

& $git.Source -C $RepoRoot fetch origin main --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Could not fetch origin/main."
}

$headCommit = (& $git.Source -C $RepoRoot rev-parse HEAD).Trim()
$originMainCommit = (& $git.Source -C $RepoRoot rev-parse origin/main).Trim()
if ($headCommit -ne $originMainCommit) {
    throw "Local main is not the current origin/main. Run: git pull origin main"
}

& $git.Source -C $RepoRoot diff --quiet HEAD --
if ($LASTEXITCODE -ne 0) {
    throw "Tracked files have local changes. Commit/stash them before building the Play release."
}

& $git.Source -C $RepoRoot diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    throw "There are staged changes. Commit/stash them before building the Play release."
}

$gradleText = Get-Content $BuildGradle -Raw
$versionCodeMatch = [regex]::Match($gradleText, "versionCode\s+(\d+)")
$versionNameMatch = [regex]::Match($gradleText, "versionName\s+'([^']+)'")

if (-not $versionCodeMatch.Success -or $versionCodeMatch.Groups[1].Value -ne $ExpectedVersionCode) {
    throw "Expected versionCode $ExpectedVersionCode, but build.gradle does not match."
}

if (-not $versionNameMatch.Success -or $versionNameMatch.Groups[1].Value -ne $ExpectedVersionName) {
    throw "Expected versionName $ExpectedVersionName, but build.gradle does not match."
}

if (-not $KeystorePath) {
    $KeystorePath = Read-Host "Enter path to the EXISTING FC Arena upload keystore (.jks/.keystore)"
}
$KeystorePath = $KeystorePath.Trim().Trim('"')

if (-not (Test-Path $KeystorePath -PathType Leaf)) {
    throw "Keystore file not found: $KeystorePath"
}
$KeystorePath = (Resolve-Path $KeystorePath).Path

if (-not $KeyAlias) {
    $KeyAlias = Read-Host "Enter the existing FC Arena upload-key alias"
}
if ([string]::IsNullOrWhiteSpace($KeyAlias)) {
    throw "Key alias cannot be empty."
}

$storeSecure = Read-Host "Enter keystore password" -AsSecureString
$keySecure = Read-Host "Enter upload-key password" -AsSecureString

$storePassword = $null
$keyPassword = $null

try {
    $storePassword = Get-PlainText $storeSecure
    $keyPassword = Get-PlainText $keySecure

    if ([string]::IsNullOrEmpty($storePassword) -or [string]::IsNullOrEmpty($keyPassword)) {
        throw "Passwords cannot be empty."
    }

    $keytool = Resolve-Tool -Name "keytool.exe" -JavaToolName "keytool.exe"
    $jarsigner = Resolve-Tool -Name "jarsigner.exe" -JavaToolName "jarsigner.exe"

    Write-Host "Verifying upload keystore certificate..."
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $keyInfo = (& $keytool -list -v -keystore $KeystorePath -alias $KeyAlias -storepass $storePassword 2>&1 | Out-String)
        $keytoolExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($keytoolExitCode -ne 0) {
        throw "keytool could not open the keystore/alias. Check the path, alias, and keystore password."
    }

    $fingerprintMatch = [regex]::Match($keyInfo, "SHA256:\s*([0-9A-Fa-f:]+)")
    if (-not $fingerprintMatch.Success) {
        throw "Could not read a SHA-256 certificate fingerprint from the keystore."
    }

    $actualFingerprint = $fingerprintMatch.Groups[1].Value.ToUpperInvariant()
    if ((Normalize-Fingerprint $actualFingerprint) -ne (Normalize-Fingerprint $ExpectedUploadFingerprint)) {
        throw "WRONG SIGNING KEY. Found $actualFingerprint but FC Arena expects $ExpectedUploadFingerprint"
    }

    Write-Host "Upload certificate fingerprint verified: $actualFingerprint"

    $gradleExe = Get-GradleExecutable -Version $GradleVersion

    $env:FC_ARENA_KEYSTORE_FILE = $KeystorePath
    $env:FC_ARENA_STORE_PASSWORD = $storePassword
    $env:FC_ARENA_KEY_ALIAS = $KeyAlias
    $env:FC_ARENA_KEY_PASSWORD = $keyPassword

    Write-Host "Building signed Android App Bundle..."
    Push-Location $AndroidDir
    try {
        & $gradleExe ":app:clean" ":app:bundleRelease" "--stacktrace"
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle signed release build failed."
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path $RawAab -PathType Leaf)) {
        throw "Expected AAB was not produced: $RawAab"
    }

    Write-Host "Verifying signed AAB integrity..."
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $jarsigner -verify -strict $RawAab
        $jarsignerExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($jarsignerExitCode -ne 0) {
        throw "jarsigner verification failed. The AAB is not a valid signed release artifact."
    }

    Write-Host "Verifying certificate embedded in the signed AAB..."
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $aabCertInfo = (& $keytool -printcert -jarfile $RawAab 2>&1 | Out-String)
        $aabKeytoolExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($aabKeytoolExitCode -ne 0) {
        throw "The produced AAB does not expose a valid signer certificate."
    }

    $aabFingerprintMatch = [regex]::Match($aabCertInfo, "SHA256:\s*([0-9A-Fa-f:]+)")
    if (-not $aabFingerprintMatch.Success) {
        throw "Could not read the signed AAB SHA-256 certificate fingerprint."
    }

    $aabFingerprint = $aabFingerprintMatch.Groups[1].Value.ToUpperInvariant()
    if ((Normalize-Fingerprint $aabFingerprint) -ne (Normalize-Fingerprint $ExpectedUploadFingerprint)) {
        throw "SIGNED AAB CERTIFICATE MISMATCH. Found $aabFingerprint"
    }

    New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
    Copy-Item -Force $RawAab $FinalAab

    $fileHash = (Get-FileHash -Algorithm SHA256 -Path $FinalAab).Hash.ToUpperInvariant()
    $metadata = @(
        "FC ARENA Android Play release artifact"
        "file=$FinalName"
        "versionCode=$ExpectedVersionCode"
        "versionName=$ExpectedVersionName"
        "package=in.fcarena.app"
        "sourceCommit=$headCommit"
        "uploadCertificateSHA256=$aabFingerprint"
        "fileSHA256=$fileHash"
    )
    Set-Content -Path $MetadataFile -Value $metadata -Encoding UTF8

    Write-Host ""
    Write-Host "SUCCESS - signed Build 10 is ready."
    Write-Host "AAB: $FinalAab"
    Write-Host "Metadata: $MetadataFile"
    Write-Host "File SHA-256: $fileHash"
    Write-Host "Source commit: $headCommit"
    Write-Host ""
    Write-Host "Next: upload THIS exact AAB to Play Console Internal testing."
}
finally {
    Remove-Item Env:FC_ARENA_KEYSTORE_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:FC_ARENA_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:FC_ARENA_KEY_ALIAS -ErrorAction SilentlyContinue
    Remove-Item Env:FC_ARENA_KEY_PASSWORD -ErrorAction SilentlyContinue

    $storePassword = $null
    $keyPassword = $null
}
