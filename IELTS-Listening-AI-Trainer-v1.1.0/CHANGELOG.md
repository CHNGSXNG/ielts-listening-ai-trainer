# Changelog

## 1.1.0 - 2026-07-12

- Added a persistent English and Simplified Chinese interface language selector.
- Localized navigation, upload, practice, analysis, settings, status, playback, Cloze, and diagnostic controls.
- Language changes apply immediately and are included in local backups.
- Updated the GitHub source package and release documentation.

## 1.0.2 - 2026-07-12

- Repaired overlapping Whisper word timestamps without allowing sentence playback overlap.
- Added safe segment-level timing fallback for unusable word alignment instead of failing transcription.
- Separated keyboard play/pause from sentence-selection autoplay.
- Fixed keyboard navigation rules for completed Cloze and Reading exercises.
- Serialized and coalesced IndexedDB session writes to prevent stale draft restoration.
- Made full-transcript Cloze obey attempt-history preferences and record hint/replay usage.
- Prevented concurrent model downloads and deletion of the active model.
- Improved first-run audio capability detection across MP3, WAV, M4A, AAC, OGG, and FLAC.

## 1.0.1 - 2026-07-12

- Upgraded the frontend to Next.js 16 and React 19.
- Removed all known npm dependency vulnerabilities.
- Hardened reproducible dependency installation and release verification.
- Verified real local transcription, word timestamps, and non-overlapping sentence boundaries.

## 1.0.0 - 2026-07-11

- Added real local audio transcription with word timestamps and sentence boundaries.
- Added one synchronized audio controller with progress, seeking, speed, clipping, and loops.
- Added persistent Shadowing, Inline Cloze, sentence-scoped shuffled Word Bank, and Transcript Reading modes.
- Added real attempt analysis, settings, accessibility, local model management, diagnostics, and versioned backup.
- Added lightweight macOS setup, start, stop, doctor, and model-download commands.
- Rebuilt Practice as a single-scroll, responsive learning workspace.
