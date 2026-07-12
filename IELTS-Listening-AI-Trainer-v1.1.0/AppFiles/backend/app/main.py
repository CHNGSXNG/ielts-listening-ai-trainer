import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import evaluate, intelligence, system, transcribe, upload
from app.services.transcription import engine_status

app = FastAPI(title="IELTS Listening AI Trainer API")
frontend_port = os.environ.get("FRONTEND_PORT", "3001")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        f"http://localhost:{frontend_port}",
        f"http://127.0.0.1:{frontend_port}",
    ],
    allow_origin_regex=r"^http://(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(transcribe.router)
app.include_router(evaluate.router)
app.include_router(intelligence.router)
app.include_router(system.router)


@app.get("/health")
def health():
    return engine_status()
