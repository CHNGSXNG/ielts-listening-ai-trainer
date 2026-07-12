from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.services.transcription import transcribe_bytes

router = APIRouter(tags=["transcribe"])
MAX_AUDIO_BYTES = 500 * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".aac", ".aiff", ".flac", ".ogg"}
ALLOWED_CONTENT_TYPES = {"application/octet-stream", "video/mp4", "audio/mp4"}


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    filename = file.filename or "uploaded audio"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported audio format")
    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("audio/") and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="The selected file is not recognized as audio")
    payload = await file.read(MAX_AUDIO_BYTES + 1)
    if not payload:
        raise HTTPException(status_code=422, detail="The uploaded audio file is empty")
    if len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio files must be 500 MB or smaller")
    try:
        return await run_in_threadpool(transcribe_bytes, payload, filename)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
