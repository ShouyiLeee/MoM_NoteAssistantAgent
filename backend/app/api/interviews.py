from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import interview_graph
from app.db.postgres import get_db
from app.models.interview import Interview
from app.schemas.interview import (
    InterviewHistoryResponse,
    InterviewSummary,
    InterviewUploadRequest,
    InterviewUploadResponse,
    ExtractedInterview,
)

router = APIRouter()


@router.post("/upload", response_model=InterviewUploadResponse)
async def upload_interview(request: InterviewUploadRequest):
    """
    Upload raw interview notes.
    The Note Agent extracts structured data and stores it in PostgreSQL + Qdrant.
    """
    state = {
        "messages": [],
        "user_id": request.user_id,
        "intent": "note",  # pre-set; orchestrator will skip classification
        "raw_input": request.raw_notes,
        "interview_data": None,
        "retrieved_context": [],
        "response": "",
        "collection_id": str(request.collection_id) if request.collection_id else None,
        "mock_session": None,
    }
    result = await interview_graph.ainvoke(state)

    interview_data = result.get("interview_data") or {}
    extracted = ExtractedInterview(
        company=interview_data.get("company"),
        role=interview_data.get("role"),
        stage=interview_data.get("stage"),
        result=interview_data.get("result"),
        feedback=interview_data.get("feedback"),
    )

    return InterviewUploadResponse(
        interview_id=interview_data.get("interview_id", ""),
        extracted=extracted,
        message=result["response"],
    )


@router.get("/history", response_model=InterviewHistoryResponse)
async def get_interview_history(user_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve all interview records for a user (most recent first)."""
    result = await db.execute(
        select(Interview)
        .where(Interview.user_id == user_id)
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
