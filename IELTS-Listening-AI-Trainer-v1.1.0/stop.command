#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
stopped=0

belongs_to_project() {
  local pid="$1" cwd command_line
  command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  cwd="$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | /usr/bin/awk '/^n/{sub(/^n/, ""); print; exit}')"
  [[ "$command_line" == *"$ROOT_DIR"* ]] || [[ "$cwd" == "$ROOT_DIR"* ]]
}

stop_pid_file() {
  local name="$1" pid_file="$2" pid
  [ -f "$pid_file" ] || return 0
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    if belongs_to_project "$pid"; then
      echo "Stopping $name (PID $pid)"
      kill "$pid"
      stopped=1
    else
      echo "Refusing to stop PID $pid: it does not belong to this project."
    fi
  fi
  rm -f "$pid_file"
}

stop_pid_file "backend" "$RUNTIME_DIR/backend.pid"
stop_pid_file "frontend" "$RUNTIME_DIR/frontend.pid"

for port in "${BACKEND_PORT:-8000}" "${FRONTEND_PORT:-3001}"; do
  for pid in $(/usr/sbin/lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
    if belongs_to_project "$pid"; then
      echo "Stopping stale project process on port $port (PID $pid)"
      kill "$pid" 2>/dev/null || true
      stopped=1
    else
      echo "Port $port is used by an unrelated process; leaving it untouched."
    fi
  done
done

if [ "$stopped" -eq 0 ]; then
  echo "No running IELTS Listening AI Trainer processes were found."
else
  echo "IELTS Listening AI Trainer stopped."
fi
