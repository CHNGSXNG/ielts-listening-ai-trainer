@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0.."
set "APP_DIR=%ROOT_DIR%\AppFiles"
set "BACKEND_DIR=%APP_DIR%\backend"
set "FRONTEND_DIR=%APP_DIR%\frontend"
if "%WHISPER_MODEL%"=="" set "WHISPER_MODEL=base"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=3001"

echo IELTS Listening AI Trainer
echo 1^) Install dependencies, download model, and start
echo 2^) Start only
echo 3^) Download/refresh Whisper model only
echo 4^) Uninstall generated files and model cache
echo 5^) Exit
set /p CHOICE=Choose an option: 

if "%CHOICE%"=="1" call :install_deps && call :download_model && call :start_app
if "%CHOICE%"=="2" call :start_app
if "%CHOICE%"=="3" call :download_model
if "%CHOICE%"=="4" call :uninstall_all
exit /b

:install_deps
echo ==^> Installing backend dependencies
cd /d "%BACKEND_DIR%"
if not exist ".venv" python -m venv .venv
if errorlevel 1 exit /b %errorlevel%
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 exit /b %errorlevel%
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 exit /b %errorlevel%

echo ==^> Installing frontend dependencies
cd /d "%FRONTEND_DIR%"
where pnpm >nul 2>nul
if not errorlevel 1 (
  pnpm install
) else (
  where corepack >nul 2>nul
  if not errorlevel 1 (
    corepack enable
    corepack pnpm install
  ) else (
    npm install
  )
)
exit /b %errorlevel%

:download_model
if not exist "%BACKEND_DIR%\.venv" call :install_deps
cd /d "%BACKEND_DIR%"
echo ==^> Downloading Whisper model: %WHISPER_MODEL%
".venv\Scripts\python.exe" -c "import os, whisper; model_name=os.environ.get('WHISPER_MODEL','base'); cache_dir=os.environ.get('WHISPER_CACHE_DIR'); whisper.load_model(model_name, download_root=cache_dir); print(f'Downloaded and verified Whisper model: {model_name}')"
exit /b %errorlevel%

:start_app
if not exist "%BACKEND_DIR%\.venv" (
  echo Dependencies are missing. Choose option 1 first.
  exit /b 1
)
if not exist "%FRONTEND_DIR%\node_modules" (
  echo Dependencies are missing. Choose option 1 first.
  exit /b 1
)

echo ==^> Starting backend: http://127.0.0.1:%BACKEND_PORT%
start "IELTS Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && "".venv\Scripts\python.exe"" -m uvicorn app.main:app --host 127.0.0.1 --port %BACKEND_PORT%"

echo ==^> Starting frontend: http://127.0.0.1:%FRONTEND_PORT%
where pnpm >nul 2>nul
if not errorlevel 1 (
  start "IELTS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && pnpm exec next dev -p %FRONTEND_PORT%"
) else (
  start "IELTS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev -- -p %FRONTEND_PORT%"
)
timeout /t 2 >nul
start http://127.0.0.1:%FRONTEND_PORT%
exit /b 0

:uninstall_all
echo ==^> Removing generated app dependencies and build files
rmdir /s /q "%BACKEND_DIR%\.venv" 2>nul
rmdir /s /q "%FRONTEND_DIR%\node_modules" 2>nul
rmdir /s /q "%FRONTEND_DIR%\.next" 2>nul
del /f /q "%FRONTEND_DIR%\tsconfig.tsbuildinfo" 2>nul
for /d /r "%APP_DIR%" %%d in (__pycache__) do rmdir /s /q "%%d" 2>nul
del /s /q "%APP_DIR%\*.pyc" 2>nul

echo ==^> Removing Whisper model cache for this user
rmdir /s /q "%USERPROFILE%\.cache\whisper" 2>nul
echo ==^> Uninstall complete. Source files were kept.
pause
exit /b 0
