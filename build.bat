@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Node.js is required. & exit /b 1)
where npm >nul 2>nul
if errorlevel 1 (echo npm is required. & exit /b 1)
if not exist node_modules\electron\dist\electron.exe (
  echo Dependencies missing. Run npm ci once, then build.bat again.
  exit /b 1
)
call npm test
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
node scripts/package-local.cjs
if errorlevel 1 exit /b 1
 echo Build complete. Fixed working path updated safely; versioned releases preserved.
endlocal
