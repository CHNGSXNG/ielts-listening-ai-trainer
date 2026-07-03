@echo off
setlocal

set "PACKAGE_DIR=%~dp0.."
for %%I in ("%PACKAGE_DIR%") do set "PACKAGE_DIR=%%~fI"
set "WHISPER_CACHE=%USERPROFILE%\.cache\huggingface\hub\models--Systran--faster-whisper-base"

echo IELTS Listening AI Trainer Uninstaller
echo.
echo This will delete the entire app package:
echo %PACKAGE_DIR%
echo.
echo This includes:
echo - Mac launcher
echo - Windows launcher
echo - Required Files
echo - Private Node.js runtime in Required Files\.runtime
echo - Frontend dependencies in Required Files\node_modules
echo - Python environment in Required Files\backend\.venv
echo - Next.js cache in Required Files\.next
echo - Uploaded audio in Required Files\backend\uploads
echo.
echo Optional related cache:
echo %WHISPER_CACHE%
echo.
set /p CONFIRM=Type DELETE to permanently remove the app package: 

if not "%CONFIRM%"=="DELETE" (
  echo Cancelled. Nothing was deleted.
  pause
  exit /b 0
)

set /p DELETE_MODEL=Also delete the downloaded Whisper base model cache if found? Type YES to delete it: 

if "%DELETE_MODEL%"=="YES" (
  if exist "%WHISPER_CACHE%" (
    echo Deleting Whisper model cache...
    rmdir /s /q "%WHISPER_CACHE%"
  )
)

echo Scheduling app package deletion...
cd /d "%TEMP%"
start "IELTS Trainer Uninstall" cmd /c "timeout /t 2 >nul && rmdir /s /q ""%PACKAGE_DIR%"" && echo Uninstall complete. && pause"
exit /b 0
