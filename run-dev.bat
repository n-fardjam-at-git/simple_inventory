@echo off
title Run dev
cd /d C:\Users\Designer\simple_inventory

echo Stopping the dev server if it is already running...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000 "') do (
  tasklist /FI "PID eq %%P" /NH | findstr /I /B "node.exe" >nul
  if not errorlevel 1 (
    echo Stopping node %%P
    taskkill /PID %%P /T /F >nul
  )
)

echo Starting dev server in %CD%
npm run dev
