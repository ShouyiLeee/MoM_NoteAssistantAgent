"""
Question Gen Agent — generates structured interview question banks from a JD.

Output per question:
  { question, focus_area, difficulty, expected_points, rubric }
"""

import json

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.tools.registry import registry

import app.tools.llm_tools  # noqa: F401

QUESTION_GEN_SYSTEM = """You are an expert technical interviewer and assessment designer.

Given a Job Description, generate a structured interview question bank.
Return ONLY valid JSON with this exact structure:

{
  "questions": [
    {
      "question": "<the interview question>",
      "focus_area": "<e.g. Data Structures, System Design, Behavioral>",
      "difficulty": "<easy|medium|hard>",
      "expected_points": ["<key point 1>", "<key point 2>", "..."],
      "rubric": "<scoring guide: 5=excellent, 3=acceptable, 1=weak>"
    }
  ]
}

Guidelines:
- Mix of technical and behavioral questions appropriate for the role
- Cover the key skills and requirements mentioned in the JD
- Scale difficulty appropriately
- expected_points should be 3-5 concrete things a good answer would include
- rubric should be 1 sentence with clear criteria"""


async def question_gen_agent_node(state: AgentState) -> dict:
    jd_text = state.get("jd_text") or state["raw_input"]
    mock_session = state.get("mock_session") or {}
    difficulty = mock_session.get("difficulty", "medium")
    count = mock_session.get("count", 10)

    prompt = f"""Job Description:
{jd_text}

Generate {count} interview questions with {difficulty} difficulty level.
Cover the main technical requirements and soft skills from the JD."""

    result = await registry.execute("generate_json", prompt=prompt, system=QUESTION_GEN_SYSTEM)

    questions = result.get("questions", [])
    response = f"Generated {len(questions)} interview questions for this position."

    return {
        "question_set": {"questions": questions, "difficulty": difficulty},
        "response": response,
        "messages": [AIMessage(content=response)],
    }
