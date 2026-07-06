import re


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s'-]", " ", value.lower())).strip()


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


def words(value: str) -> list[str]:
    return [word for word in normalize(value).split(" ") if word]


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


def score_answer(reference: str, answer: str):
    clean_reference = normalize(reference)
    clean_answer = normalize(answer)
    if not clean_answer:
        return {"score": 0, "mistakes": ["vocabulary"]}

    distance = levenshtein(clean_reference, clean_answer)
    longest = max(len(clean_reference), len(clean_answer), 1)
    similarity = max(0, 1 - distance / longest)

    target_words = [word for word in words(reference) if len(word) > 3]
    answer_words = set(words(answer))
    matched = len([word for word in target_words if word in answer_words])
    keyword_match = matched / len(target_words) if target_words else similarity
    score = round(max(0, min(100, similarity * 70 + keyword_match * 30)))

    mistakes = set()
    if re.search(r"\d", reference) and not re.search(r"\d", answer):
        mistakes.add("numbers")
    if score < 84 and similarity > keyword_match:
        mistakes.add("vocabulary")
    if score < 90 and abs(len(words(reference)) - len(words(answer))) > 2:
        mistakes.add("grammar")
    if score < 92 and distance > 0:
        mistakes.add("spelling")

    return {"score": score, "mistakes": sorted(mistakes)}
