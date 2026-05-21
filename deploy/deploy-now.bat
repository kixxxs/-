@echo off
chcp 65001 >nul
cd /d d:\artist-manager
node deploy\ssh-deploy.js
pause
