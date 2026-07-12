#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/AppFiles/backend"
FRONTEND_DIR="$ROOT_DIR/AppFiles/frontend"
RUNTIME_DIR="$ROOT_DIR/.runtime"
MODEL_SETTINGS_FILE="${IELTS_SETTINGS_DIR:-$HOME/.config/ielts-listening-ai}/selected-model"
MODEL_NAME="${WHISPER_MODEL:-}"
if [ -z "$MODEL_NAME" ] && [ -f "$MODEL_SETTINGS_FILE" ]; then MODEL_NAME="$(cat "$MODEL_SETTINGS_FILE" 2>/dev/null || true)"; fi
case "$MODEL_NAME" in tiny|base|small|medium) ;; *) MODEL_NAME="base" ;; esac
MODEL_CACHE_DIR="${WHISPER_CACHE_DIR:-$HOME/.cache/whisper}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
failures=0

pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

echo "IELTS Listening AI Trainer Doctor"
echo "Architecture: $(uname -m)"

if command -v python3 >/dev/null 2>&1; then pass "Python $(python3 --version 2>&1)"; else fail "Python 3 is missing. Run setup.command after installing Python 3.10+."; fi

if command -v node >/dev/null 2>&1; then
  pass "Node.js $(node --version)"
elif find "$RUNTIME_DIR" -path '*/bin/node' -type f -perm -111 -print -quit 2>/dev/null | grep -q .; then
  pass "Bundled project Node.js runtime"
else
  fail "Node.js is missing. Run setup.command to install the project-local runtime."
fi

if [ -x "$BACKEND_DIR/.venv/bin/python" ] && "$BACKEND_DIR/.venv/bin/python" -c 'import fastapi, uvicorn, whisper' >/dev/null 2>&1; then pass "Backend dependencies"; else fail "Backend dependencies are incomplete. Run setup.command."; fi
if [ -f "$FRONTEND_DIR/node_modules/next/dist/bin/next" ]; then pass "Frontend dependencies"; else fail "Frontend dependencies are incomplete. Run setup.command."; fi

mkdir -p "$RUNTIME_DIR" 2>/dev/null || true
if [ -w "$RUNTIME_DIR" ]; then pass "Runtime directory is writable"; else fail "Runtime directory is not writable: $RUNTIME_DIR"; fi

if [ -s "$MODEL_CACHE_DIR/$MODEL_NAME.pt" ]; then
  if [ -x "$BACKEND_DIR/.venv/bin/python" ] && (cd "$BACKEND_DIR" && WHISPER_MODEL="$MODEL_NAME" WHISPER_CACHE_DIR="$MODEL_CACHE_DIR" .venv/bin/python -c 'from app.services.transcription import model_file_is_valid; import os; raise SystemExit(0 if model_file_is_valid(os.environ["WHISPER_MODEL"]) else 1)') >/dev/null 2>&1; then
    pass "Whisper model '$MODEL_NAME' is installed and valid"
  else
    fail "Whisper model '$MODEL_NAME' is invalid. Run scripts/download-models.command."
  fi
else
  fail "Whisper model '$MODEL_NAME' is missing. Run scripts/download-models.command."
fi

if [ -x "$BACKEND_DIR/.venv/bin/python" ] && "$BACKEND_DIR/.venv/bin/python" -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())' >/dev/null 2>&1; then pass "Audio decoding support"; else fail "FFmpeg audio decoding support is unavailable. Repair backend dependencies."; fi
if [ -x "$BACKEND_DIR/.venv/bin/python" ]; then pass "Word timestamp alignment engine is available through local Whisper"; else warn "Alignment engine cannot be checked before backend setup."; fi

for item in "backend:$BACKEND_PORT" "frontend:$FRONTEND_PORT"; do
  name="${item%%:*}"; port="${item##*:}"
  if /usr/sbin/lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then warn "Port $port ($name) is already in use; start.command will only replace a process owned by this project."; else pass "Port $port ($name) is available"; fi
done

if /usr/bin/curl -fsS --max-time 3 "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then pass "Running backend health endpoint"; else warn "Backend is not currently running; start.command will launch it."; fi

echo
if [ "$failures" -gt 0 ]; then
  echo "$failures required check(s) failed. Follow the actions above."
  exit 1
fi
echo "All required checks passed."
