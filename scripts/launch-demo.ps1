<#
.SYNOPSIS
    KinesioLive Demo Launcher for Dual-Profile Testing and Screen Recording
.DESCRIPTION
    Launches Patient and Clinician in isolated browser instances on a single machine.
    Uses Chromium's synthetic fake media stream for the Patient so that:
    1. Windows webcam device contention (NotReadableError) is eliminated.
    2. The Clinician sees a synthetic test video stream while the Clinician tab uses the physical webcam.
    3. Both views can be recorded simultaneously side-by-side on one laptop.
.PARAMETER Role
    'patient', 'clinician', or 'both' (default: 'both')
.PARAMETER Port
    Port number for the KinesioLive server (default: 5000)
#>

param (
    [ValidateSet('patient', 'clinician', 'both')]
    [string]$Role = 'both',
    [int]$Port = 5000
)

# Detect Chrome executable
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chromeExe) {
    Write-Warning "Google Chrome executable not found in default paths. Launching default browser."
    if ($Role -eq 'both' -or $Role -eq 'patient') {
        Start-Process "http://localhost:$Port/?role=patient"
    }
    if ($Role -eq 'both' -or $Role -eq 'clinician') {
        Start-Process "http://localhost:$Port/?role=clinician"
    }
    exit 0
}

$patientDir = Join-Path $env:TEMP "kinesio_chrome_patient"
$clinicianDir = Join-Path $env:TEMP "kinesio_chrome_clinician"

if ($Role -eq 'both' -or $Role -eq 'patient') {
    Write-Host "[DEMO] Launching Patient view with synthetic fake media stream on http://localhost:$Port/?role=patient" -ForegroundColor Green
    $patientArgs = @(
        "--user-data-dir=`"$patientDir`"",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--no-first-run",
        "--no-default-browser-check",
        "http://localhost:$Port/?role=patient"
    )
    Start-Process -FilePath $chromeExe -ArgumentList $patientArgs
}

if ($Role -eq 'both') {
    Start-Sleep -Seconds 1
}

if ($Role -eq 'both' -or $Role -eq 'clinician') {
    Write-Host "[DEMO] Launching Clinician view with physical webcam on http://localhost:$Port/?role=clinician" -ForegroundColor Cyan
    $clinicianArgs = @(
        "--user-data-dir=`"$clinicianDir`"",
        "--no-first-run",
        "--no-default-browser-check",
        "http://localhost:$Port/?role=clinician"
    )
    Start-Process -FilePath $chromeExe -ArgumentList $clinicianArgs
}

Write-Host "✅ [DEMO READY] Isolated dual-role session active." -ForegroundColor Yellow
