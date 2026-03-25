from fastapi import APIRouter, Depends, HTTPException

from app.agents.orchestrator import interview_graph
from app.auth.dependencies import get_current_user_optional
from app.models.user import User
from app.schemas.interview import (
    MockInterviewRequest,
    MockInterviewResponse,
    MockInterviewQuestion,
    MockAnswerRequest,
    MockAnswerResponse,
    AnswerEvaluation,
)
from app.services.cv_service import get_cv_context
from app.services.llm import llm

router = APIRouter()

EVAL_SYSTEM = """You are an expert technical interviewer evaluating a candidate's answer.

Given the interview question and the candidate's answer, provide evaluation as JSON:

{
  "score": <integer 1-10>,
  "feedback": "<2-3 sentences of specific, actionable feedback>",
  "strengths": ["<what they did well>"],
  "gaps": ["<what was missing or could be improved>"]
}

Be honest but constructive. Score 8-10 for excellent answers, 5-7 for acceptable, 1-4 for weak answers."""

NEXT_QUESTION_SYSTEM = """You are an expert technical interviewer conducting a mock interview.

Based on the previous question and the candidate's answer (including their weaknesses), generate the NEXT interview question.
The next question should:
- Build on or probe deeper into areas where the candidate showed weakness
- OR test a different skill area if they answered well
- Be appropriate for the target role and difficulty level

Return ONLY valid JSON:
{
  "question": "<the next interview question>",
  "follow_ups": ["<follow-up 1>", "<follow-up 2>"],
  "focus_area": "<skill area being tested>",
  "difficulty": "<easy|medium|hard>"
}"""

FINAL_SUMMARY_SYSTEM = """You are an expert technical interviewer summarizing a completed mock interview session.

Given all the questions, answers, and evaluation scores, write a comprehensive but concise performance summary.

Return ONLY valid JSON:
{
  "overall_score": <float 1-10>,
  "summary": "<2-3 paragraph overall assessment>",
  "key_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "key_areas_to_improve": ["<area 1>", "<area 2>", "<area 3>"],
  "recommendation": "<1 sentence recommendation>"
}"""


@router.post("/start", response_model=MockInterviewResponse)
async def start_mock_interview(
    request: MockInterviewRequest,
    current_user: User | None = Depends(get_current_user_optional),
):
    """Start a mock interview session. Returns the first question."""
    user_id = current_user.id if current_user else request.user_id
    cv_context = await get_cv_context(user_id)

    state = {
        "messages": [],
        "user_id": str(user_id),
        "user_role": "interviewee",
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
        "jd_text": None,
        "cv_context": cv_context,
        "candidate_ids": [],
        "question_set": None,
        "jd_id": None,
    }

    try:
        result = await interview_graph.ainvoke(state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {e}")

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
        message=result.get("response", ""),
        cv_context=cv_context,
    )


@router.post("/answer", response_model=MockAnswerResponse)
async def submit_answer(
    request: MockAnswerRequest,
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Submit an answer to the current question.
    Returns evaluation of the answer + next question (or final summary if complete).
    """
    # ── 1. Evaluate the answer ─────────────────────────────────────────────
    eval_prompt = f"""Role: {request.target_role} ({request.difficulty} difficulty)

Question: {request.question}

Candidate Answer: {request.answer}

Evaluate this answer."""

    try:
        eval_data = await llm.generate_json(prompt=eval_prompt, system=EVAL_SYSTEM)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate answer: {e}")

    evaluation = AnswerEvaluation(
        score=eval_data.get("score", 5),
        feedback=eval_data.get("feedback", ""),
        strengths=eval_data.get("strengths", []),
        gaps=eval_data.get("gaps", []),
    )

    is_complete = request.turn >= request.max_turns
    next_turn = request.turn + 1

    if is_complete:
        # ── 2a. Generate final summary ─────────────────────────────────────
        summary_prompt = f"""Mock Interview Summary
Role: {request.target_role} ({request.difficulty})
Turn {request.turn}/{request.max_turns}

Last Question: {request.question}
Last Answer: {request.answer}
Last Evaluation Score: {evaluation.score}/10

Provide overall performance assessment."""
        try:
            summary_data = await llm.generate_json(prompt=summary_prompt, system=FINAL_SUMMARY_SYSTEM)
            final_summary = (
                f"Overall Score: {summary_data.get('overall_score', evaluation.score)}/10\n\n"
                f"{summary_data.get('summary', '')}\n\n"
                f"Key Strengths: {', '.join(summary_data.get('key_strengths', []))}\n"
                f"Areas to Improve: {', '.join(summary_data.get('key_areas_to_improve', []))}\n\n"
                f"Recommendation: {summary_data.get('recommendation', '')}"
            )
        except Exception:
            final_summary = f"Interview complete! Overall score: {evaluation.score}/10."

        return MockAnswerResponse(
            evaluation=evaluation,
            next_question=None,
            is_complete=True,
            final_summary=final_summary,
            turn=request.turn,
            max_turns=request.max_turns,
        )

    # ── 2b. Generate next question ─────────────────────────────────────────
    next_q_prompt = f"""Role: {request.target_role} ({request.difficulty} difficulty)
Question {request.turn}/{request.max_turns}: {request.question}
Candidate Answer: {request.answer}
Evaluation Score: {evaluation.score}/10
Gaps identified: {', '.join(evaluation.gaps)}

Generate question {next_turn}/{request.max_turns}."""

    try:
        next_q_data = await llm.generate_json(prompt=next_q_prompt, system=NEXT_QUESTION_SYSTEM)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate next question: {e}")

    return MockAnswerResponse(
        evaluation=evaluation,
        next_question=MockInterviewQuestion(
            question=next_q_data.get("question", ""),
            follow_ups=next_q_data.get("follow_ups", []),
            focus_area=next_q_data.get("focus_area"),
            difficulty=next_q_data.get("difficulty"),
        ),
        is_complete=False,
        turn=next_turn,
        max_turns=request.max_turns,
    )
