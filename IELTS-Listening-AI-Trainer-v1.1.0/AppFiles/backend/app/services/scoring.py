import re


def normalize(value: str, *, case_sensitive: bool = False, strict_punctuation: bool = False, contractions_equivalent: bool = True) -> str:
    normalized = value if case_sensitive else value.lower()
    if contractions_equivalent:
        replacements = {"can't": "cannot", "won't": "will not", "n't": " not", "'re": " are", "'ve": " have", "'ll": " will", "'m": " am"}
        for source, replacement in replacements.items():
            normalized = normalized.replace(source, replacement)
    if not strict_punctuation:
        normalized = re.sub(r"[^\w\s'-]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def levenshtein(a: str, b: str) -> int:
    matrix = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        matrix[i][0] = i
    for j in range(len(b) + 1):
        matrix[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + (0 if a[i - 1] == b[j - 1] else 1),
            )
    return matrix[-1][-1]


def words(value: str, **options) -> list[str]:
    return [word for word in normalize(value, **options).split(" ") if word]


def band_estimate(score: int) -> int:
    if score >= 90:
        return 9
    if score >= 82:
        return 8
    if score >= 74:
        return 7
    if score >= 64:
        return 6
    if score >= 52:
        return 5
    if score >= 40:
        return 4
    if score >= 28:
        return 3
    if score >= 16:
        return 2
    return 1


def score_answer(reference: str, answer: str, options=None):
    options = options or {}
    normalize_options = {
        "case_sensitive": bool(options.get("caseSensitive", False)),
        "strict_punctuation": bool(options.get("strictPunctuation", False)),
        "contractions_equivalent": bool(options.get("contractionsEquivalent", True)),
    }
    clean_reference = normalize(reference, **normalize_options)
    clean_answer = normalize(answer, **normalize_options)
    if not clean_answer:
        return {"score": 0, "mistakes": ["vocabulary"]}

    distance = levenshtein(clean_reference, clean_answer)
    longest = max(len(clean_reference), len(clean_answer), 1)
    similarity = max(0, 1 - distance / longest)

    target_words = [word for word in words(reference, **normalize_options) if len(word) > 3]
    answer_words = set(words(answer, **normalize_options))
    if not options.get("strictPlural", True):
        target_words = [word[:-1] if len(word) > 3 and word.endswith("s") else word for word in target_words]
        answer_words = {word[:-1] if len(word) > 3 and word.endswith("s") else word for word in answer_words}
    matched = len([word for word in target_words if word in answer_words])
    keyword_match = matched / len(target_words) if target_words else similarity
    score = round(max(0, min(100, similarity * 70 + keyword_match * 30)))
    strictness = options.get("strictness", "standard")
    if strictness == "lenient" and options.get("spellingTolerance", True):
        score = min(100, round(score + (100 - score) * 0.18))
    elif strictness == "strict":
        score = round(score * 0.94)

    mistakes = set()
    if re.search(r"\d", reference) and not re.search(r"\d", answer):
        mistakes.add("numbers")
    if score < 84 and similarity > keyword_match:
        mistakes.add("vocabulary")
    if score < 90 and abs(len(words(reference, **normalize_options)) - len(words(answer, **normalize_options))) > 2:
        mistakes.add("grammar")
    if score < 92 and distance > 0:
        mistakes.add("spelling")

    return {"score": score, "mistakes": sorted(mistakes)}
