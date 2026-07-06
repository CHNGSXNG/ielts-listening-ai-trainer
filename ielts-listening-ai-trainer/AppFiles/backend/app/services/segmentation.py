import re


def split_sentences(transcript: str):
    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", transcript.strip()) if part.strip()]
    return [{"id": f"s{index + 1}", "text": sentence} for index, sentence in enumerate(parts)]


def _word_text(word: dict) -> str:
    return str(word.get("word", "")).strip()


def _is_sentence_end(token: str) -> bool:
    return bool(re.search(r"[.!?。？！]$", token.strip()))


def _flush_word_sentence(sentences: list[dict], words: list[dict]) -> None:
    clean_words = [word for word in words if _word_text(word) and word.get("start") is not None and word.get("end") is not None]
    if not clean_words:
        return
    start = max(0.0, float(clean_words[0]["start"]) - 0.1)
    end = float(clean_words[-1]["end"]) + 0.2
    text = " ".join(_word_text(word) for word in clean_words)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text).strip()
    sentences.append(
        {
            "id": f"s{len(sentences) + 1}",
            "text": text,
            "start": round(start, 3),
            "end": round(end, 3),
            "words": [
                {
                    "text": _word_text(word),
                    "start": round(float(word["start"]), 3),
                    "end": round(float(word["end"]), 3),
                }
                for word in clean_words
            ],
        }
    )


def words_to_sentences(words: list[dict]):
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
        next_start = float(sentences[index + 1]["start"])
        if float(sentence["end"]) >= next_start:
            last_word_end = float(sentence["words"][-1]["end"])
            sentence["end"] = round(max(last_word_end, next_start - 0.02), 3)

    return sentences


def segments_to_sentences(segments: list[dict]):
    aligned_words = []
    for segment in segments:
        for word in segment.get("words") or []:
            if word.get("start") is not None and word.get("end") is not None:
                aligned_words.append(word)
    if aligned_words:
        return words_to_sentences(aligned_words)

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
