from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.transcription import transcribe_bytes

router = APIRouter(tags=["transcribe"])


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    payload = await file.read()
    try:
        return transcribe_bytes(payload, file.filename or "uploaded audio")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
