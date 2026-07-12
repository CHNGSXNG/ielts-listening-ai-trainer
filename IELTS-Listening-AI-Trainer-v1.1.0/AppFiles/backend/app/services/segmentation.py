import logging
import math
import re
from typing import Optional


logger = logging.getLogger(__name__)


def validate_sentence_timeline(sentences: list[dict], audio_duration: Optional[float] = None) -> None:
    previous_end = 0.0
    for index, sentence in enumerate(sentences):
        start = float(sentence.get("start", float("nan")))
        end = float(sentence.get("end", float("nan")))
        if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end <= start:
            raise ValueError(f"Sentence {index + 1} has invalid timing")
        if audio_duration is not None and end > audio_duration + 0.001:
            raise ValueError(f"Sentence {index + 1} exceeds the audio duration")
        if index and start < previous_end - 0.001:
            raise ValueError(f"Sentence {index + 1} overlaps the previous sentence")
        word_previous_end = start
        for word_index, word in enumerate(sentence.get("words") or []):
            word_start = float(word.get("start", float("nan")))
            word_end = float(word.get("end", float("nan")))
            if not math.isfinite(word_start) or not math.isfinite(word_end) or word_end <= word_start:
                raise ValueError(f"Sentence {index + 1}, word {word_index + 1} has invalid timing")
            if word_start < start - 0.08 or word_end > end + 0.08 or word_start < word_previous_end - 0.08:
                raise ValueError(f"Sentence {index + 1}, word {word_index + 1} is outside its aligned boundary")
            word_previous_end = word_end
        previous_end = end


def split_sentences(transcript: str):
    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", transcript.strip()) if part.strip()]
    return [{"id": f"s{index + 1}", "text": sentence} for index, sentence in enumerate(parts)]


def _word_text(word: dict) -> str:
    return str(word.get("word", "")).strip()


def _is_sentence_end(token: str) -> bool:
    return bool(re.search(r"[.!?。？！]$", token.strip()))


def _normalize_aligned_words(words: list[dict], audio_duration: Optional[float]) -> list[dict]:
    normalized: list[dict] = []
    for raw_word in words:
        if not _word_text(raw_word):
            continue
        try:
            start = float(raw_word["start"])
            end = float(raw_word["end"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Aligned word is missing a usable timestamp") from exc
        if not math.isfinite(start) or not math.isfinite(end):
            raise ValueError("Aligned word has a non-finite timestamp")
        start = max(0.0, start)
        if audio_duration is not None:
            end = min(float(audio_duration), end)
        if end <= start:
            raise ValueError("Aligned word has an empty timestamp range")
        normalized.append({**raw_word, "start": start, "end": end})

    for index in range(1, len(normalized)):
        previous = normalized[index - 1]
        current = normalized[index]
        if float(current["start"]) >= float(previous["end"]):
            continue
        boundary = (float(previous["end"]) + float(current["start"])) / 2
        if boundary <= float(previous["start"]) or boundary >= float(current["end"]):
            raise ValueError("Aligned word overlap cannot be repaired without inventing timing")
        logger.warning("Clamping overlapping aligned words %s and %s", index, index + 1)
        previous["end"] = boundary
        current["start"] = boundary

    return normalized


def _flush_word_sentence(sentences: list[dict], words: list[dict]) -> None:
    clean_words = [word for word in words if _word_text(word) and word.get("start") is not None and word.get("end") is not None]
    if not clean_words:
        return
    start = max(0.0, float(clean_words[0]["start"]) - 0.06)
    end = float(clean_words[-1]["end"]) + 0.08
    text = " ".join(_word_text(word) for word in clean_words)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text).strip()
    sentence_id = f"s{len(sentences) + 1}"
    sentences.append(
        {
            "id": sentence_id,
            "text": text,
            "start": round(start, 3),
            "end": round(end, 3),
            "words": [
                dict(
                    {
                    "id": f"{sentence_id}-w{index + 1}",
                    "text": _word_text(word),
                    "start": round(float(word["start"]), 3),
                    "end": round(float(word["end"]), 3),
                    },
                    **({"confidence": round(float(word["probability"]), 4)} if word.get("probability") is not None else {}),
                )
                for index, word in enumerate(clean_words)
            ],
        }
    )


def words_to_sentences(words: list[dict], audio_duration: Optional[float] = None):
    words = _normalize_aligned_words(words, audio_duration)
    sentences: list[dict] = []
    current: list[dict] = []

    for word in words:
        token = _word_text(word)
        if not token or word.get("start") is None or word.get("end") is None:
            continue
        current.append(word)
        duration = float(current[-1]["end"]) - float(current[0]["start"])
        if _is_sentence_end(token) or duration >= 7.5:
            _flush_word_sentence(sentences, current)
            current = []

    _flush_word_sentence(sentences, current)

    for index, sentence in enumerate(sentences[:-1]):
        next_sentence = sentences[index + 1]
        previous_word_end = float(sentence["words"][-1]["end"])
        next_word_start = float(next_sentence["words"][0]["start"])
        boundary = min(float(sentence["end"]), next_word_start - 0.02)
        if boundary < previous_word_end:
            logger.warning("Overlapping aligned words between %s and %s", sentence["id"], next_sentence["id"])
            boundary = previous_word_end
        sentence["end"] = round(boundary, 3)
        next_sentence["start"] = round(max(float(next_sentence["start"]), boundary), 3)

    for index, sentence in enumerate(sentences):
        sentence["start"] = round(max(0.0, float(sentence["start"])), 3)
        final_word_end = float(sentence["words"][-1]["end"])
        maximum_end = audio_duration if audio_duration is not None else float(sentence["end"])
        sentence["end"] = round(min(max(final_word_end, float(sentence["end"])), maximum_end), 3)
        if index > 0 and float(sentence["start"]) < float(sentences[index - 1]["end"]):
            sentence["start"] = sentences[index - 1]["end"]
        if float(sentence["end"]) <= float(sentence["start"]):
            logger.warning("Repairing invalid boundary for %s", sentence["id"])
            sentence["end"] = round(min(maximum_end, float(sentence["start"]) + 0.04), 3)

    return sentences


def segments_to_sentences(segments: list[dict], audio_duration: Optional[float] = None):
    aligned_words: list[dict] = []
    for segment in segments:
        for word in segment.get("words") or []:
            aligned_words.append(word)
    if aligned_words:
        try:
            return words_to_sentences(aligned_words, audio_duration)
        except ValueError as exc:
            logger.warning("Word alignment was unusable; preserving segment-level timing instead: %s", exc)

    sentences = []
    current_text: list[str] = []
    current_start: float | None = None
    current_end = 0.0

    def flush():
        if current_start is None or not current_text:
            return
        text = " ".join(current_text).replace("  ", " ").strip()
        if text:
            sentences.append(
                {
                    "id": f"s{len(sentences) + 1}",
                    "text": text,
                    "start": round(current_start, 3),
                    "end": round(current_end, 3),
                }
            )

    for segment in segments:
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        start = float(segment.get("start", 0))
        end = float(segment.get("end", start))
        if current_start is None:
            current_start = start
        current_text.append(text)
        current_end = end

        duration = current_end - current_start
        ends_cleanly = bool(re.search(r"[.!?。？！]$", text))
        long_enough = duration >= 2.4
        too_long = duration >= 7.5
        next_pause = float(segment.get("avg_logprob", 0)) < -0.75
        if too_long or (ends_cleanly and long_enough) or (duration >= 4.0 and next_pause):
            flush()
            current_text = []
            current_start = None
            current_end = 0.0

    flush()
    return sentences
