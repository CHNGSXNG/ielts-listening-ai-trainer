# IELTS Listening AI Trainer

A full-stack IELTS listening trainer with a macOS-style glass UI, sentence shadowing, cloze tests, scoring, and FastAPI integration.

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`faster-whisper` is optional at runtime. If it is unavailable or no model is loaded, the backend returns a realistic mock IELTS transcript so the whole app remains usable.

## Run the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## One-click start

For non-technical users:

- macOS: open `Mac`, then double-click `IELTS Listening AI Trainer.app`
- Windows: open `Windows`, then double-click `IELTS Listening AI Trainer.bat`

Backup launchers are also included in those same folders:

- macOS: `Mac/start-mac.command`
- Windows: `Windows/start-windows.bat`

See `SHARE_WITH_FRIENDS.md` for packaging and first-run notes.

For a detailed explanation of what the app installs, what network access it uses, and what data stays local, see `SECURITY_AND_PRIVACY.md`.

## API

- `POST /upload-audio`
- `POST /transcribe`
- `POST /generate-cloze`
- `POST /evaluate-shadow`
- `POST /evaluate-cloze`

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` if your backend runs somewhere else.
