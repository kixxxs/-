$env:ANDROID_HOME = "C:\Android"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Write-Host "Accepting SDK licenses..."
$env:ANDROID_SDK_ROOT = "C:\Android"
echo "y" | cmd /c ""C:\Android\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=C:\Android --licenses"

Write-Host "Installing Android SDK packages..."
echo "y" | cmd /c ""C:\Android\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=C:\Android platform-tools build-tools';36.0.0' platforms';android-36'"

Write-Host "Done."
