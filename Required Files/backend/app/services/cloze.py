import re

from app.models import ClozeBlank, ClozeResponse

KEYWORDS = {
    "accommodation",
    "advert",
    "brochure",
    "california",
    "cambria",
    "campsite",
    "children",
    "desert",
    "flight",
    "kilometers",
    "newspaper",
    "rental",
    "registration",
    "number",
    "course",
    "session",
    "native",
    "speakers",
    "feedback",
    "reception",
    "notebook",
    "Monday",
    "July",
}

STOPWORDS = {
    "the",
    "and",
    "you",
    "your",
    "from",
    "with",
    "will",
    "before",
    "after",
    "should",
    "bring",
}


def classify_token(token: str) -> tuple[str, float]:
    clean = re.sub(r"[^A-Za-z0-9]", "", token)
    lower = clean.lower()
    if clean.isdigit() or lower in {"fifteenth", "nine", "thirty"}:
        return "number", 1.35
    if clean in KEYWORDS or lower in {word.lower() for word in KEYWORDS}:
        return "keyword", 1.5
    if lower not in STOPWORDS and len(clean) >= 5:
        return "noun", 1.2
    return "function", 0.75


def generate_cloze(transcript: str, max_blanks: int = 10) -> ClozeResponse:
    tokens = transcript.split()
    max_blanks = max(1, min(max_blanks, 120))
    candidates: list[tuple[float, int, str, str, float]] = []
    for idx, token in enumerate(tokens):
        clean = re.sub(r"[^A-Za-z0-9]", "", token)
        if len(clean) < 4:
            continue
        kind, weight = classify_token(clean)
        if kind != "function":
            lower = clean.lower()
            position_bonus = idx / max(1, len(tokens))
            length_bonus = min(len(clean), 14) / 28
            repeat_penalty = 0.18 if any(item[2].lower() == lower for item in candidates[-12:]) else 0
            score = weight + length_bonus + position_bonus * 0.15
            score -= repeat_penalty
            candidates.append((score, idx, clean, kind, weight))

    if len(candidates) <= max_blanks:
        selected = candidates
    else:
        candidates.sort(key=lambda item: item[0], reverse=True)
        top_pool = candidates[: max(max_blanks * 3, max_blanks)]
        top_pool.sort(key=lambda item: item[1])
        stride = len(top_pool) / max_blanks
        selected = []
        used_positions: set[int] = set()
        for blank_idx in range(max_blanks):
            start = int(blank_idx * stride)
            end = max(start + 1, int((blank_idx + 1) * stride))
            bucket = top_pool[start:end]
            best = max(bucket, key=lambda item: item[0])
            if best[1] not in used_positions:
                selected.append(best)
                used_positions.add(best[1])
        if len(selected) < max_blanks:
            for item in top_pool:
                if item[1] not in used_positions:
                    selected.append(item)
                    used_positions.add(item[1])
                if len(selected) == max_blanks:
                    break

    selected.sort(key=lambda item: item[1])
    blanks: list[ClozeBlank] = []
    output_tokens = tokens[:]
    for blank_idx, (_, position, answer, kind, weight) in enumerate(selected, start=1):
        blank_id = f"blank-{blank_idx}"
        punctuation = tokens[position][len(answer):] if tokens[position].startswith(answer) else ""
        output_tokens[position] = f"[[{blank_id}]]{punctuation}"
        blanks.append(ClozeBlank(id=blank_id, answer=answer, weight=weight, kind=kind, position=position))

    return ClozeResponse(cloze_text=" ".join(output_tokens), blanks=blanks)
