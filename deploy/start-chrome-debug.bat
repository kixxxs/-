@echo off
echo Starting Chrome with remote debugging...
echo.
echo IMPORTANT: Close ALL Chrome windows first!
echo.

taskkill /f /im chrome.exe 2>nul
timeout /t 2 /nobreak >nul

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --restore-last-session

echo Chrome started with debugging enabled (port 9222).
echo You can now restore your tabs and navigate back to OrcaTerm.
echo.
echo Once you have the terminal open, tell me "ready" and I'll take over.
pause
