"""
CV API — extract, edit, save, and retrieve user CVs.

Flow:
  1. POST /cv/upload/file  OR  POST /cv/upload/text  →  CVExtractResponse  (NOT saved)
  2. User reviews and edits the extracted fields in the frontend
  3. POST /cv/save  →  CVResponse  (saved to DB)
  4. PUT  /cv/{cv_id}  →  CVResponse  (update saved CV)
  5. GET  /cv/me  →  CVResponse  (current active CV)
"""

import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.db.postgres import get_db
from app.models.cv import UserCV
from app.models.user import User
from app.schemas.cv import (
    CVExtractResponse,
    CVExtractedFields,
    CVResponse,
    CVSaveRequest,
    CVUpdateRequest,
    ContactInfo,
)
from app.services.cv_service import (
    extract_cv_fields,
    get_active_cv,
    process_cv_from_extracted,
)
from app.services.file_parser import parse_cv_file

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cv_to_response(cv: UserCV) -> CVResponse:
    contact = None
    if cv.contact_info:
        try:
            c = json.loads(cv.contact_info)
            contact = ContactInfo(**c)
        except Exception:
            pass

    return CVResponse(
        id=str(cv.id),
        user_id=cv.user_id,
        version=cv.version,
        name=cv.name,
        contact_info=contact,
        summary=cv.summary,
        skills=json.loads(cv.skills or "[]"),
        experience_years=cv.experience_years,
        education=cv.education,
        recent_roles=json.loads(cv.recent_roles or "[]"),
        change_summary=cv.change_summary,
        original_filename=cv.original_filename,
        is_active=cv.is_active,
        created_at=str(cv.created_at),
    )


def _dict_to_extracted(d: dict) -> CVExtractedFields:
    contact = d.get("contact_info")
    return CVExtractedFields(
        name=d.get("name"),
        contact_info=ContactInfo(**contact) if isinstance(contact, dict) else None,
        summary=d.get("summary"),
        skills=d.get("skills") or [],
        experience_years=d.get("experience_years"),
        education=d.get("education"),
        recent_roles=d.get("recent_roles") or [],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload/file", response_model=CVExtractResponse)
async def upload_cv_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a PDF or DOCX CV file.
    Extracts fields with AI but does NOT save to DB yet.
    The frontend shows an edit form; user confirms via POST /cv/save.
    """
    raw_text = await parse_cv_file(file)
    extracted = await extract_cv_fields(raw_text)
    return CVExtractResponse(raw_text=raw_text, extracted=_dict_to_extracted(extracted))


@router.post("/upload/text", response_model=CVExtractResponse)
async def upload_cv_text(
    cv_text: str,
    current_user: User = Depends(get_current_user),
):
    """
    Submit CV as plain text.
    Extracts fields with AI but does NOT save to DB yet.
    """
    if len(cv_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="CV text is too short (minimum 50 characters)")
    extracted = await extract_cv_fields(cv_text)
    return CVExtractResponse(raw_text=cv_text, extracted=_dict_to_extracted(extracted))


@router.post("/save", response_model=CVResponse)
async def save_cv(
    request: CVSaveRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Save a confirmed (and possibly edited) CV to the database.
    Call this after the user reviews the extracted fields from /upload/file or /upload/text.
    """
    cv = await process_cv_from_extracted(
        user_id=current_user.id,
        data=request,
        filename=request.original_filename,
    )
    return _cv_to_response(cv)


@router.put("/{cv_id}", response_model=CVResponse)
async def update_cv(
    cv_id: str,
    request: CVUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update editable fields of an already-saved CV."""
    result = await db.execute(
        select(UserCV).where(UserCV.id == cv_id, UserCV.user_id == current_user.id)
    )
    cv = result.scalar_one_or_none()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")

    if request.name is not None:
        cv.name = request.name
    if request.contact_info is not None:
        cv.contact_info = json.dumps(request.contact_info.model_dump())
    if request.summary is not None:
        cv.summary = request.summary
    if request.skills is not None:
        cv.skills = json.dumps(request.skills)
    if request.experience_years is not None:
        cv.experience_years = request.experience_years
    if request.education is not None:
        cv.education = request.education
    if request.recent_roles is not None:
        cv.recent_roles = json.dumps(request.recent_roles)

    db.add(cv)
    await db.commit()
    await db.refresh(cv)
    return _cv_to_response(cv)


@router.get("/me", response_model=CVResponse)
async def get_my_cv(current_user: User = Depends(get_current_user)):
    """Get the current user's active CV."""
    cv = await get_active_cv(current_user.id)
    if not cv:
        raise HTTPException(status_code=404, detail="No CV found. Please upload your CV first.")
    return _cv_to_response(cv)


@router.get("/versions", response_model=list[CVResponse])
async def get_cv_versions(
    current_user: User = Depends(require_role("interviewee")),
    db: AsyncSession = Depends(get_db),
):
    """Get all CV versions for the current user."""
    result = await db.execute(
        select(UserCV)
        .where(UserCV.user_id == current_user.id)
        .order_by(UserCV.version.desc())
    )
    cvs = result.scalars().all()
    return [_cv_to_response(cv) for cv in cvs]
