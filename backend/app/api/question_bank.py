"""
Question Bank API — generate and manage interview question sets.
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.db.postgres import get_db
from app.models.jd import JobDescription
from app.models.question_set import QuestionSet
from app.models.user import User
from app.agents.question_gen_agent import question_gen_agent_node
from app.agents.state import AgentState

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class GenerateQuestionsRequest(BaseModel):
    jd_id: str
    difficulty: str = "medium"
    count: int = 10


class QuestionSetResponse(BaseModel):
    id: str
    jd_id: str
    owner_user_id: str
    questions: list[dict]
    difficulty: str
    generated_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _qs_to_response(qs: QuestionSet) -> QuestionSetResponse:
    questions = []
    try:
        questions = json.loads(qs.questions)
    except Exception:
        pass
    return QuestionSetResponse(
        id=str(qs.id),
        jd_id=qs.jd_id,
        owner_user_id=qs.owner_user_id,
        questions=questions,
        difficulty=qs.difficulty,
        generated_at=str(qs.generated_at),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=QuestionSetResponse)
async def generate_questions(
    request: GenerateQuestionsRequest,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Generate an interview question bank for a JD using AI."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == request.jd_id,
            JobDescription.owner_user_id == current_user.id,
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")

    state: AgentState = {
        "messages": [],
        "user_id": current_user.id,
        "user_role": "interviewer",
        "intent": "question_gen",
        "raw_input": jd.raw_text,
        "interview_data": None,
        "retrieved_context": [],
        "response": "",
        "collection_id": None,
        "mock_session": {"difficulty": request.difficulty, "count": request.count},
        "jd_text": jd.raw_text,
        "cv_context": None,
        "candidate_ids": [],
        "question_set": None,
        "jd_id": request.jd_id,
    }
    agent_result = await question_gen_agent_node(state)
    question_set_data = agent_result.get("question_set", {})
    questions = question_set_data.get("questions", [])

    qs = QuestionSet(
        jd_id=request.jd_id,
        owner_user_id=current_user.id,
        questions=json.dumps(questions),
        difficulty=request.difficulty,
    )
    db.add(qs)
    await db.commit()
    await db.refresh(qs)
    return _qs_to_response(qs)


@router.get("", response_model=list[QuestionSetResponse])
async def list_question_sets(
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """List all question sets owned by the current interviewer."""
    result = await db.execute(
        select(QuestionSet)
        .where(QuestionSet.owner_user_id == current_user.id)
        .order_by(QuestionSet.generated_at.desc())
    )
    return [_qs_to_response(qs) for qs in result.scalars().all()]


@router.get("/{qs_id}", response_model=QuestionSetResponse)
async def get_question_set(
    qs_id: str,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific question set by ID."""
    result = await db.execute(
        select(QuestionSet).where(
            QuestionSet.id == qs_id,
            QuestionSet.owner_user_id == current_user.id,
        )
    )
    qs = result.scalar_one_or_none()
    if not qs:
        raise HTTPException(status_code=404, detail="Question set not found")
    return _qs_to_response(qs)


@router.delete("/{qs_id}")
async def delete_question_set(
    qs_id: str,
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a question set."""
    result = await db.execute(
        select(QuestionSet).where(
            QuestionSet.id == qs_id,
            QuestionSet.owner_user_id == current_user.id,
        )
    )
    qs = result.scalar_one_or_none()
    if not qs:
        raise HTTPException(status_code=404, detail="Question set not found")
    await db.delete(qs)
    await db.commit()
    return {"message": "Deleted"}
