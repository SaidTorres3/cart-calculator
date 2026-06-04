# Deployment script for WearOS watch app via ADB
# Before using this script, make sure you have paired your watch with your computer using /adb pair <watch-ip>:<port>

$WearApk = "android\wear\build\outputs\apk\release\wear-release.apk"
$PackageName = "com.saidtorres3.cartcalculator"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ADB WearOS Deployment Script (Release)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Verify that WearOS APK exists
if (-not (Test-Path $WearApk)) {
    Write-Warning "WearOS APK not found at $WearApk. Please run .\build-apks.ps1 first."
    $BuildWear = Read-Host "Do you want to build now? (y/n)"
    if ($BuildWear -eq 'y') {
        .\build-apks.ps1
    } else {
        exit 1
    }
}

# 2. Prompt for Watch IP
$WatchIp = Read-Host "Enter Watch ADB IP (e.g., 192.168.1.196:46129)"

if ([string]::IsNullOrWhiteSpace($WatchIp)) {
    Write-Warning "No IP address provided. Exiting."
    exit 1
}

# 3. Connect and Install
Write-Host "`nConnecting to Watch ($WatchIp)..." -ForegroundColor Yellow
adb connect $WatchIp | Out-Null

$Devices = adb devices
if ($Devices -match $WatchIp -and $Devices -match "device") {
    Write-Host "Connected successfully!" -ForegroundColor Green
} else {
    Write-Error "Failed to connect to Watch or device is offline. Please make sure your watch screen is awake and Wireless Debugging is enabled."
    exit 1
}

# WearOS often requires uninstallation to avoid signature conflicts across distinct builds
Write-Host "Uninstalling existing app from watch to prevent signature conflicts..." -ForegroundColor Yellow
adb -s $WatchIp uninstall $PackageName | Out-Null

Write-Host "Installing $WearApk onto Watch..." -ForegroundColor Yellow
$InstallOutput = adb -s $WatchIp install -r $WearApk 2>&1

if ($InstallOutput -match "Success") {
    Write-Host "Deployment to WearOS Watch was SUCCESSFUL!" -ForegroundColor Green
} else {
    Write-Error "Installation failed: $InstallOutput"
}
