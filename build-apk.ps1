$env:ANDROID_HOME = "C:\Android"
$env:ANDROID_SDK_ROOT = "C:\Android"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

Write-Host "=== Environment ==="
Write-Host "JAVA_HOME: $env:JAVA_HOME"
java -version 2>&1 | Select-Object -First 1

Write-Host "=== Building APK ==="
Set-Location "d:\artist-manager\android"
$result = & .\gradlew.bat assembleDebug 2>&1
$result | ForEach-Object { Write-Host $_ }
Set-Location "d:\artist-manager"

Write-Host ""
Write-Host "=== Build Result ==="
$apk = Get-ChildItem -Path "d:\artist-manager\android\app\build\outputs\apk\debug" -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue
if ($apk) {
    Write-Host "APK built successfully!"
    Write-Host "Path: $($apk.FullName)"
    Write-Host "Size: $([math]::Round($apk.Length / 1MB, 2)) MB"
} else {
    Write-Host "APK not found. Checking for errors..."
    Get-ChildItem -Path "d:\artist-manager\android" -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue
}
