#!/bin/bash

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)/Required Files"

cd "$APP_DIR" || exit 1
./start-mac.command
