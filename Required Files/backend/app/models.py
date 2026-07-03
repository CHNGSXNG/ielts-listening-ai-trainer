from pydantic import BaseModel


class Sentence(BaseModel):
    id: int
    text: str
    start: float | None = None
    end: float | None = None


class TranscriptResponse(BaseModel):
    audio_id: str
    transcript: str
    sentences: list[Sentence]
    source: str = "whisper"
    warning: str | None = None


class ClozeBlank(BaseModel):
    id: str
    answer: str
    weight: float
    kind: str
    position: int


class ClozeResponse(BaseModel):
    cloze_text: str
    blanks: list[ClozeBlank]


class ShadowRequest(BaseModel):
    expected: str
    typed: str


class ClozeRequest(BaseModel):
    blanks: list[ClozeBlank]
    answers: dict[str, str]


class EvaluationResponse(BaseModel):
    score: int
    band: float
    mistakes: list[dict]
    correct_answers: dict[str, str] | list[str]
    explanation: str
