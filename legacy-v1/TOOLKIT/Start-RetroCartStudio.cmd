@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-RetroCartStudio-Pinned.ps1" %*
set "studioExit=%ERRORLEVEL%"
if not "%studioExit%"=="0" pause
exit /b %studioExit%
