@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-RetroCartSetup.ps1" %*
if errorlevel 1 (
  echo Setup could not start. Review the error above; project data has not been reset.
  pause
  exit /b 1
)
