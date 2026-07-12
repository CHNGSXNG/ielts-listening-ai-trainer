#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "IELTS Listening AI Trainer setup"
echo "This installs missing local dependencies and downloads the configured Whisper model."
echo "The default base model is large and may take several minutes to download."
read -r -p "Continue with setup? [y/N] " answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) exit 0 ;;
esac

IELTS_MENU_CHOICE=1 exec "$ROOT_DIR/Mac/Mac.command"
