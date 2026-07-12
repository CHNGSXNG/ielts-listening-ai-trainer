# Installation

## macOS

Requirements: macOS on Apple Silicon or Intel, Python 3.9 or newer, and at least 2 GB of free disk space for the recommended setup. Python 3.11 is used by CI and is recommended for a fresh installation.

1. Clone or extract the repository.
2. Double-click `setup.command`.
3. Confirm dependency installation when prompted.
4. Choose a local Whisper model. `base` is recommended for normal use.
5. Setup creates an optimized production build, then starts it. Keep the command window open while the app is running.

Later starts use `start.command`. It never downloads dependencies or models. Use `stop.command` to stop only this project's processes and `doctor.command` to inspect the environment.

To install or switch the local model independently, run `scripts/download-models.command`.

## Manual Development Setup

```bash
cd AppFiles/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm ci
```

Download a model:

```bash
WHISPER_MODEL=base ./scripts/download-models.command
```

## Ports

Defaults:

- Frontend: `127.0.0.1:3001`
- Backend: `127.0.0.1:8000`

Override them before starting:

```bash
BACKEND_PORT=8010 FRONTEND_PORT=3010 ./start.command
```

The app binds to localhost and is not exposed to the local network by default.

## iPhone Safari

Connect the Mac and iPhone to the same trusted Wi-Fi network, then start with:

```bash
LAN_ACCESS=1 ./start.command
```

The command prints the URL to open on iPhone. This mode exposes the local app only to the current network, so use it on a trusted network. After loading the production app and caching a session, the PWA application shell and IndexedDB audio support offline replay; transcription and new URL imports still require the Mac backend.
