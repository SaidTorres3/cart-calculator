# Build script for Android phone app and WearOS app

Write-Host "Starting build process..." -ForegroundColor Cyan

# Ensure we are in the correct directory
$ProjectRoot = Get-Item -Path "."
$AndroidDir = Join-Path $ProjectRoot.FullName "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Error "Android project directory not found at $AndroidDir. Please run 'npx expo prebuild' first if needed."
    exit 1
}

# Navigate to android folder
Push-Location $AndroidDir

Write-Host "Running Gradle build for both phone and watch (Release)..." -ForegroundColor Yellow
# Run gradle to build both release APKs
./gradlew :app:assembleRelease :wear:assembleRelease

$BuildExitCode = $LASTEXITCODE

Pop-Location

if ($BuildExitCode -ne 0) {
    Write-Error "Build failed with exit code $BuildExitCode"
    exit $BuildExitCode
}

Write-Host "`nBuild Successful!" -ForegroundColor Green

# Locate the generated APK files
$PhoneApk = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"
$WearApk = Join-Path $AndroidDir "wear\build\outputs\apk\release\wear-release.apk"

Write-Host "`n----------------------------------------" -ForegroundColor Cyan
Write-Host "Generated APK Locations:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

if (Test-Path $PhoneApk) {
    $PhoneApkPath = (Get-Item $PhoneApk).FullName
    Write-Host "Phone App (Release):  " -NoNewline -ForegroundColor White
    Write-Host $PhoneApkPath -ForegroundColor Green
} else {
    Write-Host "Phone APK was not found at expected location: $PhoneApk" -ForegroundColor Red
}

if (Test-Path $WearApk) {
    $WearApkPath = (Get-Item $WearApk).FullName
    Write-Host "WearOS App (Release): " -NoNewline -ForegroundColor White
    Write-Host $WearApkPath -ForegroundColor Green
} else {
    Write-Host "WearOS APK was not found at expected location: $WearApk" -ForegroundColor Red
}
Write-Host "----------------------------------------" -ForegroundColor Cyan
