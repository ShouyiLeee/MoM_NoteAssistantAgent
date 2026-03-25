"""
Job Description API — CRUD + candidate matching for Interviewer role.
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.db.postgres import get_db
from app.models.jd import JobDescription
from app.models.user import User
from app.models.cv import UserCV
from app.models.candidate_score import CandidateJDScore
from app.agents.cv_review_agent import cv_review_agent_node
from app.agents.state import AgentState

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class JDCreateRequest(BaseModel):
    title: str
    company: str
    experience_level: str | None = None
    skills_required: list[str] | None = None
    raw_text: str


class JDUpdateRequest(BaseModel):
    title: str | None = None
    company: str | None = None
    experience_level: str | None = None
    skills_required: list[str] | None = None
    raw_text: str | None = None
    is_active: bool | None = None


class JDResponse(BaseModel):
    id: str
    owner_user_id: str
    title: str
    company: str
    experience_level: str | None
    skills_required: list[str]
    raw_text: str
    summary: str | None
    created_at: str
    is_active: bool


class MatchCandidatesRequest(BaseModel):
    candidate_user_ids: list[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _jd_to_response(jd: JobDescription) -> JDResponse:
    skills = []
    if jd.skills_required:
        try:
            skills = json.loads(jd.skills_required)
        except Exception:
            skills = [jd.skills_required]
    return JDResponse(
        id=str(jd.id),
        owner_user_id=jd.owner_user_id,
        title=jd.title,
        company=jd.company,
        experience_level=jd.experience_level,
        skills_required=skills,
        raw_text=jd.raw_text,
        summary=jd.summary,
        created_at=str(jd.created_at),
        is_active=jd.is_active,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=JDResponse)
async def create_jd(
    request: JDCreateRequest,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new Job Description."""
    jd = JobDescription(
        owner_user_id=current_user.id,
        title=request.title,
        company=request.company,
        experience_level=request.experience_level,
        skills_required=json.dumps(request.skills_required or []),
        raw_text=request.raw_text,
    )
    db.add(jd)
    await db.commit()
    await db.refresh(jd)
    return _jd_to_response(jd)


@router.get("", response_model=list[JDResponse])
async def list_jds(
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """List all Job Descriptions for the current interviewer."""
    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.owner_user_id == current_user.id)
        .order_by(JobDescription.created_at.desc())
    )
    return [_jd_to_response(jd) for jd in result.scalars().all()]


@router.get("/{jd_id}", response_model=JDResponse)
async def get_jd(
    jd_id: str,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single JD by ID."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.owner_user_id == current_user.id,
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    return _jd_to_response(jd)


@router.put("/{jd_id}", response_model=JDResponse)
async def update_jd(
    jd_id: str,
    request: JDUpdateRequest,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Update a Job Description."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.owner_user_id == current_user.id,
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")

    if request.title is not None:
        jd.title = request.title
    if request.company is not None:
        jd.company = request.company
    if request.experience_level is not None:
        jd.experience_level = request.experience_level
    if request.skills_required is not None:
        jd.skills_required = json.dumps(request.skills_required)
    if request.raw_text is not None:
        jd.raw_text = request.raw_text
    if request.is_active is not None:
        jd.is_active = request.is_active

    db.add(jd)
    await db.commit()
    await db.refresh(jd)
    return _jd_to_response(jd)


@router.delete("/{jd_id}")
async def delete_jd(
    jd_id: str,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a Job Description."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.owner_user_id == current_user.id,
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    await db.delete(jd)
    await db.commit()
    return {"message": "Deleted"}


@router.post("/{jd_id}/match-candidates")
async def match_candidates(
    jd_id: str,
    request: MatchCandidatesRequest,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """
    Score and rank candidates against this JD.
    Runs cv_review_agent internally.
    Returns ranked candidate list with fit scores.
    """
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.owner_user_id == current_user.id,
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")

    if not request.candidate_user_ids:
        raise HTTPException(status_code=400, detail="No candidate IDs provided")

    # Run CV review agent
    state: AgentState = {
        "messages": [],
        "user_id": current_user.id,
        "user_role": "interviewer",
        "intent": "cv_review",
        "raw_input": "",
        "interview_data": None,
        "retrieved_context": [],
        "response": "",
        "collection_id": None,
        "mock_session": None,
        "jd_text": jd.raw_text,
        "cv_context": None,
        "candidate_ids": request.candidate_user_ids,
        "question_set": None,
        "jd_id": jd_id,
    }
    agent_result = await cv_review_agent_node(state)
    ranked = agent_result.get("interview_data", {}).get("ranked_candidates", [])

    # Persist scores to DB
    for candidate in ranked:
        score_record = CandidateJDScore(
            jd_id=jd_id,
            cv_id=candidate.get("cv_id", ""),
            candidate_user_id=candidate.get("cv_id"),
            candidate_name=candidate.get("candidate_name"),
            fit_score=candidate.get("fit_score", 0),
            score_breakdown=json.dumps(candidate.get("score_breakdown", {})),
        )
        db.add(score_record)
    await db.commit()

    return {
        "jd_id": jd_id,
        "ranked_candidates": ranked,
        "total": len(ranked),
    }
