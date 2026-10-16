@echo off
rem Double-click to open the ASRBMY Writer (needs Node.js from nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org ^(the LTS version^), install it, then double-click this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing, one moment...
  call npm install
)
node writer\server.js
pause
