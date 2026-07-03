from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.models import ClozeRequest, ClozeResponse, EvaluationResponse, ShadowRequest, TranscriptResponse
from app.sample_data import SAMPLE_TRANSCRIPT
from app.services.cloze import generate_cloze
from app.services.scoring import evaluate_cloze, evaluate_shadow
from app.services.transcription import split_sentences, transcribe_audio

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="IELTS Listening AI Trainer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)) -> dict:
    suffix = Path(file.filename or "audio.mp3").suffix or ".mp3"
    audio_id = f"{uuid4().hex}{suffix}"
    target = UPLOAD_DIR / audio_id
    target.write_bytes(await file.read())
    return {"audio_id": audio_id, "filename": file.filename, "url": f"/uploads/{audio_id}"}


@app.post("/transcribe", response_model=TranscriptResponse)
async def transcribe(audio_id: str | None = None) -> TranscriptResponse:
    if audio_id:
        path = UPLOAD_DIR / audio_id
        try:
            transcript, sentences = transcribe_audio(path)
            return TranscriptResponse(audio_id=audio_id, transcript=transcript, sentences=sentences, source="whisper")
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Transcription failed: {exc}") from exc

    transcript, sentences = SAMPLE_TRANSCRIPT, split_sentences(SAMPLE_TRANSCRIPT)
    return TranscriptResponse(
        audio_id="mock-audio",
        transcript=transcript,
        sentences=sentences,
        source="sample",
        warning="No audio_id was provided, so sample IELTS text was used.",
    )


@app.post("/generate-cloze", response_model=ClozeResponse)
async def cloze(payload: dict) -> ClozeResponse:
    transcript = payload.get("transcript") or SAMPLE_TRANSCRIPT
    max_blanks = int(payload.get("max_blanks") or 10)
    return generate_cloze(transcript, max_blanks=max_blanks)


@app.post("/evaluate-shadow", response_model=EvaluationResponse)
async def shadow(payload: ShadowRequest) -> dict:
    return evaluate_shadow(payload.expected, payload.typed)


@app.post("/evaluate-cloze", response_model=EvaluationResponse)
async def cloze_eval(payload: ClozeRequest) -> dict:
    return evaluate_cloze(payload.blanks, payload.answers)
