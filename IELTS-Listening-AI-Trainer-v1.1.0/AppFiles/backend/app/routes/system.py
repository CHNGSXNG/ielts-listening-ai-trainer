import platform
import os

from fastapi import APIRouter, HTTPException

from app.services.transcription import (
    audio_cache_usage,
    clear_server_audio_cache,
    delete_local_model,
    download_local_model,
    engine_status,
    list_local_models,
    model_file_is_valid,
    select_local_model,
)

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status")
def system_status():
    health = engine_status()
    return {
        "backendVersion": "1.1.0",
        "platform": platform.system(),
        "architecture": platform.machine(),
        "ports": {"backend": int(os.environ.get("BACKEND_PORT", "8000")), "frontend": int(os.environ.get("FRONTEND_PORT", "3001"))},
        "audioCache": audio_cache_usage(),
        "models": list_local_models(),
        "engine": health,
    }


@router.post("/models/{model_name}/download")
def download_model(model_name: str):
    try:
        return download_local_model(model_name)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/models/{model_name}/select")
def select_model(model_name: str):
    try:
        return select_local_model(model_name)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/models/{model_name}/verify")
def verify_model(model_name: str):
    return {"name": model_name, "valid": model_file_is_valid(model_name)}


@router.delete("/models/{model_name}")
def delete_model(model_name: str):
    try:
        return delete_local_model(model_name)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/audio-cache")
def clear_audio_cache():
    return clear_server_audio_cache()
