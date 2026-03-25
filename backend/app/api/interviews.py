from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import interview_graph
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.db.postgres import get_db
from app.models.interview import Interview
from app.models.user import User
from app.schemas.interview import (
    InterviewHistoryResponse,
    InterviewSummary,
    InterviewUploadRequest,
    InterviewUploadResponse,
    ExtractedInterview,
)
from app.services.cv_service import get_cv_context
from app.services.file_parser import parse_interview_file

router = APIRouter()


def _build_interview_state(user_id: str, raw_notes: str, jd_text: str | None, cv_context: str | None, collection_id: str | None) -> dict:
    return {
        "messages": [],
        "user_id": user_id,
        "user_role": "interviewee",
        "intent": "note",
        "raw_input": raw_notes,
        "interview_data": None,
        "retrieved_context": [],
        "response": "",
        "collection_id": collection_id,
        "mock_session": None,
        "jd_text": jd_text,
        "cv_context": cv_context,
        "candidate_ids": [],
        "question_set": None,
        "jd_id": None,
    }


def _state_to_response(result: dict) -> InterviewUploadResponse:
    interview_data = result.get("interview_data") or {}
    extracted = ExtractedInterview(
        company=interview_data.get("company"),
        role=interview_data.get("role"),
        date=interview_data.get("date"),
        stage=interview_data.get("stage"),
        result=interview_data.get("result"),
        feedback=interview_data.get("feedback"),
    )
    return InterviewUploadResponse(
        interview_id=interview_data.get("interview_id", ""),
        extracted=extracted,
        message=result["response"],
    )


@router.post("/upload", response_model=InterviewUploadResponse)
async def upload_interview(
    request: InterviewUploadRequest,
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Upload raw interview notes (text).
    Uses JWT user_id if authenticated, falls back to request.user_id for backward compat.
    """
    user_id = current_user.id if current_user else request.user_id
    cv_context = await get_cv_context(user_id)
    state = _build_interview_state(
        user_id=user_id,
        raw_notes=request.raw_notes,
        jd_text=request.jd_text,
        cv_context=cv_context,
        collection_id=str(request.collection_id) if request.collection_id else None,
    )
    result = await interview_graph.ainvoke(state)
    return _state_to_response(result)


@router.post("/upload/file", response_model=InterviewUploadResponse)
async def upload_interview_file(
    file: UploadFile = File(...),
    jd_text: str | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    Upload interview notes as a DOCX or TXT file.
    Requires authentication.
    """
    raw_notes = await parse_interview_file(file)
    cv_context = await get_cv_context(current_user.id)
    state = _build_interview_state(
        user_id=current_user.id,
        raw_notes=raw_notes,
        jd_text=jd_text,
        cv_context=cv_context,
        collection_id=None,
    )
    result = await interview_graph.ainvoke(state)
    return _state_to_response(result)


@router.get("/history", response_model=InterviewHistoryResponse)
async def get_interview_history(
    user_id: str | None = None,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve all interview records (most recent first).
    Uses JWT user_id if authenticated, falls back to query param for backward compat.
    """
    uid = (current_user.id if current_user else None) or user_id
    if not uid:
        raise HTTPException(status_code=400, detail="user_id required")

    result = await db.execute(
        select(Interview)
        .where(Interview.user_id == uid)
        .order_by(Interview.created_at.desc())
    )
    interviews = result.scalars().all()

    return InterviewHistoryResponse(
        interviews=[
            InterviewSummary(
                id=str(iv.id),
                company=iv.company,
                role=iv.role,
                stage=iv.stage,
                result=iv.result,
                feedback=iv.feedback,
                date=str(iv.date) if iv.date else None,
            )
            for iv in interviews
        ],
        total=len(interviews),
    )


@router.get("/{interview_id}", response_model=InterviewSummary)
async def get_interview(
    interview_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single interview by ID."""
    result = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.user_id == current_user.id,
        )
    )
    iv = result.scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    return InterviewSummary(
        id=str(iv.id),
        company=iv.company,
        role=iv.role,
        stage=iv.stage,
        result=iv.result,
        feedback=iv.feedback,
        date=str(iv.date) if iv.date else None,
    )


@router.put("/{interview_id}", response_model=InterviewSummary)
async def update_interview(
    interview_id: str,
    company: str | None = None,
    role: str | None = None,
    stage: str | None = None,
    result_val: str | None = None,
    feedback: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update extracted fields of an interview."""
    res = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.user_id == current_user.id,
        )
    )
    iv = res.scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")

    if company is not None:
        iv.company = company
    if role is not None:
        iv.role = role
    if stage is not None:
        iv.stage = stage
    if result_val is not None:
        iv.result = result_val
    if feedback is not None:
        iv.feedback = feedback

    db.add(iv)
    await db.commit()
    await db.refresh(iv)
    return InterviewSummary(
        id=str(iv.id),
        company=iv.company,
        role=iv.role,
        stage=iv.stage,
        result=iv.result,
        feedback=iv.feedback,
        date=str(iv.date) if iv.date else None,
    )
