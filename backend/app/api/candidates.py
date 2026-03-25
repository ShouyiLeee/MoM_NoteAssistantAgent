"""
Candidates API — Candidate CV Repository for Interviewer/Company role.
Import, filter, sort, and manage candidate CVs.
"""

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.db.postgres import get_db
from app.models.cv import UserCV
from app.models.candidate_score import CandidateJDScore
from app.models.user import User
from app.services.llm import llm

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class CandidateProfile(BaseModel):
    candidate_id: str
    name: str | None = None
    role: str | None = None
    summary: str | None = None
    cv_summary: str | None = None
    skills: list[str] = []
    experience_years: int | None = None
    education: str | None = None
    recent_roles: list[str] = []
    potential_level: str | None = None
    status: str | None = "applied"
    notes: str | None = None
    created_at: str | None = None


class CandidateImportPreview(BaseModel):
    name: str = ""
    role: str = ""
    skills: list[str] = []
    experience_years: int | None = None
    education: str = ""
    cv_summary: str = ""
    potential_level: str = "Medium"
    raw_text: str = ""


class CandidateCreateRequest(BaseModel):
    name: str = ""
    role: str = ""
    skills: list[str] = []
    experience_years: int | None = None
    education: str = ""
    cv_summary: str = ""
    potential_level: str = "Medium"
    raw_text: str = ""


class CandidateUpdateRequest(BaseModel):
    status: str | None = None
    notes: str | None = None
    potential_level: str | None = None


class AnalyzeRequest(BaseModel):
    query: str


class AnalyzeResponse(BaseModel):
    answer: str
    matched_candidates: list[dict] = []
    reasoning: str = ""


# ── In-memory candidate store (will be replaced with DB model) ────────────────
# Using a simple list until the Candidate model/migration is in place.
_candidate_store: list[dict] = []


def _find_candidate(candidate_id: str) -> dict | None:
    for c in _candidate_store:
        if c["candidate_id"] == candidate_id:
            return c
    return None


# ── Import endpoints ──────────────────────────────────────────────────────────

@router.post("/import/file", response_model=CandidateImportPreview)
async def import_candidate_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("interviewer")),
):
    """Upload candidate CV file (PDF/DOCX), extract fields + assess potential."""
    from app.services.file_parser import parse_cv_file

    content = await file.read()
    filename = file.filename or "upload"
    raw_text = parse_cv_file(content, filename)
    if not raw_text.strip():
        raise HTTPException(400, "Could not extract text from file")

    # LLM extraction
    extract_prompt = f"""Extract the following fields from this CV text. Return valid JSON only.
Fields: name, role (current or target role), skills (array), experience_years (integer), education, cv_summary (2-3 sentences).
Also assess potential_level as "High", "Medium", or "Low" based on skills depth, experience, education quality, and career progression.

CV text:
{raw_text[:4000]}

Return JSON:"""
    try:
        result_text = await llm.generate(extract_prompt)
        # Parse JSON from LLM response
        json_start = result_text.find("{")
        json_end = result_text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(result_text[json_start:json_end])
        else:
            data = {}
    except Exception:
        data = {}

    return CandidateImportPreview(
        name=data.get("name", ""),
        role=data.get("role", ""),
        skills=data.get("skills", []) if isinstance(data.get("skills"), list) else [],
        experience_years=data.get("experience_years"),
        education=data.get("education", ""),
        cv_summary=data.get("cv_summary", ""),
        potential_level=data.get("potential_level", "Medium"),
        raw_text=raw_text[:8000],
    )


