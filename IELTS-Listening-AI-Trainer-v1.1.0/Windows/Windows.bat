@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0.."
set "APP_DIR=%ROOT_DIR%\AppFiles"
set "BACKEND_DIR=%APP_DIR%\backend"
set "FRONTEND_DIR=%APP_DIR%\frontend"
set "RUNTIME_DIR=%ROOT_DIR%\.runtime"
if "%NODE_VERSION%"=="" set "NODE_VERSION=22.13.1"
if "%PYTHON_VERSION%"=="" set "PYTHON_VERSION=3.11.9"
if "%WHISPER_MODEL%"=="" set "WHISPER_MODEL=base"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=3001"
if "%WHISPER_CACHE_DIR%"=="" (
  set "MODEL_CACHE_DIR=%USERPROFILE%\.cache\whisper"
) else (
  set "MODEL_CACHE_DIR=%WHISPER_CACHE_DIR%"
)
set "WHISPER_CACHE_DIR=%MODEL_CACHE_DIR%"
set "MODEL_FILE=%MODEL_CACHE_DIR%\%WHISPER_MODEL%.pt"

echo IELTS Listening AI Trainer
echo ============================
call :print_status
echo 1^) First-time setup or repair missing items, then start
echo 2^) Start only ^(offline: never downloads or installs^)
echo 3^) Download the Whisper model if missing
echo 4^) Show installation status
echo 5^) Uninstall generated files and model cache
echo 6^) Exit
set /p CHOICE=Choose an option: 

if "%CHOICE%"=="1" call :install_deps && call :download_model && call :start_app
if "%CHOICE%"=="2" call :start_app
if "%CHOICE%"=="3" call :download_model
if "%CHOICE%"=="4" call :print_status && pause
if "%CHOICE%"=="5" call :uninstall_all
exit /b

:install_deps
call :setup_node_runtime
if errorlevel 1 exit /b %errorlevel%
call :setup_python_runtime
if errorlevel 1 exit /b %errorlevel%

echo ==^> Installing backend dependencies
cd /d "%BACKEND_DIR%"
if not exist ".venv" "%PYTHON_EXE%" -m venv .venv
if errorlevel 1 exit /b %errorlevel%
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 exit /b %errorlevel%
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 exit /b %errorlevel%

echo ==^> Installing frontend dependencies
cd /d "%FRONTEND_DIR%"
if exist "package-lock.json" (
  npm ci
) else (
  npm install
)
exit /b %errorlevel%

:download_model
if not exist "%BACKEND_DIR%\.venv" call :install_deps
call :verify_model
if not errorlevel 1 (
  echo ==^> Whisper model '%WHISPER_MODEL%' is already downloaded
  exit /b 0
)
if exist "%MODEL_FILE%" (
  echo ==^> Removing incomplete Whisper model '%WHISPER_MODEL%'
  del /f /q "%MODEL_FILE%"
)
cd /d "%BACKEND_DIR%"
echo ==^> Downloading Whisper model '%WHISPER_MODEL%' ^(one-time^)
".venv\Scripts\python.exe" -c "import os, whisper; model_name=os.environ.get('WHISPER_MODEL','base'); cache_dir=r'%MODEL_CACHE_DIR%'; whisper.load_model(model_name, download_root=cache_dir); print(f'Downloaded and verified Whisper model: {model_name}')"
if errorlevel 1 exit /b %errorlevel%
call :verify_model
if errorlevel 1 (
  echo The model download completed but integrity verification failed.
  exit /b 1
)
exit /b 0

:start_app
if not exist "%BACKEND_DIR%\.venv" (
  echo Dependencies are missing. Choose option 1 first.
  exit /b 1
)
call :activate_existing_node
if errorlevel 1 (
  echo Node.js is not installed for this app.
  echo Choose option 1 once to finish setup. Option 2 never downloads files.
  exit /b 1
)
call :verify_model
if errorlevel 1 (
  echo The Whisper model '%WHISPER_MODEL%' is missing or incomplete.
  echo Choose option 1 or 3 to download and verify it. Option 2 never downloads files.
  exit /b 1
)
if not exist "%FRONTEND_DIR%\node_modules" (
  echo Dependencies are missing. Choose option 1 first.
  exit /b 1
)

call :stop_port %BACKEND_PORT%
call :stop_port %FRONTEND_PORT%

echo ==^> Starting backend: http://127.0.0.1:%BACKEND_PORT%
start "IELTS Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && "".venv\Scripts\python.exe"" -m uvicorn app.main:app --host 127.0.0.1 --port %BACKEND_PORT%"

echo ==^> Starting frontend: http://127.0.0.1:%FRONTEND_PORT%
start "IELTS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && if exist .next rmdir /s /q .next & node_modules\.bin\next.cmd dev -p %FRONTEND_PORT%"
timeout /t 2 >nul
start http://127.0.0.1:%FRONTEND_PORT%
exit /b 0

