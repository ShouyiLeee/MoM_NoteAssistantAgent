"""
CV API — upload, process, and retrieve user CVs.
"""

import json

from fastapi import APIRouter, HTTPException

from app.schemas.interview import CVUploadRequest, CVResponse
from app.services.cv_service import get_active_cv, process_cv

router = APIRouter()


def _cv_to_response(cv) -> CVResponse:
    return CVResponse(
        id=str(cv.id),
        user_id=cv.user_id,
        version=cv.version,
        summary=cv.summary,
        skills=json.loads(cv.skills or "[]"),
        experience_years=cv.experience_years,
        education=cv.education,
        recent_roles=json.loads(cv.recent_roles or "[]"),
        change_summary=cv.change_summary,
        is_active=cv.is_active,
        created_at=str(cv.created_at),
    )


@router.post("/upload", response_model=CVResponse)
async def upload_cv(request: CVUploadRequest):
    """
    Upload a CV/resume. The system will:
    1. Extract key info (summary, skills, experience) using LLM
    2. Compare with existing CV to detect if it's a new version
    3. Store a new version only if meaningfully different (deduplication)
    """
    cv = await process_cv(
        user_id=request.user_id,
        raw_text=request.cv_text,
        filename=request.filename,
    )
    return _cv_to_response(cv)


@router.get("/{user_id}", response_model=CVResponse)
async def get_cv(user_id: str):
    """Get the current active CV summary for a user."""
    cv = await get_active_cv(user_id)
    if not cv:
        raise HTTPException(status_code=404, detail="No CV found for this user")
    return _cv_to_response(cv)
