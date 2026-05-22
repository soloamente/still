# Installs motion-plus on Windows without Bun's BadPathName bug on registry URLs.
#
# From apps/web (pick one):
#   $env:MOTION_AUTH_TOKEN = "paste-from-https://motion.dev/dashboard/tokens"
#   .\scripts\install-motion-plus.ps1
#
#   .\scripts\install-motion-plus.ps1 -Token "paste-token-here"

param(
	[string]$Version = "2.10.0",
	[string]$Token = $env:MOTION_AUTH_TOKEN
)

$ErrorActionPreference = "Stop"

if (-not $Token -or $Token.Trim().Length -eq 0) {
	Write-Host ""
	Write-Host "No token found. Set it before running:" -ForegroundColor Yellow
	Write-Host '  $env:MOTION_AUTH_TOKEN = "your-token"' -ForegroundColor Cyan
	Write-Host "  .\scripts\install-motion-plus.ps1" -ForegroundColor Cyan
	Write-Host ""
	Write-Host "Or pass -Token (same session only):" -ForegroundColor Yellow
	Write-Host '  .\scripts\install-motion-plus.ps1 -Token "your-token"' -ForegroundColor Cyan
	Write-Host ""
	exit 1
}

$root = Split-Path $PSScriptRoot -Parent
$env:MOTION_AUTH_TOKEN = $Token.Trim()
$env:MOTION_PLUS_VERSION = $Version
node (Join-Path $PSScriptRoot "ensure-motion-plus.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location $root
Write-Host "Installing from local file..."
bun add "file:.cache/motion-plus.tgz"
if ($LASTEXITCODE -ne 0) {
	Write-Host "bun add failed — run `bun install` from the repo root." -ForegroundColor Red
	exit $LASTEXITCODE
}

Write-Host "Done — motion-plus installed (see file:.cache/motion-plus.tgz)." -ForegroundColor Green
