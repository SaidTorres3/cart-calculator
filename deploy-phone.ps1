# Deployment script for Android Phone app via ADB
# Before using this script, make sure you have paired your phone with your computer using /adb pair <phone-ip>:<port>

$PhoneApk = "android\app\build\outputs\apk\release\app-release.apk"
$PackageName = "com.saidtorres3.cartcalculator"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ADB Phone Deployment Script (Release) " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Verify that Phone APK exists
if (-not (Test-Path $PhoneApk)) {
    Write-Warning "Phone APK not found at $PhoneApk. Please run .\build-apks.ps1 first."
    $BuildPhone = Read-Host "Do you want to build now? (y/n)"
    if ($BuildPhone -eq 'y') {
        .\build-apks.ps1
    } else {
        exit 1
    }
}

# 2. Prompt for Phone IP
$PhoneIp = Read-Host "Enter Phone ADB IP (e.g., 192.168.1.158:36691)"

if ([string]::IsNullOrWhiteSpace($PhoneIp)) {
    Write-Warning "No IP address provided. Exiting."
    exit 1
}

# 3. Connect and Install
Write-Host "`nConnecting to Phone ($PhoneIp)..." -ForegroundColor Yellow
adb connect $PhoneIp | Out-Null

$Devices = adb devices
if ($Devices -match $PhoneIp -and $Devices -match "device") {
    Write-Host "Connected successfully!" -ForegroundColor Green
} else {
    Write-Error "Failed to connect to Phone or device is offline. Please make sure Wireless Debugging is enabled and the screen is awake."
    exit 1
}

Write-Host "Installing $PhoneApk..." -ForegroundColor Yellow
$InstallOutput = adb -s $PhoneIp install -r $PhoneApk 2>&1

if ($InstallOutput -match "Success") {
    Write-Host "Deployment to Phone was SUCCESSFUL!" -ForegroundColor Green
} else {
    Write-Host "Installation failed: $InstallOutput" -ForegroundColor Red
    
    $Retry = Read-Host "Would you like to try uninstalling the existing app first and reinstalling? (y/n)"
    if ($Retry -eq 'y') {
        Write-Host "Uninstalling old version..." -ForegroundColor Yellow
        adb -s $PhoneIp uninstall $PackageName | Out-Null
        
        Write-Host "Retrying installation..." -ForegroundColor Yellow
        $RetryOutput = adb -s $PhoneIp install -r $PhoneApk 2>&1
        if ($RetryOutput -match "Success") {
            Write-Host "Deployment to Phone was SUCCESSFUL!" -ForegroundColor Green
        } else {
            Write-Error "Reinstallation failed: $RetryOutput"
        }
    }
}
