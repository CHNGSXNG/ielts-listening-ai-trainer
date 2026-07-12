#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_ROOT="${SCRIPT_DIR:h}"
VERSION="$(cd "${PROJECT_ROOT}" && python3 -c 'import json, pathlib; print(json.loads(pathlib.Path("AppFiles/frontend/package.json").read_text())["version"])' < /dev/null)"
PACKAGE_NAME="IELTS-Listening-AI-Trainer-v${VERSION}"
ARCHIVE_DIR="${PROJECT_ROOT}/release"
ARCHIVE_PATH="${ARCHIVE_DIR}/${PACKAGE_NAME}-source.zip"
STAGING_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf "${STAGING_ROOT}"
}
trap cleanup EXIT

mkdir -p "${ARCHIVE_DIR}" "${STAGING_ROOT}/${PACKAGE_NAME}"

COPYFILE_DISABLE=1 rsync -a \
  --exclude='.git/' \
  --exclude='.runtime/' \
  --exclude='release/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.venv/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='*.tsbuildinfo' \
  --exclude='.DS_Store' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='public/runtime-config*.json' \
  --exclude='cache/' \
  --exclude='uploads/' \
  --exclude='models/' \
  --exclude='backups/' \
  --exclude='exports/' \
  --exclude='session-data/' \
  --exclude='audio-cache/' \
  --exclude='*.log' \
  --exclude='*.zip' \
  --exclude='*.pt' \
  --exclude='*.bin' \
  --exclude='*.onnx' \
  "${PROJECT_ROOT}/" "${STAGING_ROOT}/${PACKAGE_NAME}/"

rm -f "${ARCHIVE_PATH}"
(
  cd "${STAGING_ROOT}"
  COPYFILE_DISABLE=1 zip -qry "${ARCHIVE_PATH}" "${PACKAGE_NAME}"
)

echo "Created ${ARCHIVE_PATH}"
du -h "${ARCHIVE_PATH}"
