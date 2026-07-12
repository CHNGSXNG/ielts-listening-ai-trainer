#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/AppFiles"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
MODEL_SETTINGS_FILE="${IELTS_SETTINGS_DIR:-$HOME/.config/ielts-listening-ai}/selected-model"
MODEL_NAME="${WHISPER_MODEL:-}"
if [ -z "$MODEL_NAME" ] && [ -f "$MODEL_SETTINGS_FILE" ]; then
  MODEL_NAME="$(cat "$MODEL_SETTINGS_FILE" 2>/dev/null || true)"
fi
case "$MODEL_NAME" in tiny|base|small|medium) ;; *) MODEL_NAME="base" ;; esac
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
APP_HOST="${APP_HOST:-127.0.0.1}"
PUBLIC_HOST="127.0.0.1"
if [ "${LAN_ACCESS:-0}" = "1" ]; then
  APP_HOST="0.0.0.0"
  PUBLIC_HOST="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  if [ -z "$PUBLIC_HOST" ]; then
    echo "A local-network address could not be detected. Connect the Mac to Wi-Fi or use default local-only mode."
    exit 1
  fi
fi
PYTHON_BIN="${PYTHON_BIN:-python3}"
NODE_VERSION="${NODE_VERSION:-22.13.1}"
RUNTIME_DIR="$ROOT_DIR/.runtime"
MODEL_CACHE_DIR="${WHISPER_CACHE_DIR:-$HOME/.cache/whisper}"
MODEL_FILE="$MODEL_CACHE_DIR/$MODEL_NAME.pt"

case "$(uname -m)" in
  arm64) NODE_ARCH="arm64" ;;
  x86_64) NODE_ARCH="x64" ;;
  *) NODE_ARCH="unsupported" ;;
esac

NODE_DIR="$RUNTIME_DIR/node-v$NODE_VERSION-darwin-$NODE_ARCH"
NODE_ARCHIVE="$RUNTIME_DIR/node-v$NODE_VERSION-darwin-$NODE_ARCH.tar.gz.part"
LEGACY_NODE_ARCHIVE="$RUNTIME_DIR/node-v$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
BACKEND_STAMP="$RUNTIME_DIR/backend-requirements.sha256"
FRONTEND_STAMP="$RUNTIME_DIR/frontend-package-lock.sha256"

on_error() {
  local exit_code=$?
  echo
  echo "The operation stopped before completion. Nothing already installed was removed."
  read -r -p "Press Return to close this window..." _ || true
  exit "$exit_code"
}
trap on_error ERR

file_hash() {
  /usr/bin/shasum -a 256 "$1" | /usr/bin/awk '{print $1}'
}

activate_existing_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi

  if [ -x "$NODE_DIR/bin/node" ]; then
    export PATH="$NODE_DIR/bin:$PATH"
    hash -r
    command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1
    return
  fi

  return 1
}

install_node_runtime() {
  if activate_existing_node && command -v npm >/dev/null 2>&1; then
    echo "==> Node.js is already installed ($(node --version))"
    return 0
  fi

  if [ "$NODE_ARCH" = "unsupported" ]; then
    echo "Unsupported Mac CPU architecture: $(uname -m)"
    echo "Install Node.js manually from https://nodejs.org/ and run this file again."
    return 1
  fi

  mkdir -p "$RUNTIME_DIR"
  if [ -f "$LEGACY_NODE_ARCHIVE" ] && [ ! -f "$NODE_ARCHIVE" ]; then
    mv "$LEGACY_NODE_ARCHIVE" "$NODE_ARCHIVE"
  fi

  echo "==> Downloading local Node.js v$NODE_VERSION (one-time, resumable)"
  if [ -s "$NODE_ARCHIVE" ]; then
    if ! /usr/bin/curl --fail --location --continue-at - --retry 2 --retry-delay 2 \
      --connect-timeout 20 --speed-limit 1024 --speed-time 60 "$NODE_URL" -o "$NODE_ARCHIVE"; then
      echo "The download server did not accept resume; restarting this download from zero."
      rm -f "$NODE_ARCHIVE"
    fi
  fi
  if [ ! -s "$NODE_ARCHIVE" ]; then
    if ! /usr/bin/curl --fail --location --retry 5 --retry-all-errors --retry-delay 2 \
      --connect-timeout 20 --speed-limit 1024 --speed-time 60 "$NODE_URL" -o "$NODE_ARCHIVE"; then
      echo "Node.js download was interrupted. Run option 1 later to retry it."
      return 1
    fi
  fi

  if ! /usr/bin/tar -tzf "$NODE_ARCHIVE" >/dev/null 2>&1; then
    echo "The saved Node.js download is incomplete. Restarting this one download."
    rm -f "$NODE_ARCHIVE"
    /usr/bin/curl --fail --location --retry 5 --retry-all-errors --retry-delay 2 \
      --connect-timeout 20 --speed-limit 1024 --speed-time 60 "$NODE_URL" -o "$NODE_ARCHIVE"
    /usr/bin/tar -tzf "$NODE_ARCHIVE" >/dev/null
  fi

  rm -rf "$NODE_DIR"
  /usr/bin/tar -xzf "$NODE_ARCHIVE" -C "$RUNTIME_DIR"
  rm -f "$NODE_ARCHIVE"

  if ! activate_existing_node; then
    echo "Node.js was downloaded but could not be verified."
    return 1
  fi
  echo "==> Node.js installed locally: $(node --version)"
}

