#!/bin/bash

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WHISPER_CACHE="$HOME/.cache/huggingface/hub/models--Systran--faster-whisper-base"

echo "IELTS Listening AI Trainer Uninstaller"
echo
echo "This will delete the entire app package:"
echo "$PACKAGE_DIR"
echo
echo "This includes:"
echo "- Mac launcher"
echo "- Windows launcher"
echo "- Required Files"
echo "- Private Node.js runtime in Required Files/.runtime"
echo "- Frontend dependencies in Required Files/node_modules"
echo "- Python environment in Required Files/backend/.venv"
echo "- Next.js cache in Required Files/.next"
echo "- Uploaded audio in Required Files/backend/uploads"
echo
echo "Optional related cache:"
echo "$WHISPER_CACHE"
echo
read -p "Type DELETE to permanently remove the app package: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
  echo "Cancelled. Nothing was deleted."
  read -p "Press Enter to close."
  exit 0
fi

read -p "Also delete the downloaded Whisper base model cache if found? Type YES to delete it: " DELETE_MODEL

cd /

if [ "$DELETE_MODEL" = "YES" ] && [ -d "$WHISPER_CACHE" ]; then
  echo "Deleting Whisper model cache..."
  rm -rf "$WHISPER_CACHE"
fi

echo "Deleting app package..."
rm -rf "$PACKAGE_DIR"

echo "Uninstall complete."
echo "You can close this Terminal window."
