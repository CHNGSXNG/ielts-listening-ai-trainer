from pydantic import BaseModel, HttpUrl
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.transcription import transcribe_bytes, transcribe_url

router = APIRouter(prefix="/upload", tags=["upload"])


class UrlImport(BaseModel):
    url: HttpUrl


@router.post("/file")
async def upload_file(file: UploadFile = File(...)):
    payload = await file.read()
    return {"upload_id": f"{file.filename}:{len(payload)}", "filename": file.filename, "size": len(payload)}


@router.post("/url")
def upload_url(payload: UrlImport):
    try:
        return transcribe_url(str(payload.url))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
