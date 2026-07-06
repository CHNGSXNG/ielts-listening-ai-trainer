from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import evaluate, intelligence, transcribe, upload

app = FastAPI(title="IELTS Listening AI Trainer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(transcribe.router)
app.include_router(evaluate.router)
app.include_router(intelligence.router)


@app.get("/health")
def health():
    return {"status": "ok"}
