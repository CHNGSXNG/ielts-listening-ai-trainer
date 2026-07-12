# Architecture

## Data Flow

```text
Audio file or public URL
  -> FastAPI validation and local Whisper transcription
  -> word timestamps and sentence aggregation
  -> canonical browser PracticeSession
  -> shared AudioController
  -> Shadowing, Inline Cloze, Word Bank, or Reading
  -> sentence attempts and analysis
  -> IndexedDB persistence and versioned backup
```

## Frontend

The Next.js App Router frontend contains Upload, Practise, Analysis, and Settings pages. `PracticeStoreProvider` owns the canonical active session. IndexedDB stores durable sessions and audio blobs; localStorage is used for preferences and a small recovery mirror.

`SentencePlayer` owns the single HTML audio element used by every practice mode. Real `audio.currentTime` drives progress, sentence selection, word highlighting, clip boundaries, seeking, and loops.

## Backend

FastAPI validates local files and public URLs, prevents private-network URL access, runs the selected local Whisper model, and returns transcript, word timestamps, sentence timestamps, and audio metadata. Long-term learning records are not stored by the backend.

## Persistence

- `ielts-listening-trainer`: sessions and current-session metadata
- `ielts-audio-cache`: uploaded/imported audio blobs
- localStorage: user preferences and current-session recovery mirror

Models, dependencies, uploaded audio, caches, and backups are excluded from Git.
