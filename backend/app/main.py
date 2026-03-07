from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import init_db
from app.db.qdrant_client import init_qdrant
from app.api import interviews, analysis, mock_interview


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
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
app.include_router(analysis.router, prefix="/interviews", tags=["Analysis"])
app.include_router(mock_interview.router, prefix="/mock-interview", tags=["Mock Interview"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "interview-note-agent"}
