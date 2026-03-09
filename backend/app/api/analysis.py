from fastapi import APIRouter

from app.agents.orchestrator import interview_graph
from app.schemas.interview import AnalysisRequest, AnalysisResponse

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_interviews(request: AnalysisRequest):
    """
    Ask a natural language question about your interview performance.
    The Analysis Agent retrieves relevant notes via RAG and generates insights.

    Example questions:
    - "Why do I keep failing coding interviews?"
    - "What is my weakest interview stage?"
    - "Which companies rejected me and why?"
    """
    state = {
        "messages": [],
        "user_id": request.user_id,
        "intent": "analysis",
        "raw_input": request.query,
        "interview_data": None,
        "retrieved_context": [],
        "response": "",
        "collection_id": None,
        "mock_session": None,
        "jd_text": None,
        "cv_context": None,
    }
    result = await interview_graph.ainvoke(state)

    return AnalysisResponse(
        answer=result["response"],
        context_chunks_used=len(result.get("retrieved_context", [])),
    )
