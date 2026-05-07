$env:ANDROID_HOME = "C:\Android"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# Accept all licenses by piping many "y" answers
$yeses = "y`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`n"
$yeses | cmd /c "C:\Android\cmdline-tools\latest\bin\sdkmanager.bat --sdk_root=C:\Android --licenses" 2>&1

Write-Host "--- Licenses accepted, installing packages ---"

# Install each package separately
$packages = @("platform-tools", "platforms;android-36", "build-tools;36.0.0")
foreach ($pkg in $packages) {
    Write-Host "Installing: $pkg"
    & "C:\Android\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=C:\Android $pkg 2>&1
}

Write-Host "Done."
