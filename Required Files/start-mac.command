#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "IELTS Listening AI Trainer"
echo "Checking requirements..."

NODE_VERSION="v20.14.0"
RUNTIME_DIR="$PWD/.runtime"
LOCAL_NODE_DIR="$RUNTIME_DIR/node"

download_node() {
  mkdir -p "$RUNTIME_DIR/downloads"
  ARCH="$(uname -m)"
  if [ "$ARCH" = "arm64" ]; then
    NODE_ARCH="darwin-arm64"
  else
    NODE_ARCH="darwin-x64"
  fi

  NODE_FILE="node-$NODE_VERSION-$NODE_ARCH.tar.gz"
  NODE_URL_PRIMARY="https://nodejs.org/dist/$NODE_VERSION/$NODE_FILE"
  NODE_URL_MIRROR="https://npmmirror.com/mirrors/node/$NODE_VERSION/$NODE_FILE"
  NODE_ARCHIVE="$RUNTIME_DIR/downloads/$NODE_FILE"

  echo "Node.js/npm was not found. Downloading a private Node.js runtime for this app..."
  echo "This does not install Node.js system-wide."

  if ! curl -L --connect-timeout 30 --retry 3 --output "$NODE_ARCHIVE" "$NODE_URL_PRIMARY"; then
    echo "Official Node.js download failed. Trying China-friendly mirror..."
    curl -L --connect-timeout 30 --retry 3 --output "$NODE_ARCHIVE" "$NODE_URL_MIRROR"
  fi

  rm -rf "$LOCAL_NODE_DIR"
  mkdir -p "$LOCAL_NODE_DIR"
  tar -xzf "$NODE_ARCHIVE" -C "$LOCAL_NODE_DIR" --strip-components=1
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is not installed. Install it from https://www.python.org/downloads/ and run this file again."
  read -p "Press Enter to close."
  exit 1
fi

if command -v npm >/dev/null 2>&1; then
  echo "Using system Node.js/npm."
elif [ -x "$LOCAL_NODE_DIR/bin/npm" ]; then
  echo "Using private Node.js runtime in Required Files/.runtime."
  export PATH="$LOCAL_NODE_DIR/bin:$PATH"
else
  download_node
  export PATH="$LOCAL_NODE_DIR/bin:$PATH"
fi

node --version
npm --version

echo "Installing backend dependencies..."
if [ ! -d "backend/.venv" ]; then
  python3 -m venv backend/.venv
fi

VENV_PYTHON="$PWD/backend/.venv/bin/python3"
if [ ! -x "$VENV_PYTHON" ] || ! "$VENV_PYTHON" --version >/dev/null 2>&1; then
  echo "Python virtual environment is incomplete. Rebuilding it..."
  rm -rf backend/.venv
  python3 -m venv backend/.venv
  VENV_PYTHON="$PWD/backend/.venv/bin/python3"
fi

"$VENV_PYTHON" -m pip install --upgrade pip --timeout 120 || "$VENV_PYTHON" -m pip install --upgrade pip --timeout 120 -i https://pypi.tuna.tsinghua.edu.cn/simple
"$VENV_PYTHON" -m pip install -r backend/requirements.txt --timeout 120 || "$VENV_PYTHON" -m pip install -r backend/requirements.txt --timeout 120 -i https://pypi.tuna.tsinghua.edu.cn/simple

echo "Installing frontend dependencies..."
if [ ! -d "node_modules" ]; then
  npm install --fetch-timeout=600000 --fetch-retries=5 || npm install --registry=https://registry.npmmirror.com --fetch-timeout=600000 --fetch-retries=5
fi

echo "Starting backend and frontend..."
echo "Open http://localhost:3000 in your browser."

trap 'kill 0' EXIT

(
  cd backend
  export HF_HUB_DOWNLOAD_TIMEOUT=300
  "$VENV_PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &

(
  export PATH="$LOCAL_NODE_DIR/bin:$PATH"
  npm run dev
) &

sleep 3
open "http://localhost:3000" >/dev/null 2>&1 || true
wait
