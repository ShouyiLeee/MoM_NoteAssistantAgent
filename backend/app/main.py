from contextlib import asynccontextmanager
import socket

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Force IPv4 ────────────────────────────────────────────────────────────────
# On Windows, Python tries IPv6 first which hangs on some networks.
# This forces all DNS resolution to return only IPv4 addresses.
_original_getaddrinfo = socket.getaddrinfo


def _ipv4_getaddrinfo(*args, **kwargs):
    results = _original_getaddrinfo(*args, **kwargs)
    return [r for r in results if r[0] == socket.AF_INET] or results


socket.getaddrinfo = _ipv4_getaddrinfo

from app.db.postgres import init_db
from app.db.qdrant_client import init_qdrant
from app.api import interviews, analysis, mock_interview, auth as auth_router
from app.api import cv as cv_router
from app.api import analytics as analytics_router
from app.api import jd as jd_router
from app.api import candidates as candidates_router
from app.api import question_bank as question_bank_router
from app.api import analytics_interviewer as analytics_interviewer_router


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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {str(exc)}"}
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router, prefix="/auth", tags=["Auth"])
app.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
app.include_router(analysis.router, prefix="/interviews", tags=["Analysis"])
app.include_router(mock_interview.router, prefix="/mock-interview", tags=["Mock Interview"])
app.include_router(cv_router.router, prefix="/cv", tags=["CV"])
app.include_router(analytics_router.router, prefix="/analytics", tags=["Analytics"])
app.include_router(jd_router.router, prefix="/jd", tags=["Job Descriptions"])
app.include_router(candidates_router.router, prefix="/candidates", tags=["Candidates"])
app.include_router(question_bank_router.router, prefix="/question-bank", tags=["Question Bank"])
app.include_router(analytics_interviewer_router.router, prefix="/analytics", tags=["Analytics"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "interview-note-agent"}
