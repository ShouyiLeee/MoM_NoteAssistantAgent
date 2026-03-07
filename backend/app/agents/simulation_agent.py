"""
Simulation Agent — generates mock interview sessions tailored to the user.

Uses the user's past interview weaknesses (retrieved via RAG) to generate
targeted questions with adaptive follow-ups.

Output format (JSON):
{
  "question":   "<main interview question>",
  "follow_ups": ["...", "...", "..."],
  "focus_area": "<topic being tested>",
  "difficulty": "easy|medium|hard"
}
"""

import uuid

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.services.llm import llm
from app.services.rag import retrieve_context, build_context_block

SIMULATION_SYSTEM = """You are an expert technical interviewer with 10+ years of experience at top tech companies.

Generate a realistic mock interview question based on:
- The target role and difficulty level
- The candidate's known weaknesses (from their interview history)

The question should challenge the candidate's weak areas while being appropriate for the role.

Respond ONLY with valid JSON in this exact format:
{
  "question":   "<main interview question>",
  "follow_ups": ["<follow-up 1>", "<follow-up 2>", "<follow-up 3>"],
  "focus_area": "<the skill or topic being tested>",
  "difficulty": "<easy|medium|hard>"
}"""


async def simulation_agent_node(state: AgentState) -> dict:
    raw_input = state["raw_input"]
    user_id = state["user_id"]
    mock_session = state.get("mock_session") or {}

    target_role = mock_session.get("target_role", "Software Engineer")
    difficulty = mock_session.get("difficulty", "medium")

    # ── 1. Retrieve user's weakness patterns via RAG ──────────────────────────
    weakness_query = "common failures, weaknesses, and negative feedback in interviews"
    weakness_chunks = await retrieve_context(weakness_query, user_id, top_k=3)
    weakness_context = build_context_block(weakness_chunks)

    # ── 2. Build simulation prompt ────────────────────────────────────────────
    prompt = f"""Generate a mock interview question for:
- Target Role  : {target_role}
- Difficulty   : {difficulty}
- User Request : {raw_input}

Candidate's Known Weakness Areas (from past interviews):
{weakness_context}

Create a question that specifically targets these weak areas."""

    # ── 3. Generate mock interview ────────────────────────────────────────────
    result = await llm.generate_json(prompt=prompt, system=SIMULATION_SYSTEM)

    session_id = str(uuid.uuid4())

    # ── 4. Build human-readable response ─────────────────────────────────────
    follow_ups = result.get("follow_ups", [])
    response_lines = [
        f"Mock Interview — {target_role} ({difficulty.capitalize()})",
        f"Focus Area: {result.get('focus_area', 'N/A')}",
        "",
        "Question:",
        result.get("question", ""),
        "",
        "Follow-up Questions:",
        *[f"  {i + 1}. {fq}" for i, fq in enumerate(follow_ups)],
    ]
    response = "\n".join(response_lines)

    updated_session = {
        **mock_session,
        "session_id": session_id,
        "current_question": result,
        "target_role": target_role,
        "difficulty": difficulty,
    }

    return {
        "mock_session": updated_session,
        "response": response,
        "messages": [AIMessage(content=response)],
    }