require_existing_node() {
  if activate_existing_node; then
    return 0
  fi
  echo "Node.js is not installed for this app."
  echo "Choose option 1 once to finish the initial setup. Option 2 never downloads files."
  return 1
}

require_python() {
  if command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    return 0
  fi
  echo "Python 3 was not found. Install Python 3.10 or 3.11 from https://www.python.org/downloads/macos/."
  open "https://www.python.org/downloads/macos/" || true
  return 1
}

backend_is_ready() {
  [ -x "$BACKEND_DIR/.venv/bin/python" ] && "$BACKEND_DIR/.venv/bin/python" -c \
    "import importlib.util; raise SystemExit(0 if all(importlib.util.find_spec(name) for name in ('fastapi', 'uvicorn', 'whisper')) else 1)" >/dev/null 2>&1
}

frontend_is_ready() {
  [ -f "$FRONTEND_DIR/node_modules/next/dist/bin/next" ] && [ -f "$FRONTEND_DIR/.next/BUILD_ID" ]
}

model_is_ready() {
  if ! backend_is_ready || [ ! -s "$MODEL_FILE" ]; then
    return 1
  fi
  (
    cd "$BACKEND_DIR"
    WHISPER_MODEL="$MODEL_NAME" WHISPER_CACHE_DIR="$MODEL_CACHE_DIR" .venv/bin/python - <<'PY' >/dev/null 2>&1
import os
from app.services.transcription import model_file_is_valid

raise SystemExit(0 if model_file_is_valid(os.environ["WHISPER_MODEL"]) else 1)
PY
  )
}

install_backend_deps() {
  require_python
  mkdir -p "$RUNTIME_DIR"
  local current_hash
  current_hash="$(file_hash "$BACKEND_DIR/requirements.txt")"
  if backend_is_ready && [ -f "$BACKEND_STAMP" ] && [ "$(cat "$BACKEND_STAMP")" = "$current_hash" ]; then
    echo "==> Backend dependencies are already installed"
    return 0
  fi

  echo "==> Installing backend dependencies"
  if [ ! -x "$BACKEND_DIR/.venv/bin/python" ]; then
    rm -rf "$BACKEND_DIR/.venv"
    "$PYTHON_BIN" -m venv "$BACKEND_DIR/.venv"
  fi
  "$BACKEND_DIR/.venv/bin/python" -m pip install --upgrade pip
  "$BACKEND_DIR/.venv/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"
  printf '%s\n' "$current_hash" > "$BACKEND_STAMP"
}

install_frontend_deps() {
  install_node_runtime
  mkdir -p "$RUNTIME_DIR"
  local manifest="$FRONTEND_DIR/package-lock.json"
  local current_hash
  current_hash="$(file_hash "$manifest")"
  if [ -f "$FRONTEND_DIR/node_modules/next/dist/bin/next" ] && [ -f "$FRONTEND_STAMP" ] && [ "$(cat "$FRONTEND_STAMP")" = "$current_hash" ]; then
    echo "==> Frontend dependencies are already installed"
  else
    echo "==> Installing frontend dependencies"
    cd "$FRONTEND_DIR"
    npm ci
    printf '%s\n' "$current_hash" > "$FRONTEND_STAMP"
  fi
  cd "$FRONTEND_DIR"
  echo "==> Building the production frontend"
  node node_modules/next/dist/bin/next build
}

install_deps() {
  install_backend_deps
  install_frontend_deps
}

download_model() {
  if model_is_ready; then
    echo "==> Whisper model '$MODEL_NAME' is already downloaded"
    echo "==> Word-level alignment uses the installed local Whisper timestamp engine; no separate paid service is required."
    echo "==> Model disk usage: $(du -sh "$MODEL_FILE" 2>/dev/null | awk '{print $1}')"
    return 0
  fi
  if ! backend_is_ready; then
    install_backend_deps
  fi
  echo "==> Downloading Whisper model '$MODEL_NAME' (one-time)"
  WHISPER_CACHE_DIR="$MODEL_CACHE_DIR" "$BACKEND_DIR/.venv/bin/python" - <<PY
import os
import whisper

model_name = os.environ.get("WHISPER_MODEL", "$MODEL_NAME")
cache_dir = os.environ["WHISPER_CACHE_DIR"]
whisper.load_model(model_name, download_root=cache_dir)
print(f"Downloaded and verified Whisper model: {model_name}")
PY
  echo "==> Word-level alignment uses the installed local Whisper timestamp engine; no separate paid service is required."
  echo "==> Model disk usage: $(du -sh "$MODEL_FILE" 2>/dev/null | awk '{print $1}')"
}

