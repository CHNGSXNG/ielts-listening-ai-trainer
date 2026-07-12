# Privacy

IELTS Listening AI Trainer is local-first.

- Audio transcription runs with a local Whisper model.
- No paid AI API is required or called.
- Learning records, answers, scores, and preferences remain in this browser.
- Uploaded and imported audio is cached locally for replay.
- No telemetry or learning analytics are sent externally.

When importing a URL, the backend connects to that user-provided public URL to download the audio. Private and local network addresses are rejected. Retaining the original URL is disabled by default.

Lightweight backups include learning records and preferences but exclude audio blobs. Diagnostic exports exclude transcripts, answers, audio contents, and personal file paths.

Use Settings to clear audio cache, URL/diagnostic history, selected sessions, or all local data.
