"""
Memory Agent — retrieves interview history from PostgreSQL.

Handles user queries like:
  "Show me my interview history"
  "List all interviews where I failed"

All external operations go through MCP tools.
"""

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.tools.registry import registry

# Import tool modules to ensure tools are registered
import app.tools.db_tools  # noqa: F401


async def memory_agent_node(state: AgentState) -> dict:
    user_id = state["user_id"]

    # ── Retrieve interview history via DB tool ────────────────────────────────
    interviews = await registry.execute("get_interviews", user_id=user_id)

    if not interviews:
        response = (
            "No interview history found. "
            "Upload your first interview note to get started."
        )
    else:
        lines = [f"Interview History — {len(interviews)} record(s):\n"]
        for i, iv in enumerate(interviews, 1):
            lines.append(
                f"{i}. {iv['company']} | {iv['role']} | "
                f"Stage: {iv.get('stage') or 'N/A'} | "
                f"Result: {iv.get('result') or 'N/A'} | "
                f"Date: {iv.get('date') or 'N/A'}"
            )
        response = "\n".join(lines)

    return {
        "response": response,
        "messages": [AIMessage(content=response)],
    }
