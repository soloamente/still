# Registers the Sense Companion Discord host for Chrome and Edge (current user).
# Discord desktop must be running. The Application ID is not a secret:
# paste it into discord-application.json as "clientId", then run this script again
# if the host was already started (reload the extension after).
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $here "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

# Chrome keeps the installed exe open while a title is playing, and Windows
# refuses to replace a running program (EPERM). Build beside it, then point
# the registry at whichever file we could actually write.
$stagingName = "sense-companion-host.staging.exe"
$primaryName = "sense-companion-host.exe"
$fallbackName = "sense-companion-host-next.exe"

Push-Location $here
try {
	# Chrome keeps the installed exe open while a title is playing, and Windows
	# refuses to replace a running program. Stop it before the build is moved
	# into place so the registry can point at the primary exe.
	Get-Process -Name "sense-companion-host","sense-companion-host-next" -ErrorAction SilentlyContinue |
		Stop-Process -Force -ErrorAction SilentlyContinue
	if (Test-Path (Join-Path $dist $stagingName)) {
		Remove-Item (Join-Path $dist $stagingName) -Force
	}
	bun build --compile ./src/main.ts --outfile ("./dist/" + $stagingName)
	if ($LASTEXITCODE -ne 0) { throw "bun build --compile failed" }
} finally {
	Pop-Location
}

$stagingPath = Join-Path $dist $stagingName
$exePath = Join-Path $dist $primaryName
try {
	Move-Item -Path $stagingPath -Destination $exePath -Force
} catch {
	$exePath = Join-Path $dist $fallbackName
	if (Test-Path $exePath) {
		Remove-Item $exePath -Force -ErrorAction SilentlyContinue
	}
	Move-Item -Path $stagingPath -Destination $exePath -Force
}

$installedConfig = Join-Path $dist "discord-application.json"
# The source file is the one to edit. Re-running this script copies it next to the exe.
Copy-Item (Join-Path $here "discord-application.json") $installedConfig -Force

$exePath = (Resolve-Path $exePath).Path
$manifestPath = Join-Path $dist "com.sense.companion.json"
# This id matches the public key in the extension manifest. Both browsers use it.
$extensionOrigin = "chrome-extension://lgpholiafjmbbnpnfcopdkiocaeicmcp/"
$manifest = @"
{
  "name": "com.sense.companion",
  "description": "Sense Companion Discord presence",
  "path": "$($exePath.Replace('\', '\\'))",
  "type": "stdio",
  "allowed_origins": ["$extensionOrigin"]
}
"@
Set-Content -Path $manifestPath -Value $manifest -Encoding ascii

function Register-NativeHost([string]$registryPath) {
	New-Item -Path $registryPath -Force | Out-Null
	Set-Item -Path $registryPath -Value $manifestPath
}

Register-NativeHost "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.sense.companion"
Register-NativeHost "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.sense.companion"

# The copy Chrome already launched is still running. Stop every name we
# have registered so the next message starts the build this script just wrote.
Get-Process -Name "sense-companion-host","sense-companion-host-next" -ErrorAction SilentlyContinue |
	Stop-Process -Force -ErrorAction SilentlyContinue

Write-Output "Sense Companion Discord host registered."
Write-Output $manifestPath
