param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$coappRoot = Join-Path $projectRoot 'coapp'
$distMain = Join-Path $coappRoot 'dist\main.js'

if (-not (Test-Path $distMain)) {
    throw "CoApp build not found: $distMain"
}

$devDir = Join-Path $env:LOCALAPPDATA 'MediaGrabberDev'
$launcherExe = Join-Path $devDir 'mediagrabber-host-v3.exe'
$manifestPath = Join-Path $devDir 'com.mediagrabber.coapp.json'

New-Item -ItemType Directory -Force -Path $devDir | Out-Null

Push-Location $projectRoot
try {
    npx pkg -t node18-win-x64 -o $launcherExe $distMain
    if ($LASTEXITCODE -ne 0) {
        throw "pkg failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

$manifest = @{
    name = 'com.mediagrabber.coapp'
    description = 'MediaGrabber companion application (dev)'
    path = $launcherExe
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $manifestPath

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mediagrabber.coapp" /ve /d $manifestPath /f | Out-Null
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.mediagrabber.coapp" /ve /d $manifestPath /f | Out-Null

Write-Host "Dev native host registered."
Write-Host "Launcher: $launcherExe"
Write-Host "Manifest: $manifestPath"
Write-Host "Extension ID: $ExtensionId"