print_status() {
  echo "Installation status"
  if activate_existing_node; then echo "  Node.js:      Ready"; else echo "  Node.js:      Missing"; fi
  if backend_is_ready; then echo "  Backend:      Ready"; else echo "  Backend:      Missing"; fi
  if frontend_is_ready; then echo "  Frontend:     Ready"; else echo "  Frontend:     Missing"; fi
  if model_is_ready; then echo "  Whisper $MODEL_NAME: Ready"; else echo "  Whisper $MODEL_NAME: Missing"; fi
  echo
}

stop_port() {
  local port="$1"
  local pids
  pids="$(/usr/sbin/lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    local pid command_line process_cwd
    for pid in $pids; do
      command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      process_cwd="$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | /usr/bin/awk '/^n/{sub(/^n/, ""); print; exit}')"
      if [[ "$command_line" == *"$ROOT_DIR"* ]] || [[ "$process_cwd" == "$ROOT_DIR"* ]]; then
        echo "==> Stopping this app's previous process on port $port"
        kill "$pid" 2>/dev/null || true
      else
        echo "Port $port is already used by another application:"
        echo "  $command_line"
        echo "Close that application or set a different BACKEND_PORT / FRONTEND_PORT."
        return 1
      fi
    done
    sleep 1
  fi
}

start_app() {
  if ! backend_is_ready || ! frontend_is_ready; then
    echo "App dependencies are incomplete. Choose option 1 once to finish setup."
    return 1
  fi
  require_existing_node
  if ! model_is_ready; then
    echo "The Whisper model '$MODEL_NAME' is missing."
    echo "Choose option 1 to download it. Option 2 never downloads files."
    return 1
  fi

  stop_port "$BACKEND_PORT"
  stop_port "$FRONTEND_PORT"

  cleanup() {
    if [ -n "${BACKEND_PID:-}" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
    if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
    rm -f "$RUNTIME_DIR/backend.pid" "$RUNTIME_DIR/frontend.pid"
    rm -f "$FRONTEND_DIR/public/runtime-config.json"
  }
  trap cleanup EXIT INT TERM

  echo "==> Starting backend: http://$PUBLIC_HOST:$BACKEND_PORT"
  (
    cd "$BACKEND_DIR"
    exec env BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" WHISPER_MODEL="$MODEL_NAME" .venv/bin/python -m uvicorn app.main:app --host "$APP_HOST" --port "$BACKEND_PORT"
  ) &
  BACKEND_PID=$!
  printf '%s\n' "$BACKEND_PID" > "$RUNTIME_DIR/backend.pid"

  echo "==> Starting frontend: http://$PUBLIC_HOST:$FRONTEND_PORT"
  printf '{"apiBase":"http://%s:%s"}\n' "$PUBLIC_HOST" "$BACKEND_PORT" > "$FRONTEND_DIR/public/runtime-config.json"
  (
    cd "$FRONTEND_DIR"
    exec node node_modules/next/dist/bin/next start -H "$APP_HOST" -p "$FRONTEND_PORT"
  ) &
  FRONTEND_PID=$!
  printf '%s\n' "$FRONTEND_PID" > "$RUNTIME_DIR/frontend.pid"

  sleep 2
  open "http://$PUBLIC_HOST:$FRONTEND_PORT" || true
  if [ "${LAN_ACCESS:-0}" = "1" ]; then echo "iPhone Safari (same Wi-Fi): http://$PUBLIC_HOST:$FRONTEND_PORT"; fi
  echo "Keep this window open while using the app."
  wait
}

uninstall_all() {
  echo "==> Removing generated app dependencies and build files"
  rm -rf "$BACKEND_DIR/.venv"
  rm -rf "$FRONTEND_DIR/node_modules"
  rm -rf "$FRONTEND_DIR/.next"
  rm -rf "$RUNTIME_DIR"
  rm -f "$FRONTEND_DIR/tsconfig.tsbuildinfo"
  find "$APP_DIR" -name "__pycache__" -type d -prune -exec rm -rf {} +
  find "$APP_DIR" -name "*.pyc" -delete
  find "$ROOT_DIR" -name ".DS_Store" -delete
  echo "==> Removing Whisper model cache for this user"
  rm -rf "$MODEL_CACHE_DIR"
  echo "==> Uninstall complete. Source files were kept."
}

echo "IELTS Listening AI Trainer"
echo "============================"
print_status
echo "1) First-time setup or repair missing items, then start"
echo "2) Start only (offline: never downloads or installs)"
echo "3) Download the Whisper model if missing"
echo "4) Show installation status"
echo "5) Uninstall generated files and model cache"
echo "6) Exit"
choice="${IELTS_MENU_CHOICE:-}"
if [ -z "$choice" ]; then
  read -r -p "Choose an option: " choice
else
  echo "Automated menu choice: $choice"
fi

case "$choice" in
  1) install_deps; download_model; start_app ;;
  2) start_app ;;
  3) download_model ;;
  4) print_status; read -r -p "Press Return to close..." _ || true ;;
  5) uninstall_all; read -r -p "Press Return to close..." _ || true ;;
  *) exit 0 ;;
esac
