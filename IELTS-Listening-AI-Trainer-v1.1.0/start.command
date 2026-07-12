#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IELTS_MENU_CHOICE=2 exec "$ROOT_DIR/Mac/Mac.command"