:uninstall_all
echo ==^> Removing generated app dependencies and build files
rmdir /s /q "%BACKEND_DIR%\.venv" 2>nul
rmdir /s /q "%FRONTEND_DIR%\node_modules" 2>nul
rmdir /s /q "%FRONTEND_DIR%\.next" 2>nul
rmdir /s /q "%RUNTIME_DIR%" 2>nul
del /f /q "%FRONTEND_DIR%\tsconfig.tsbuildinfo" 2>nul
for /d /r "%APP_DIR%" %%d in (__pycache__) do rmdir /s /q "%%d" 2>nul
del /s /q "%APP_DIR%\*.pyc" 2>nul

echo ==^> Removing Whisper model cache for this user
rmdir /s /q "%MODEL_CACHE_DIR%" 2>nul
echo ==^> Uninstall complete. Source files were kept.
pause
exit /b 0

:setup_node_runtime
call :activate_existing_node
if not errorlevel 1 exit /b 0

set "NODE_DIR=%RUNTIME_DIR%\node-v%NODE_VERSION%-win-x64"
set "NODE_ZIP=%RUNTIME_DIR%\node-v%NODE_VERSION%-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip"

echo ==^> Downloading local Node.js v%NODE_VERSION% ^(one-time^)
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'; if (Test-Path '%NODE_DIR%') { Remove-Item '%NODE_DIR%' -Recurse -Force }; Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%RUNTIME_DIR%' -Force; Remove-Item '%NODE_ZIP%' -Force"
if errorlevel 1 (
  echo Node.js setup failed. Run option 1 later or install Node.js from https://nodejs.org/.
  exit /b 1
)
call :activate_existing_node
if errorlevel 1 (
  echo Node.js was downloaded but could not be verified.
  exit /b 1
)
exit /b 0

:activate_existing_node
where node >nul 2>nul
if not errorlevel 1 (
  where npm >nul 2>nul
  if not errorlevel 1 exit /b 0
)

set "NODE_DIR=%RUNTIME_DIR%\node-v%NODE_VERSION%-win-x64"
if not exist "%NODE_DIR%\node.exe" exit /b 1
if not exist "%NODE_DIR%\npm.cmd" exit /b 1
set "PATH=%NODE_DIR%;%PATH%"
where npm >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0

:print_status
echo Installation status
call :activate_existing_node >nul 2>nul
if errorlevel 1 (echo   Node.js:      Missing) else (echo   Node.js:      Ready)
if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (echo   Backend:      Ready) else (echo   Backend:      Missing)
if exist "%FRONTEND_DIR%\node_modules\next\dist\bin\next" (echo   Frontend:     Ready) else (echo   Frontend:     Missing)
call :verify_model
if errorlevel 1 (echo   Whisper %WHISPER_MODEL%: Missing or incomplete) else (echo   Whisper %WHISPER_MODEL%: Ready)
echo.
exit /b 0

:verify_model
if not exist "%BACKEND_DIR%\.venv\Scripts\python.exe" exit /b 1
if not exist "%MODEL_FILE%" exit /b 1
cd /d "%BACKEND_DIR%"
".venv\Scripts\python.exe" -c "from app.services.transcription import model_file_is_valid; raise SystemExit(0 if model_file_is_valid('%WHISPER_MODEL%') else 1)" >nul 2>nul
exit /b %errorlevel%

:setup_python_runtime
if exist "%RUNTIME_DIR%\python\python.exe" (
  set "PYTHON_EXE=%RUNTIME_DIR%\python\python.exe"
  exit /b 0
)

where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_EXE=python"
    exit /b 0
  )
)

set "PYTHON_INSTALLER=%RUNTIME_DIR%\python-%PYTHON_VERSION%-amd64.exe"
set "PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-amd64.exe"
echo ==^> Python was not found. Downloading local Python %PYTHON_VERSION%
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%PYTHON_INSTALLER%'; $installArgs=@('/quiet','InstallAllUsers=0','Include_launcher=0','Include_test=0','PrependPath=0','TargetDir=%RUNTIME_DIR%\python'); Start-Process -FilePath '%PYTHON_INSTALLER%' -ArgumentList $installArgs -Wait; Remove-Item '%PYTHON_INSTALLER%' -Force"
if not exist "%RUNTIME_DIR%\python\python.exe" (
  echo Python setup failed. Install Python 3.10 or 3.11 from https://python.org and run this file again.
  exit /b 1
)
set "PYTHON_EXE=%RUNTIME_DIR%\python\python.exe"
exit /b 0

:stop_port
set "PORT_TO_STOP=%~1"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT_TO_STOP% " ^| findstr "LISTENING"') do (
  echo ==^> Releasing port %PORT_TO_STOP%
  taskkill /PID %%p /F >nul 2>nul
)
exit /b 0
