# V1.0 Core Regression Checklist

Run this checklist before publishing a release. Automated checks cover deterministic data and source invariants. Audio timing, browser layout, and user interaction checks must also be completed manually with real audio.

## Automated Checks

### Frontend

```bash
cd AppFiles/frontend
npm run test:core
npm run build
```

Expected:

- sentence-scoped Word Bank tests pass
- token consumption and restoration tests pass
- repeated tokens retain unique IDs
- exactly one `PracticeStatusLights` owner exists
- one shared real `<audio>` element drives playback
- Practice uses a fixed viewport shell and intentional workspace scrolling
- production build succeeds
- transcript reading reuses the canonical session, timeline, and shared audio element
- clip padding is clamped between neighboring sentence boundaries
- status-light score thresholds are covered by deterministic tests
- required release scripts and documents are present

### Backend

```bash
cd AppFiles/backend
source .venv/bin/activate
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Expected:

- sentence boundaries are aligned, valid, and non-overlapping
- repeated segmentation returns identical boundaries
- exact answers score 100
- private URL imports are rejected
- Python compile check succeeds
- invalid and overlapping timing is rejected
- selected model configuration survives process restart
- URL credentials and private-network URLs are rejected

## Runtime API Checks

- [ ] `/health` reports the configured local model and its verified availability.
- [ ] A missing or incomplete model causes a visible transcription failure and no model is downloaded implicitly.
- [ ] A real audio upload returns its actual metadata, transcript, sentences, and word timestamps.
- [ ] `/evaluate` returns a score without exposing an unanswered sentence in the practice UI.
- [ ] A private or local-network audio URL is rejected.

## Audio Controller

- [ ] Real uploaded audio becomes the current session source; no demo audio is substituted.
- [ ] Playing sentence 2 starts at its aligned `start` and stops at its aligned `end`.
- [ ] Replaying one sentence five times produces no cumulative drift.
- [ ] Switching sentence during an infinite loop cancels the old loop immediately.
- [ ] The progress handle follows the real audio continuously.
- [ ] Seeking changes the real audio position, active sentence, and aligned word.
- [ ] Changing from 1.0x to 0.75x changes playback immediately and stays synchronized.

## Shadowing

- [ ] The synchronized transcript uses one unified vertical lyrics viewport, not a permanent left column.
- [ ] Manual scrolling pauses Follow Audio and does not change the current practice sentence or answer.
- [ ] Return to current sentence restores automatic centering on the real audio sentence.

- [ ] An unanswered sentence never shows its correct text.
- [ ] Submit sentence 1, then move next: a new sentence has a clean input.
- [ ] Returning to sentence 1 restores its answer, score, and attempt history.
- [ ] Retry creates a new attempt while preserving earlier attempts.
- [ ] The correct answer appears only after submission or an explicit reveal action.

## Transcript Reading

- [ ] Reading uses the same audio, sentence IDs, word timings, and lyrics viewport as Shadowing.
- [ ] Full playback, seeking, Follow Audio, manual scrolling, starring, and sentence selection remain functional.
- [ ] Switching Reading → Shadowing → Cloze preserves the current sentence and session state.

## Cloze And Word Bank

- [ ] Word Bank tokens use a stable Fisher-Yates order for the current sentence attempt.
- [ ] Navigating away, returning, and reloading preserve token order and filled blanks.
- [ ] Returning a token restores its stored position; changing the token collection rebuilds the complete shuffled order.

- [ ] Cloze blanks render inline in the transcript sentence.
- [ ] Word Bank mode shows one active sentence at a time.
- [ ] The bank contains only active-sentence answer tokens and configured distractors.
- [ ] Selecting a token fills the active blank and consumes that token.
- [ ] Removing a filled token restores it to the bank.
- [ ] Repeated words remain distinct tokens.
- [ ] Navigating away and back restores blank answers, remaining tokens, score, and result state.

## Layout And Status

- [ ] At a MacBook-sized viewport the document body does not scroll on Practice.
- [ ] Only the active `PracticeWorkspace` scrolls vertically.
- [ ] Header, player, settings controls, and action bar stay fixed in the stage.
- [ ] Exactly one status-light group is visible.
- [ ] Playback pulses yellow; answer focus/typing pulses green.
- [ ] Evaluation briefly dims all lights.
- [ ] Scores 85, 55, and 25 display solid green, yellow, and red respectively.

## Persistence, Analysis, And Backup

- [ ] Refresh restores the unfinished session and current sentence.
- [ ] Analysis First, Best, and Latest metrics match stored attempt records.
- [ ] Clicking an error category creates a focused review session from all relevant sentences in one source session.
- [ ] Export backup, clear local records, then import with Replace restores sessions, answers, and scores.
- [ ] Import with Merge preserves unrelated existing sessions.
- [ ] Exported backup does not contain cached audio blobs.

## Release Gate

- [ ] `node_modules`, `.venv`, `.next`, models, audio caches, uploads, backups, and runtime data are absent from the release archive.
- [ ] `setup.command`, `start.command`, `stop.command`, `doctor.command`, `scripts/download-models.command`, and `Mac/Mac.command` are executable.
- [ ] `stop.command` stops project services and preserves an unrelated listener.
- [ ] `doctor.command` reports missing Node, model, dependency, port, storage, and decoding requirements with actions.
- [ ] First-time setup informs the user before downloading the model.
- [ ] Start-only mode never installs packages or downloads a model.
- [ ] README quick-start instructions match the packaged files.