@router.post("/import/text", response_model=CandidateImportPreview)
async def import_candidate_text(
    cv_text: str = Query(..., description="Raw CV text"),
    current_user: User = Depends(require_role("interviewer")),
):
    """Import candidate from plain text CV."""
    extract_prompt = f"""Extract the following fields from this CV text. Return valid JSON only.
Fields: name, role, skills (array), experience_years (integer), education, cv_summary (2-3 sentences).
Also assess potential_level as "High", "Medium", or "Low".

CV text:
{cv_text[:4000]}

Return JSON:"""
    try:
        result_text = await llm.generate(extract_prompt)
        json_start = result_text.find("{")
        json_end = result_text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(result_text[json_start:json_end])
        else:
            data = {}
    except Exception:
        data = {}

    return CandidateImportPreview(
        name=data.get("name", ""),
        role=data.get("role", ""),
        skills=data.get("skills", []) if isinstance(data.get("skills"), list) else [],
        experience_years=data.get("experience_years"),
        education=data.get("education", ""),
        cv_summary=data.get("cv_summary", ""),
        potential_level=data.get("potential_level", "Medium"),
        raw_text=cv_text[:8000],
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("", response_model=CandidateProfile)
async def create_candidate(
    body: CandidateCreateRequest,
    current_user: User = Depends(require_role("interviewer")),
):
    """Save a confirmed candidate (after import preview)."""
    from datetime import datetime
    candidate_id = str(uuid.uuid4())
    record = {
        "candidate_id": candidate_id,
        "interviewer_user_id": str(current_user.id),
        "name": body.name,
        "role": body.role,
        "skills": body.skills,
        "experience_years": body.experience_years,
        "education": body.education,
        "cv_summary": body.cv_summary,
        "potential_level": body.potential_level,
        "raw_text": body.raw_text,
        "status": "applied",
        "notes": "",
        "created_at": datetime.utcnow().isoformat(),
    }
    _candidate_store.append(record)
    return CandidateProfile(
        candidate_id=candidate_id,
        name=body.name,
        role=body.role,
        cv_summary=body.cv_summary,
        skills=body.skills,
        experience_years=body.experience_years,
        education=body.education,
        potential_level=body.potential_level,
        status="applied",
        created_at=record["created_at"],
    )


@router.get("", response_model=list[CandidateProfile])
async def list_candidates(
    search: str | None = Query(None),
    skills: str | None = Query(None, description="Comma-separated skills"),
    min_experience: int | None = Query(None),
    max_experience: int | None = Query(None),
    potential_level: str | None = Query(None, description="Comma-separated: High,Medium,Low"),
    status: str | None = Query(None),
    sort: str = Query("potential_level", description="Sort by: potential_level, experience_years, created_at"),
    order: str = Query("desc"),
    current_user: User = Depends(require_role("interviewer")),
):
    """List candidates with filters and sorting."""
    user_id = str(current_user.id)
    results = [c for c in _candidate_store if c.get("interviewer_user_id") == user_id]

    # Also include legacy candidates from user_cvs for backward compat
    # (This will be removed once migration to candidates table is complete)

    # Filters
    if search:
        q = search.lower()
        results = [c for c in results if q in (c.get("name") or "").lower() or q in (c.get("role") or "").lower()]
    if skills:
        required = [s.strip().lower() for s in skills.split(",")]
        results = [c for c in results if any(
            req in " ".join(s.lower() for s in c.get("skills", []))
            for req in required
        )]
    if min_experience is not None:
        results = [c for c in results if (c.get("experience_years") or 0) >= min_experience]
    if max_experience is not None:
        results = [c for c in results if (c.get("experience_years") or 0) <= max_experience]
    if potential_level:
        levels = [l.strip() for l in potential_level.split(",")]
        results = [c for c in results if c.get("potential_level") in levels]
    if status:
        results = [c for c in results if c.get("status") == status]

    # Sort
    POTENTIAL_ORDER = {"High": 3, "Medium": 2, "Low": 1}
    if sort == "potential_level":
        results.sort(key=lambda c: POTENTIAL_ORDER.get(c.get("potential_level", ""), 0), reverse=(order == "desc"))
    elif sort == "experience_years":
        results.sort(key=lambda c: c.get("experience_years") or 0, reverse=(order == "desc"))
    elif sort == "created_at":
        results.sort(key=lambda c: c.get("created_at", ""), reverse=(order == "desc"))

    return [
        CandidateProfile(
            candidate_id=c["candidate_id"],
            name=c.get("name"),
            role=c.get("role"),
            cv_summary=c.get("cv_summary"),
            skills=c.get("skills", []),
            experience_years=c.get("experience_years"),
            education=c.get("education"),
            potential_level=c.get("potential_level"),
            status=c.get("status"),
            created_at=c.get("created_at"),
        )
        for c in results
    ]


@router.get("/{candidate_id}", response_model=CandidateProfile)
async def get_candidate(
    candidate_id: str,
    current_user: User = Depends(require_role("interviewer")),
):
    """Get full candidate detail."""
    c = _find_candidate(candidate_id)
    if not c:
        raise HTTPException(404, "Candidate not found")
    return CandidateProfile(
        candidate_id=c["candidate_id"],
        name=c.get("name"),
        role=c.get("role"),
        cv_summary=c.get("cv_summary"),
        summary=c.get("cv_summary"),
        skills=c.get("skills", []),
        experience_years=c.get("experience_years"),
        education=c.get("education"),
        recent_roles=c.get("recent_roles", []),
        potential_level=c.get("potential_level"),
        status=c.get("status"),
        notes=c.get("notes"),
        created_at=c.get("created_at"),
    )


@router.put("/{candidate_id}", response_model=CandidateProfile)
async def update_candidate(
    candidate_id: str,
    body: CandidateUpdateRequest,
    current_user: User = Depends(require_role("interviewer")),
):
    """Update candidate status, notes, or potential_level."""
    c = _find_candidate(candidate_id)
    if not c:
        raise HTTPException(404, "Candidate not found")
    if body.status is not None:
        c["status"] = body.status
    if body.notes is not None:
        c["notes"] = body.notes
    if body.potential_level is not None:
        c["potential_level"] = body.potential_level
    return CandidateProfile(
        candidate_id=c["candidate_id"],
        name=c.get("name"),
        role=c.get("role"),
        cv_summary=c.get("cv_summary"),
        skills=c.get("skills", []),
        experience_years=c.get("experience_years"),
        education=c.get("education"),
        potential_level=c.get("potential_level"),
        status=c.get("status"),
        notes=c.get("notes"),
        created_at=c.get("created_at"),
    )


@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    current_user: User = Depends(require_role("interviewer")),
):
    """Delete a candidate record."""
    global _candidate_store
    before = len(_candidate_store)
    _candidate_store = [c for c in _candidate_store if c["candidate_id"] != candidate_id]
    if len(_candidate_store) == before:
        raise HTTPException(404, "Candidate not found")
    return {"detail": "Deleted"}


