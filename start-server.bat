@echo off
title 艺人管理系统 - 服务器

echo ========================================
echo   艺人管理系统 - 云服务器启动
echo ========================================
echo.

REM Start the Express server on port 8080
echo [1/2] 启动本地服务器 (端口 8080)...
set PORT=8080
start "ArtistServer" /MIN cmd /c "node server.js"

REM Wait for server to start
timeout /t 3 /nobreak >nul

REM Start cpolar tunnel
echo [2/2] 启动 cpolar 内网穿透...
start "CpolarTunnel" /MIN cmd /c "C:\Program Files\cpolar\cpolar.exe http 8080"

echo.
echo ========================================
echo   服务器已启动！
echo   本地地址: http://localhost:8080
echo   公网地址: https://22bf731d.r9.vip.cpolar.cn
echo   管理面板: http://localhost:9200
echo ========================================
echo.
echo 按任意键关闭此窗口（服务器会继续运行）
pause >nul
