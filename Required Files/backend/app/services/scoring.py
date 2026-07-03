import re

from rapidfuzz import fuzz

from app.models import ClozeBlank


FUNCTION_WORDS = {
    "a",
    "an",
    "the",
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "and",
    "or",
    "but",
    "is",
    "are",
    "was",
    "were",
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", text.lower())).strip()


def estimate_band(score: int) -> float:
    if score >= 92:
        return 8.5
    if score >= 84:
        return 8.0
    if score >= 74:
        return 7.5
    if score >= 64:
        return 7.0
    if score >= 54:
        return 6.5
    return 6.0


def evaluate_shadow(expected: str, typed: str) -> dict:
    expected_words = normalize(expected).split()
    typed_words = normalize(typed).split()
    typed_set = set(typed_words)
    mistakes = []
    total_weight = 0.0
    matched_weight = 0.0

    for word in expected_words:
        weight = 0.45 if word in FUNCTION_WORDS else 1.0
        total_weight += weight
        best = max((fuzz.ratio(word, candidate) for candidate in typed_words), default=0)
        if word in typed_set or best >= 88:
            matched_weight += weight
        else:
            mistakes.append({"expected": word, "typed": "", "type": "missing", "weight": weight})

    order_score = fuzz.token_sort_ratio(normalize(expected), normalize(typed)) / 100
    weighted = matched_weight / total_weight if total_weight else 0
    score = round((weighted * 0.78 + order_score * 0.22) * 100)

    return {
        "score": max(0, min(100, score)),
        "band": estimate_band(score),
        "mistakes": mistakes[:12],
        "correct_answers": expected_words,
        "explanation": "Keyword accuracy is weighted above function words. Minor spelling differences are accepted when similarity is high.",
    }


def evaluate_cloze(blanks: list[ClozeBlank], answers: dict[str, str]) -> dict:
    total_weight = sum(blank.weight for blank in blanks) or 1.0
    earned = 0.0
    mistakes = []
    correct_answers: dict[str, str] = {}

    for blank in blanks:
        typed = answers.get(blank.id, "")
        similarity = fuzz.ratio(normalize(blank.answer), normalize(typed)) / 100
        correct_answers[blank.id] = blank.answer
        if similarity >= 0.86:
            earned += blank.weight
        else:
            mistakes.append(
                {
                    "id": blank.id,
                    "expected": blank.answer,
                    "typed": typed,
                    "type": blank.kind,
                    "weight": blank.weight,
                }
            )

    score = round((earned / total_weight) * 100)
    return {
        "score": score,
        "band": estimate_band(score),
        "mistakes": mistakes,
        "correct_answers": correct_answers,
        "explanation": "Cloze scoring gives the strongest weight to IELTS keywords, numbers, nouns, and collocations.",
    }
