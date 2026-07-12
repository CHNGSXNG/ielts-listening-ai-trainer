#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_NAME="${WHISPER_MODEL:-}"

if [ -z "$MODEL_NAME" ]; then
  echo "Supported local transcription models:"
  echo "  1) tiny   - fastest, about 75 MB"
  echo "  2) base   - recommended, about 142 MB"
  echo "  3) small  - higher accuracy, about 466 MB"
  echo "  4) medium - highest supported accuracy, about 1.5 GB"
  read -r -p "Choose a model [2]: " choice
  case "${choice:-2}" in
    1) MODEL_NAME="tiny" ;;
    2) MODEL_NAME="base" ;;
    3) MODEL_NAME="small" ;;
    4) MODEL_NAME="medium" ;;
    *) echo "Invalid model selection."; exit 1 ;;
  esac
fi

case "$MODEL_NAME" in
  tiny|base|small|medium) ;;
  *) echo "Unsupported model: $MODEL_NAME"; exit 1 ;;
esac

echo "Local model download"
echo "Model: $MODEL_NAME"
echo "This download is stored outside the Git repository in your user cache."
read -r -p "Download and verify this model? [y/N] " answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) exit 0 ;;
esac

export WHISPER_MODEL="$MODEL_NAME"
IELTS_MENU_CHOICE=3 exec "$ROOT_DIR/Mac/Mac.command"
