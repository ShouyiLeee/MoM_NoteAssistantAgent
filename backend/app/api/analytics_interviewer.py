"""
Interviewer Analytics API — dashboard metrics for Interviewer role.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.db.postgres import get_db
from app.models.jd import JobDescription
from app.models.candidate_score import CandidateJDScore
from app.models.question_set import QuestionSet
from app.models.cv import UserCV
from app.models.user import User

router = APIRouter()


class InterviewerAnalyticsResponse(BaseModel):
    total_jds: int
    active_jds: int
    total_candidates_scored: int
    total_question_sets: int
    avg_fit_score: float | None
    top_jd_title: str | None
    top_jd_id: str | None
    recent_scores: list[dict]


@router.get("/interviewer", response_model=InterviewerAnalyticsResponse)
async def get_interviewer_analytics(
    current_user: User = Depends(require_role("interviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate metrics for the interviewer's dashboard."""
    # JD counts
    jd_result = await db.execute(
        select(func.count(JobDescription.id)).where(
            JobDescription.owner_user_id == current_user.id
        )
    )
    total_jds = jd_result.scalar() or 0

    active_jd_result = await db.execute(
        select(func.count(JobDescription.id)).where(
            JobDescription.owner_user_id == current_user.id,
            JobDescription.is_active == True,
        )
    )
    active_jds = active_jd_result.scalar() or 0

    # Question sets
    qs_result = await db.execute(
        select(func.count(QuestionSet.id)).where(
            QuestionSet.owner_user_id == current_user.id
        )
    )
    total_question_sets = qs_result.scalar() or 0

    # Candidate scores — get scores for JDs owned by this interviewer
    owner_jds_result = await db.execute(
        select(JobDescription.id).where(
            JobDescription.owner_user_id == current_user.id
        )
    )
    owner_jd_ids = [row[0] for row in owner_jds_result.all()]

    avg_fit_score = None
    total_candidates_scored = 0
    top_jd_title = None
    top_jd_id = None
    recent_scores = []

    if owner_jd_ids:
        count_result = await db.execute(
            select(func.count(CandidateJDScore.id)).where(
                CandidateJDScore.jd_id.in_(owner_jd_ids)
            )
        )
        total_candidates_scored = count_result.scalar() or 0

        avg_result = await db.execute(
            select(func.avg(CandidateJDScore.fit_score)).where(
                CandidateJDScore.jd_id.in_(owner_jd_ids)
            )
        )
        avg_raw = avg_result.scalar()
        if avg_raw is not None:
            avg_fit_score = round(float(avg_raw), 3)

        # Top JD by number of candidates scored
        top_jd_count_result = await db.execute(
            select(CandidateJDScore.jd_id, func.count(CandidateJDScore.id).label("cnt"))
            .where(CandidateJDScore.jd_id.in_(owner_jd_ids))
            .group_by(CandidateJDScore.jd_id)
            .order_by(func.count(CandidateJDScore.id).desc())
            .limit(1)
        )
        top_row = top_jd_count_result.first()
        if top_row:
            top_jd_id = top_row[0]
            jd_title_result = await db.execute(
                select(JobDescription.title).where(JobDescription.id == top_jd_id)
            )
            top_jd_title = jd_title_result.scalar()

        # Recent scores
        recent_result = await db.execute(
            select(CandidateJDScore)
            .where(CandidateJDScore.jd_id.in_(owner_jd_ids))
            .order_by(CandidateJDScore.scored_at.desc())
            .limit(5)
        )
        for s in recent_result.scalars().all():
            recent_scores.append({
                "candidate_name": s.candidate_name,
                "jd_id": s.jd_id,
                "fit_score": s.fit_score,
                "scored_at": str(s.scored_at),
            })

    return InterviewerAnalyticsResponse(
        total_jds=total_jds,
        active_jds=active_jds,
        total_candidates_scored=total_candidates_scored,
        total_question_sets=total_question_sets,
        avg_fit_score=avg_fit_score,
        top_jd_title=top_jd_title,
        top_jd_id=top_jd_id,
        recent_scores=recent_scores,
    )
