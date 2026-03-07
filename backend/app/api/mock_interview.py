from fastapi import APIRouter

from app.agents.orchestrator import interview_graph
from app.schemas.interview import (
    MockInterviewRequest,
    MockInterviewResponse,
    MockInterviewQuestion,
)

router = APIRouter()


@router.post("/start", response_model=MockInterviewResponse)
async def start_mock_interview(request: MockInterviewRequest):
    """
    Start a mock interview session.
    The Simulation Agent generates a targeted question based on:
    - The requested role and difficulty
    - The user's past interview weaknesses (retrieved via RAG)
    """
    state = {
        "messages": [],
        "user_id": request.user_id,
        "intent": "simulation",
        "raw_input": (
            f"Give me a {request.difficulty} difficulty mock interview "
            f"for the {request.target_role} role."
        ),
        "interview_data": None,
        "retrieved_context": [],
        "response": "",
        "collection_id": None,
        "mock_session": {
            "target_role": request.target_role,
            "difficulty": request.difficulty,
        },
    }
    result = await interview_graph.ainvoke(state)

    mock = result.get("mock_session") or {}
    current_q = mock.get("current_question") or {}

    return MockInterviewResponse(
        session_id=mock.get("session_id", ""),
        question=MockInterviewQuestion(
            question=current_q.get("question", ""),
            follow_ups=current_q.get("follow_ups", []),
            focus_area=current_q.get("focus_area"),
            difficulty=current_q.get("difficulty"),
        ),
        message=result["response"],
    )
