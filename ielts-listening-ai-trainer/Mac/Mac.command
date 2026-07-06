#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/AppFiles"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
MODEL_NAME="${WHISPER_MODEL:-base}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

install_deps() {
  echo "==> Installing backend dependencies"
  cd "$BACKEND_DIR"
  if [ ! -d ".venv" ]; then
    "$PYTHON_BIN" -m venv .venv
  fi
  source .venv/bin/activate
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt

  echo "==> Installing frontend dependencies"
  cd "$FRONTEND_DIR"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install
  elif command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack pnpm install
  else
    npm install
  fi
}

download_model() {
  if [ ! -d "$BACKEND_DIR/.venv" ]; then
    install_deps
  fi
  cd "$BACKEND_DIR"
  source .venv/bin/activate
  echo "==> Downloading Whisper model: $MODEL_NAME"
  python - <<PY
import os
import whisper
model_name = os.environ.get("WHISPER_MODEL", "$MODEL_NAME")
cache_dir = os.environ.get("WHISPER_CACHE_DIR")
whisper.load_model(model_name, download_root=cache_dir)
print(f"Downloaded and verified Whisper model: {model_name}")
PY
}

start_app() {
  if [ ! -d "$BACKEND_DIR/.venv" ] || [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Dependencies are missing. Choose option 1 first."
    exit 1
  fi

  cleanup() {
    if [ -n "${BACKEND_PID:-}" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
    if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  }
  trap cleanup EXIT INT TERM

  echo "==> Starting backend: http://127.0.0.1:$BACKEND_PORT"
  (
    cd "$BACKEND_DIR"
    source .venv/bin/activate
    uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
  ) &
  BACKEND_PID=$!

  echo "==> Starting frontend: http://127.0.0.1:$FRONTEND_PORT"
  (
    cd "$FRONTEND_DIR"
    if command -v pnpm >/dev/null 2>&1; then
      pnpm exec next dev -p "$FRONTEND_PORT"
    else
      npm run dev -- -p "$FRONTEND_PORT"
    fi
  ) &
  FRONTEND_PID=$!

  sleep 2
  open "http://127.0.0.1:$FRONTEND_PORT" || true
  wait
}

uninstall_all() {
  echo "==> Removing generated app dependencies and build files"
  rm -rf "$BACKEND_DIR/.venv"
  rm -rf "$FRONTEND_DIR/node_modules"
  rm -rf "$FRONTEND_DIR/.next"
  rm -f "$FRONTEND_DIR/tsconfig.tsbuildinfo"
  find "$APP_DIR" -name "__pycache__" -type d -prune -exec rm -rf {} +
  find "$APP_DIR" -name "*.pyc" -delete
  find "$ROOT_DIR" -name ".DS_Store" -delete

  echo "==> Removing Whisper model cache for this user"
  rm -rf "$HOME/.cache/whisper"
  rm -rf "$HOME/Library/Caches/whisper"
  echo "==> Uninstall complete. Source files were kept."
}

echo "IELTS Listening AI Trainer"
echo "1) Install dependencies, download model, and start"
echo "2) Start only"
echo "3) Download/refresh Whisper model only"
echo "4) Uninstall generated files and model cache"
echo "5) Exit"
read -r -p "Choose an option: " choice

case "$choice" in
  1) install_deps; download_model; start_app ;;
  2) start_app ;;
  3) download_model ;;
  4) uninstall_all ;;
  *) exit 0 ;;
esac
