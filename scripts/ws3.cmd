@echo off
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0ws3.ps1" %*
exit /b %ERRORLEVEL%
