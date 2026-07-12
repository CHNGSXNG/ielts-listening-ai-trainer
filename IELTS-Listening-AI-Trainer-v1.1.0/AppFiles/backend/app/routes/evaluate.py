from pydantic import BaseModel
from fastapi import APIRouter
from typing import Optional

from app.services.scoring import score_answer

router = APIRouter(tags=["evaluate"])


class EvaluationRequest(BaseModel):
    reference: str
    answer: str
    options: Optional[dict] = None


@router.post("/evaluate")
def evaluate(payload: EvaluationRequest):
    return score_answer(payload.reference, payload.answer, payload.options)
