from pathlib import Path

from pydantic import BaseModel, HttpUrl
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.services.transcription import get_cached_audio_path, transcribe_url

router = APIRouter(prefix="/upload", tags=["upload"])
MAX_AUDIO_BYTES = 500 * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".aac", ".aiff", ".flac", ".ogg"}
ALLOWED_CONTENT_TYPES = {"application/octet-stream", "video/mp4", "audio/mp4"}


class UrlImport(BaseModel):
    url: HttpUrl


@router.post("/file")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or "uploaded audio"
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported audio format")
    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("audio/") and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="The selected file is not recognized as audio")
    payload = await file.read(MAX_AUDIO_BYTES + 1)
    if not payload:
        raise HTTPException(status_code=422, detail="The uploaded audio file is empty")
    if len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio files must be 500 MB or smaller")
    return {"upload_id": f"{file.filename}:{len(payload)}", "filename": file.filename, "size": len(payload)}


@router.post("/url")
def upload_url(payload: UrlImport):
    try:
        return transcribe_url(str(payload.url))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/audio/{audio_id}")
def cached_url_audio(audio_id: str):
    path = get_cached_audio_path(audio_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Cached URL audio was not found")
    return FileResponse(path)
