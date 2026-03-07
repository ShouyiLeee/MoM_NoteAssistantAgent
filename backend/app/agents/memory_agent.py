"""
Memory Agent — retrieves interview history from PostgreSQL.

Handles user queries like:
  "Show me my interview history"
  "List all interviews where I failed"
"""

from langchain_core.messages import AIMessage
from sqlalchemy import select

from app.agents.state import AgentState
from app.db.postgres import AsyncSessionLocal
from app.models.interview import Interview


async def memory_agent_node(state: AgentState) -> dict:
    user_id = state["user_id"]

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Interview)
            .where(Interview.user_id == user_id)
            .order_by(Interview.created_at.desc())
            .limit(20)
        )
        interviews = result.scalars().all()

    if not interviews:
        response = (
            "No interview history found. "
            "Upload your first interview note to get started."
        )
    else:
        lines = [f"Interview History — {len(interviews)} record(s):\n"]
        for i, iv in enumerate(interviews, 1):
            lines.append(
                f"{i}. {iv.company} | {iv.role} | "
                f"Stage: {iv.stage or 'N/A'} | "
                f"Result: {iv.result or 'N/A'} | "
                f"Date: {iv.date or 'N/A'}"
            )
        response = "\n".join(lines)

    return {
        "response": response,
        "messages": [AIMessage(content=response)],
    }
