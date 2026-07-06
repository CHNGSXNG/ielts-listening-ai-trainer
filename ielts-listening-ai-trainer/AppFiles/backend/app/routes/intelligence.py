from pydantic import BaseModel
from fastapi import APIRouter

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


class MistakePayload(BaseModel):
    mistakes: dict[str, int]


@router.post("/recommendation")
def recommendation(payload: MistakePayload):
    if payload.mistakes.get("numbers", 0) > 0:
        return {"recommendation": "Focus on numbers and dates"}
    if not payload.mistakes:
        return {"recommendation": "Complete one practice round to unlock a recommendation"}
    top = sorted(payload.mistakes.items(), key=lambda item: item[1], reverse=True)[0][0]
    return {"recommendation": f"Focus on {top}"}
