"""
Database Tools — wraps PostgreSQL operations as registered tools.
"""

from datetime import date

from sqlalchemy import select, update

from app.tools.registry import registry
from app.db.postgres import AsyncSessionLocal
from app.models.interview import Interview
from app.models.cv import UserCV


@registry.register(
    name="save_interview",
    description="Save a structured interview record to PostgreSQL.",
    parameters={
        "user_id": {"type": "str", "required": True},
        "company": {"type": "str", "required": True},
        "role": {"type": "str", "required": True},
        "date": {"type": "date | None", "required": False},
        "stage": {"type": "str | None", "required": False},
        "result": {"type": "str | None", "required": False},
        "feedback": {"type": "str | None", "required": False},
        "raw_notes": {"type": "str | None", "required": False},
        "jd_text": {"type": "str | None", "required": False},
        "collection_id": {"type": "str | None", "required": False},
    },
    category="db",
)
async def save_interview(
    user_id: str,
    company: str,
    role: str,
    date: date | None = None,
    stage: str | None = None,
    result: str | None = None,
    feedback: str | None = None,
    raw_notes: str | None = None,
    jd_text: str | None = None,
    collection_id: str | None = None,
) -> str:
    """Persist an interview record and return its ID."""
    async with AsyncSessionLocal() as session:
        interview = Interview(
            user_id=user_id,
            collection_id=collection_id,
            company=company,
            role=role,
            date=date,
            stage=stage,
            result=result,
            feedback=feedback,
            raw_notes=raw_notes,
            jd_text=jd_text,
        )
        session.add(interview)
        await session.commit()
        await session.refresh(interview)
        return str(interview.id)


@registry.register(
    name="get_interviews",
    description="Retrieve interview records for a user, ordered by most recent.",
    parameters={
        "user_id": {"type": "str", "required": True},
        "limit": {"type": "int", "required": False, "description": "Max records (default 20)"},
    },
    category="db",
)
async def get_interviews(user_id: str, limit: int = 20) -> list[dict]:
    """Fetch recent interviews as dicts."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Interview)
            .where(Interview.user_id == user_id)
            .order_by(Interview.created_at.desc())
            .limit(limit)
        )
        interviews = result.scalars().all()
        return [
            {
                "id": str(iv.id),
                "company": iv.company,
                "role": iv.role,
                "stage": iv.stage,
                "result": iv.result,
                "feedback": iv.feedback,
                "date": str(iv.date) if iv.date else None,
                "raw_notes": iv.raw_notes,
            }
            for iv in interviews
        ]


@registry.register(
    name="get_active_cv",
    description="Get the current active CV for a user.",
    parameters={
        "user_id": {"type": "str", "required": True},
    },
    category="db",
)
async def tool_get_active_cv(user_id: str) -> dict | None:
    """Fetch active CV as dict, or None if not found."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserCV)
            .where(UserCV.user_id == user_id, UserCV.is_active == True)
            .order_by(UserCV.version.desc())
            .limit(1)
        )
        cv = result.scalar_one_or_none()
        if not cv:
            return None
        return {
            "id": str(cv.id),
            "user_id": cv.user_id,
            "version": cv.version,
            "summary": cv.summary,
            "skills": cv.skills,
            "experience_years": cv.experience_years,
            "education": cv.education,
            "recent_roles": cv.recent_roles,
            "raw_text": cv.raw_text,
        }
