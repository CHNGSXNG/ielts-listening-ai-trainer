# IELTS Listening AI Trainer - Security & Privacy Notes

This document explains what this app does, what it installs, what network access it uses, and why it should not harm your computer when run from this package.

## Short Summary

IELTS Listening AI Trainer is a local study tool for IELTS listening practice.

It runs on your own computer and opens a local website at:

```text
http://localhost:3000
```

The app does not include payment code, tracking code, advertising code, remote-control code, cryptocurrency code, or code that deletes personal files.

## What The App Does

The app lets you:

- Upload an IELTS listening audio file.
- Transcribe the audio using `faster-whisper`.
- Split the transcript into sentence segments.
- Practice sentence shadowing.
- Generate cloze-test blanks.
- Score answers with local fuzzy matching.

## What Runs On Your Computer

The project has two local parts:

1. Frontend

   A Next.js web interface running locally on port `3000`.

2. Backend

   A FastAPI server running locally on port `8000`.

Both run on your computer. The browser page talks to the local backend only.

## What Gets Installed

On first run, the launcher installs normal development/runtime dependencies.

If Node.js/npm is not already installed, the launcher downloads a private Node.js runtime into:

```text
Required Files/.runtime/node
```

This does not install Node.js system-wide.

### Python packages

Installed from `backend/requirements.txt`.

Main packages:

- `fastapi`
- `uvicorn`
- `python-multipart`
- `pydantic`
- `rapidfuzz`
- `faster-whisper`
- `requests`

### Node packages

Installed from `package.json`.

Main packages:

- `next`
- `react`
- `react-dom`
- `framer-motion`
- `lucide-react`
- `tailwindcss`

## Network Access

The app may use the internet for installation and first-time model download.

It may connect to:

- Node.js official downloads, or mirror `https://npmmirror.com/mirrors/node`
- npm package registry, or China mirror `https://registry.npmmirror.com`
- PyPI package registry, or China mirror `https://pypi.tuna.tsinghua.edu.cn/simple`
- Hugging Face model hosting, or mirror `https://hf-mirror.com`

After dependencies and the Whisper model are downloaded, normal audio practice runs locally.

## Audio Privacy

Uploaded audio files are saved locally in:

```text
Required Files/backend/uploads
```

The current version does not send uploaded audio to OpenAI, Google, or any paid cloud transcription API.

Transcription is performed locally by `faster-whisper`.

## Local Ports

The app uses:

```text
Frontend: http://localhost:3000
Backend:  http://127.0.0.1:8000
```

These are local addresses on your own computer.

## What The App Does Not Do

This app does not intentionally:

- Read your personal folders.
- Upload your files to a remote server.
- Delete files outside this project folder.
- Install browser extensions.
- Modify system settings.
- Access camera or microphone.
- Collect passwords.
- Collect payment details.
- Run cryptocurrency mining.
- Run background startup services.
- Keep running after you close the terminal windows.

## Files Created By The App

The app may create:

- `node_modules` for frontend dependencies.
- `.runtime/node` for the private Node.js runtime when system Node.js is unavailable.
- `.next` for Next.js build/cache files.
- `backend/.venv` for Python dependencies.
- `backend/uploads` for uploaded audio files.
- Python cache folders such as `__pycache__`.

These are normal local project files.

## How To Stop The App

macOS:

- Close the Terminal window that was opened by the app launcher.

Windows:

- Close the backend and frontend Command Prompt windows.

## How To Delete The App

Delete the whole project folder that contains:

```text
Mac
Windows
Required Files
```

That removes the app code, local dependencies, uploaded audio files, and local caches inside this package.

Automatic uninstall scripts are also included:

```text
Mac/uninstall-delete-everything.command
Windows/uninstall-delete-everything.bat
```

They ask the user to type `DELETE` before removing the app package.

They can also optionally remove the downloaded Whisper base model cache:

```text
~/.cache/huggingface/hub/models--Systran--faster-whisper-base
```

They do not delete the entire global `pip` or `npm` cache by default because those caches may be shared by other software.

## How To Review The Code

Important source folders:

```text
Required Files/src
Required Files/backend/app
Required Files/start-mac.command
Required Files/start-windows.bat
Mac
Windows
```

The backend API code is mainly in:

```text
Required Files/backend/app/main.py
```

The local transcription code is mainly in:

```text
Required Files/backend/app/services/transcription.py
```

The scoring code is mainly in:

```text
Required Files/backend/app/services/scoring.py
```

The cloze generation code is mainly in:

```text
Required Files/backend/app/services/cloze.py
```

## Trust Statement

Based on the current source code in this package, the app is a local IELTS study tool. It is designed to process user-provided audio locally and display practice exercises in the browser. It does not contain code intended to damage the computer, steal data, hide itself, or run silently in the background.

As with any downloaded software, users should only run it if they trust the person who shared it and are comfortable installing the listed open-source dependencies.
