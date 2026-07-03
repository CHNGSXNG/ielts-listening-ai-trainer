# IELTS Listening AI Trainer

A local full-stack IELTS listening practice app with audio transcription, sentence shadowing, cloze tests, and local scoring.

## What This Repository Contains

This GitHub version is intentionally lightweight.

It includes:

- Source code
- Backend API code
- Frontend UI code
- macOS and Windows launch scripts
- Security and privacy documentation

It does **not** include:

- `node_modules`
- `.next`
- `.runtime`
- Python virtual environments
- uploaded audio files
- Whisper model files
- local build caches

Those files are downloaded or generated on the user's computer when the app starts.

## Folder Structure

```text
Mac
Windows
Required Files
中文操作指南_安全与隐私说明.md
```

## Quick Start

### macOS

Open:

```text
Mac/start-mac.command
```

or:

```text
Mac/IELTS Listening AI Trainer.app
```

### Windows

Open:

```text
Windows/start-windows.bat
```

or:

```text
Windows/IELTS Listening AI Trainer.bat
```

The app opens at:

```text
http://localhost:3000
```

## Requirements

Python 3.10+ is recommended.

Node.js is optional. If Node.js/npm is not installed, the launcher downloads a private Node.js runtime into:

```text
Required Files/.runtime/node
```

This does not install Node.js system-wide.

## First Run

The first run may take several minutes because it can download:

- private Node.js runtime
- frontend npm dependencies
- Python backend dependencies
- Whisper model files

The launch scripts try official sources first and then China-friendly mirrors.

## Privacy

Uploaded audio is stored locally in:

```text
Required Files/backend/uploads
```

The app does not use OpenAI API. Transcription runs locally with `faster-whisper`.

Read:

```text
中文操作指南_安全与隐私说明.md
Required Files/SECURITY_AND_PRIVACY.md
```

## Uninstall

Run:

```text
Mac/uninstall-delete-everything.command
```

or:

```text
Windows/uninstall-delete-everything.bat
```

The uninstaller asks for confirmation before deleting files.
