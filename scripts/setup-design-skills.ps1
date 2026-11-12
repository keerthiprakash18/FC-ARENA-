<#
  FC ARENA / Windows PowerShell developer-assistant setup.
  Skills assist coding tools; they are not dependencies loaded in production.
  Review third-party repos before running with -Apply.
#>
[CmdletBinding()]
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
    $commands = @(
        'npx --yes ui-ux-pro-max-cli init --ai codex',
        'npx --yes skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend --agent codex --copy -y'
    )
    Write-Host 'FC ARENA design-skill setup (Codex/Windows)' -ForegroundColor Cyan
    Write-Host 'Review each upstream project and version before enabling third-party executable skills.'
    foreach ($command in $commands) {
        Write-Host "> $command"
        if ($Apply) {
            & cmd.exe /d /c $command
            if ($LASTEXITCODE -ne 0) { throw "Skill installation failed: $command" }
        }
    }
    if (-not $Apply) {
        Write-Host 'DRY RUN: Nothing installed. Run .\scripts\setup-design-skills.ps1 -Apply after review.'
    } else {
        Write-Host 'Skill bootstrap commands completed. Restart Codex and inspect installed SKILL.md files.'
    }
} finally {
    Pop-Location
}
