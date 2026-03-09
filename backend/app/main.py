from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import init_db
from app.db.qdrant_client import init_qdrant
from app.api import interviews, analysis, mock_interview
from app.api import cv as cv_router
from app.api import analytics as analytics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise databases. Shutdown: nothing to clean up."""
    await init_db()
    await init_qdrant()
    yield


app = FastAPI(
    title="Interview Note Agent",
    description=(
        "AI-powered Interview Intelligence System. "
        "Upload interview notes, analyse performance, and practice with mock interviews."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
app.include_router(analysis.router, prefix="/interviews", tags=["Analysis"])
app.include_router(mock_interview.router, prefix="/mock-interview", tags=["Mock Interview"])
app.include_router(cv_router.router, prefix="/cv", tags=["CV"])
app.include_router(analytics_router.router, prefix="/analytics", tags=["Analytics"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "interview-note-agent"}
