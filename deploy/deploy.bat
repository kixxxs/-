@echo off
title Deploy to Tencent Cloud CVM 42.194.230.53
echo ============================================
echo  Deploying Artist Manager Server to CVM
echo  42.194.230.53
echo ============================================
echo.
echo.
echo Step 0: Create directories on server
echo (Enter the CVM password when prompted)
echo.

C:\Windows\System32\OpenSSH\ssh.exe -o StrictHostKeyChecking=no root@42.194.230.53 "mkdir -p /app/server /app/data && echo Directories ready"

echo.
echo Step 1: Transfer files via SCP
echo.

cd /d d:\artist-manager\deploy\scp-payload
C:\Windows\System32\OpenSSH\scp.exe -o StrictHostKeyChecking=no server.js server\database.js package.json root@42.194.230.53:/app/
if %ERRORLEVEL% neq 0 (
    echo.
    echo SCP failed! Check password or network.
    pause
    exit /b 1
)

echo.
echo Step 2: Install and start server via SSH
echo.

C:\Windows\System32\OpenSSH\ssh.exe -o StrictHostKeyChecking=no root@42.194.230.53 "cd /app && npm install && mkdir -p /app/data && pkill -f 'node /app/server.js' 2>/dev/null; sleep 1; nohup env PORT=8080 DB_PATH=/app/data/artist_data.db node /app/server.js > /app/server.log 2>&1 &; sleep 3; echo '=== Server process ==='; ps aux | grep 'node /app/server' | grep -v grep; echo '=== API test ==='; curl -s http://localhost:8080/api/ping"

echo.
echo ============================================
echo  Deployment complete!
echo  Test: http://42.194.230.53:8080/api/ping
echo ============================================
pause
