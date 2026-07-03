import re
import os
from pathlib import Path

from app.models import Sentence
from app.sample_data import SAMPLE_TRANSCRIPT


def split_sentences(text: str) -> list[Sentence]:
    chunks = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    sentences: list[Sentence] = []
    cursor = 0.0
    for idx, chunk in enumerate(chunks):
        duration = max(2.5, min(8.0, len(chunk.split()) * 0.42))
        sentences.append(Sentence(id=idx, text=chunk, start=round(cursor, 2), end=round(cursor + duration, 2)))
        cursor += duration + 0.45
    return sentences


def transcribe_audio(path: Path) -> tuple[str, list[Sentence]]:
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path.name}")

    from faster_whisper import WhisperModel

    try:
        model = WhisperModel("base", device="cpu", compute_type="int8")
    except Exception:
        os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
        model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(path), beam_size=5, vad_filter=True)
    transcript_parts: list[str] = []
    sentences: list[Sentence] = []

    for idx, segment in enumerate(segments):
        text = segment.text.strip()
        if not text:
            continue
        transcript_parts.append(text)
        sentences.append(Sentence(id=idx, text=text, start=round(segment.start, 2), end=round(segment.end, 2)))

    transcript = " ".join(transcript_parts).strip()
    if not transcript:
        raise ValueError("Whisper did not detect speech in this audio file.")

    return transcript, sentences or split_sentences(transcript)
