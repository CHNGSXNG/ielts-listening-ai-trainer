@echo off
setlocal
cd /d "%~dp0"

echo IELTS Listening AI Trainer
echo Checking requirements...

set NODE_VERSION=v20.14.0
set RUNTIME_DIR=%cd%\.runtime
set LOCAL_NODE_DIR=%RUNTIME_DIR%\node

where py >nul 2>nul
if %errorlevel%==0 (
  set PYTHON_CMD=py -3
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 is not installed. Install it from https://www.python.org/downloads/ and run this file again.
    pause
    exit /b 1
  )
  set PYTHON_CMD=python
)

where npm >nul 2>nul
if errorlevel 1 (
  if exist "%LOCAL_NODE_DIR%\npm.cmd" (
    echo Using private Node.js runtime in Required Files\.runtime.
    set PATH=%LOCAL_NODE_DIR%;%LOCAL_NODE_DIR%\node_modules\npm\bin;%PATH%
  ) else (
    echo Node.js/npm was not found. Downloading a private Node.js runtime for this app...
    echo This does not install Node.js system-wide.
    call :download_node
    if errorlevel 1 (
      echo Failed to download private Node.js runtime.
      pause
      exit /b 1
    )
    set PATH=%LOCAL_NODE_DIR%;%LOCAL_NODE_DIR%\node_modules\npm\bin;%PATH%
  )
) else (
  echo Using system Node.js/npm.
)

node --version
npm --version

echo Installing backend dependencies...
if not exist "backend\.venv" (
  %PYTHON_CMD% -m venv backend\.venv
)
call backend\.venv\Scripts\activate.bat
python -m pip install --upgrade pip --timeout 120
if errorlevel 1 python -m pip install --upgrade pip --timeout 120 -i https://pypi.tuna.tsinghua.edu.cn/simple
python -m pip install -r backend\requirements.txt --timeout 120
if errorlevel 1 python -m pip install -r backend\requirements.txt --timeout 120 -i https://pypi.tuna.tsinghua.edu.cn/simple
call deactivate

echo Installing frontend dependencies...
if not exist "node_modules" (
  call npm install --fetch-timeout=600000 --fetch-retries=5
  if errorlevel 1 call npm install --registry=https://registry.npmmirror.com --fetch-timeout=600000 --fetch-retries=5
)

echo Starting backend and frontend...
echo Open http://localhost:3000 in your browser.

start "IELTS Trainer Backend" cmd /k "cd /d ""%~dp0backend"" && call .venv\Scripts\activate.bat && set HF_HUB_DOWNLOAD_TIMEOUT=300 && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "IELTS Trainer Frontend" cmd /k "cd /d ""%~dp0"" && set PATH=%LOCAL_NODE_DIR%;%LOCAL_NODE_DIR%\node_modules\npm\bin;%PATH% && npm run dev"

timeout /t 4 >nul
start http://localhost:3000

echo App started. Keep the backend and frontend windows open while using it.
pause
exit /b 0

:download_node
if not exist "%RUNTIME_DIR%\downloads" mkdir "%RUNTIME_DIR%\downloads"
set NODE_ARCH=win-x64
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set NODE_ARCH=win-arm64
set NODE_FILE=node-%NODE_VERSION%-%NODE_ARCH%.zip
set NODE_ZIP=%RUNTIME_DIR%\downloads\%NODE_FILE%
set NODE_URL_PRIMARY=https://nodejs.org/dist/%NODE_VERSION%/%NODE_FILE%
set NODE_URL_MIRROR=https://npmmirror.com/mirrors/node/%NODE_VERSION%/%NODE_FILE%

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%NODE_URL_PRIMARY%' -OutFile '%NODE_ZIP%' -TimeoutSec 300 } catch { exit 1 }"
if errorlevel 1 (
  echo Official Node.js download failed. Trying China-friendly mirror...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%NODE_URL_MIRROR%' -OutFile '%NODE_ZIP%' -TimeoutSec 300 } catch { exit 1 }"
  if errorlevel 1 exit /b 1
)

if exist "%LOCAL_NODE_DIR%" rmdir /s /q "%LOCAL_NODE_DIR%"
mkdir "%RUNTIME_DIR%\extract"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%RUNTIME_DIR%\extract' -Force"
if errorlevel 1 exit /b 1
for /d %%D in ("%RUNTIME_DIR%\extract\node-*") do move "%%D" "%LOCAL_NODE_DIR%" >nul
rmdir /s /q "%RUNTIME_DIR%\extract"
exit /b 0
