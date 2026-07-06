## Version 2 Upgrade Notes

IELTS Listening AI Trainer Version 2 focuses on rebuilding the app from a simple UI tool into a timeline-based listening training system.

### Major Improvements

1. Better local transcription model  
Version 2 now uses Whisper `base` as the default model instead of `tiny`, giving better transcription accuracy and a better first-run experience.

2. Word-level audio timing  
The transcription pipeline now generates word-level timestamps where available. Sentences are built from real word boundaries instead of rough time estimates.

3. More accurate sentence playback  
Sentence playback now uses strict `start` and `end` timing. The audio player seeks to the sentence start, plays only that sentence, and stops at the sentence boundary.

4. Unified audio engine  
The progress bar, seeking, playback state, sentence highlighting, and playback speed are now driven by the real audio element state.

5. Playback speed support  
Users can listen at multiple speeds: `0.75x`, `1.0x`, `1.25x`, `1.5x`, and `2.0x`.

6. Session-based answer storage  
Each practice sentence now has its own answer and score. Moving to the next question clears the input for the new question while preserving previous answers and scores.

7. Inline cloze practice  
Cloze questions are generated directly inside the transcript instead of using a separate answer area.

8. Cleaner GitHub release structure  
The project is now organized into three simple folders:

```text
Mac/
Windows/
AppFiles/
```

Mac and Windows each have one command file with a menu for install, model download, start, and uninstall.

9. Smaller initial repository size  
Dependencies, build folders, Python virtual environments, and Whisper model files are excluded from the repository. They are downloaded locally by the user when running the command file.

---

## How It Works

IELTS Listening AI Trainer runs fully on the user's own computer. No paid API is required.

### 1. Audio Upload

The user uploads an audio file or imports an audio URL. The app stores the audio locally in the browser when possible, so the same file can be reused during practice.

### 2. Local Transcription

The backend uses local Whisper to transcribe the audio. By default, Version 2 uses the `base` model for better accuracy.

The model is not included in the GitHub repository. It is downloaded automatically on the user's machine during setup.

### 3. Word-Level Timing

When Whisper returns word-level timestamps, each word receives:

```text
start time
end time
text
```

The app then builds sentence timing from word groups:

```text
sentence start = first word start
sentence end = last word end
```

This makes sentence playback more accurate than simple segment splitting.

### 4. Timeline-Based Practice

Practice mode is built around the audio timeline.

Each sentence has:

```text
sentence text
start time
end time
word timestamps
user answer
score
mistakes
```

The player uses the real audio time to decide which sentence and word should be active.

### 5. Sentence Playback

When the user plays a sentence:

```text
seek to sentence.start
play audio
watch audio.currentTime
pause when currentTime reaches sentence.end
```

This prevents the audio from continuing into the next sentence.

### 6. Progress Bar and Seeking

The progress bar is connected directly to the audio element.

When the audio plays, the bar moves according to:

```text
audio.currentTime
```

When the user drags the bar, the app updates:

```text
audio.currentTime = selected time
```

This keeps the UI and audio perfectly synchronized.

### 7. Scoring

After the user submits an answer, the app compares it with the correct sentence using local scoring logic:

```text
string similarity
keyword matching
Levenshtein distance
```

The backend returns only:

```text
score
mistakes
```

Correct answers are not revealed before submission.

### 8. Session Persistence

Practice data is saved locally in the browser.

Saved data includes:

```text
transcript
sentences
current question index
user answers
scores
mistakes
study time
```

Refreshing the page does not erase the session.

### 9. Local-First Design

The app is designed to run locally:

```text
Frontend: Next.js
Backend: FastAPI
Transcription: local Whisper
Storage: browser local storage / IndexedDB
Scoring: local algorithm
```

This keeps the app private, low-cost, and independent from paid external AI services.
