from fastapi import APIRouter, Depends, HTTPException

from app.agents.orchestrator import interview_graph
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.interview import AnalysisRequest, AnalysisResponse
from app.services.cv_service import get_cv_context

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_interviews(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Ask a natural language question about your interview performance.
    The Analysis Agent retrieves relevant notes via RAG + PostgreSQL and generates insights.
    CV context is automatically injected if the user has an active CV.
    """
    user_id = str(current_user.id)
    cv_context = await get_cv_context(user_id)

    state = {
        "messages": [],
        "user_id": user_id,
        "user_role": "interviewee",
        "intent": "analysis",
        "raw_input": request.query,
        "interview_data": None,
        "retrieved_context": [],
        "response": "",
        "collection_id": None,
        "mock_session": None,
        "jd_text": None,
        "cv_context": cv_context,
        "candidate_ids": [],
        "question_set": None,
        "jd_id": None,
    }

    try:
        result = await interview_graph.ainvoke(state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    return AnalysisResponse(
        answer=result["response"],
        context_chunks_used=len(result.get("retrieved_context", [])),
    )
