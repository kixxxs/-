@echo off
set ANDROID_HOME=C:\Android
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

echo Accepting licenses...
cd C:\Android\cmdline-tools\latest\bin
for /l %%i in (1,1,20) do echo y | sdkmanager.bat --sdk_root=C:\Android --licenses > nul 2>&1

echo.
echo Installing Android SDK packages...
sdkmanager.bat --sdk_root=C:\Android platform-tools
sdkmanager.bat --sdk_root=C:\Android platforms;android-36
sdkmanager.bat --sdk_root=C:\Android build-tools;36.0.0

echo.
echo Done.
