@echo off
setlocal
pushd "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo First run: installing the desktop runtime...
  call npm.cmd ci
  if errorlevel 1 goto fail
)
call npm.cmd start
if errorlevel 1 goto fail
popd
exit /b 0
:fail
echo Launch failed. Copy the error above for troubleshooting.
pause
popd
exit /b 1
