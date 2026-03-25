"""
CV Review Agent — scores candidate CVs against a Job Description.

For each CV:
  - Compare skills, experience years, and education vs JD requirements
  - Output: fit_score (0.0-1.0) + breakdown {skills, experience, education}
"""

import json

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.tools.registry import registry

import app.tools.llm_tools  # noqa: F401
import app.tools.db_tools  # noqa: F401

CV_SCORE_SYSTEM = """You are an expert technical recruiter scoring candidate CVs against a job description.

Given a JD and a candidate CV, output ONLY valid JSON:

{
  "fit_score": <float 0.0 to 1.0>,
  "score_breakdown": {
    "skills": <float 0.0 to 1.0>,
    "experience": <float 0.0 to 1.0>,
    "education": <float 0.0 to 1.0>
  },
  "strengths": ["<key strength 1>", "<key strength 2>"],
  "gaps": ["<key gap 1>", "<key gap 2>"],
  "recommendation": "<1 sentence summary>"
}

fit_score = weighted average: skills 50%, experience 35%, education 15%
Be objective and data-driven."""


async def cv_review_agent_node(state: AgentState) -> dict:
    jd_text = state.get("jd_text") or ""
    candidate_ids = state.get("candidate_ids") or []
    user_id = state["user_id"]

    results = []

    for cv_id in candidate_ids:
        cv_data = await registry.execute("get_active_cv", user_id=cv_id)
        if not cv_data:
            continue

        cv_summary = (
            f"Name: {cv_data.get('name', 'Unknown')}\n"
            f"Summary: {cv_data.get('summary', '')}\n"
            f"Skills: {', '.join(cv_data.get('skills', []))}\n"
            f"Experience: {cv_data.get('experience_years', '?')} years\n"
            f"Education: {cv_data.get('education', '')}\n"
            f"Recent Roles: {', '.join(cv_data.get('recent_roles', []))}"
        )

        prompt = f"""Job Description:
{jd_text}

Candidate CV:
{cv_summary}

Score this candidate against the JD."""

        score_data = await registry.execute("generate_json", prompt=prompt, system=CV_SCORE_SYSTEM)
        results.append({
            "cv_id": cv_id,
            "candidate_name": cv_data.get("name", "Unknown"),
            **score_data,
        })

    # Sort by fit_score descending
    results.sort(key=lambda x: x.get("fit_score", 0), reverse=True)

    response = f"Scored {len(results)} candidates. Top match: {results[0]['candidate_name'] if results else 'none'} ({results[0].get('fit_score', 0):.0%} fit)" if results else "No candidates found to score."

    return {
        "interview_data": {"ranked_candidates": results},
        "response": response,
        "messages": [AIMessage(content=response)],
    }
