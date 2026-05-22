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
$cacheDir = Join-Path $root ".cache"
$tarball = Join-Path $cacheDir "motion-plus-$Version.tgz"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Must be registry.tgz — not registry? (see motion.dev/docs)
$url = "https://api.motion.dev/registry.tgz?package=motion-plus&version=$Version&token=$Token"
Write-Host "Downloading motion-plus $Version to $tarball ..."
try {
	Invoke-WebRequest -Uri $url -OutFile $tarball -UseBasicParsing
} catch {
	Write-Host "Download failed. Check token at https://motion.dev/dashboard/tokens" -ForegroundColor Red
	throw
}

if (-not (Test-Path $tarball) -or (Get-Item $tarball).Length -lt 1024) {
	Write-Host "Download produced no valid tarball (token rejected or empty response)." -ForegroundColor Red
	if (Test-Path $tarball) { Remove-Item $tarball -Force }
	exit 1
}

# package.json pins `file:.cache/motion-plus.tgz` — stable path for Bun workspace installs.
$stableTarball = Join-Path $cacheDir "motion-plus.tgz"
Copy-Item -Path $tarball -Destination $stableTarball -Force

Set-Location $root
Write-Host "Installing from local file..."
bun add "file:.cache/motion-plus.tgz"
if ($LASTEXITCODE -ne 0) {
	Write-Host "bun add failed — run `bun install` from the repo root." -ForegroundColor Red
	exit $LASTEXITCODE
}

Write-Host "Done — motion-plus installed (see file:.cache/motion-plus.tgz)." -ForegroundColor Green
