from pydantic import BaseModel
from fastapi import APIRouter

from app.services.scoring import score_answer

router = APIRouter(tags=["evaluate"])


class EvaluationRequest(BaseModel):
    reference: str
    answer: str


@router.post("/evaluate")
def evaluate(payload: EvaluationRequest):
    return score_answer(payload.reference, payload.answer)