# ── AI Candidate Intelligence ─────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_candidates(
    body: AnalyzeRequest,
    current_user: User = Depends(require_role("interviewer")),
):
    """AI Candidate Intelligence — natural language queries about the candidate pool."""
    user_id = str(current_user.id)
    my_candidates = [c for c in _candidate_store if c.get("interviewer_user_id") == user_id]

    if not my_candidates:
        return AnalyzeResponse(
            answer="You don't have any candidates imported yet. Import some CVs first to use AI Candidate Intelligence.",
            matched_candidates=[],
            reasoning="No candidates in pool",
        )

    # Build context from candidate data
    candidate_context = ""
    for c in my_candidates:
        candidate_context += f"""
- Name: {c.get('name', 'Unknown')}
  Role: {c.get('role', 'N/A')}
  Experience: {c.get('experience_years', 'N/A')} years
  Skills: {', '.join(c.get('skills', []))}
  Potential: {c.get('potential_level', 'N/A')}
  Status: {c.get('status', 'N/A')}
  Summary: {(c.get('cv_summary') or '')[:200]}
"""

    prompt = f"""You are an AI recruitment assistant. Based on the candidate data below, answer the user's query.
Return your response as JSON with fields: answer (string), matched_candidates (array of {{candidate_id, name, experience_years, potential_level}}), reasoning (string).

Candidate pool:
{candidate_context}

User query: {body.query}

Return JSON:"""

    try:
        result_text = await llm.generate(prompt)
        json_start = result_text.find("{")
        json_end = result_text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(result_text[json_start:json_end])
            return AnalyzeResponse(
                answer=data.get("answer", result_text),
                matched_candidates=data.get("matched_candidates", []),
                reasoning=data.get("reasoning", ""),
            )
    except Exception:
        pass

    return AnalyzeResponse(
        answer="I couldn't process your query. Please try rephrasing.",
        matched_candidates=[],
        reasoning="LLM parsing failed",
    )
