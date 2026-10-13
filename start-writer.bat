@echo off
rem Double-click to open the ASRBMY Writer (needs Node.js from nodejs.org).
cd /d "%~dp0"
if not exist node_modules (
  echo Installing, one moment...
  call npm install
)
node writer\server.js
pause
