"""
Analysis Agent — answers questions about interview performance using RAG.

Pipeline:
    User query
        → Retrieve top-K interview chunks via RAG tool
        → Build prompt with context
        → LLM reasoning via LLM tool
        → Structured insight

All external operations go through MCP tools.
"""

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.tools.registry import registry

# Import tool modules to ensure tools are registered
import app.tools.llm_tools  # noqa: F401
import app.tools.rag_tools  # noqa: F401
import app.tools.db_tools   # noqa: F401

ANALYSIS_SYSTEM = """You are an expert interview performance coach and data analyst.

Using the candidate's interview history, CV background, and any retrieved context, answer the user's question with:
1. Clear, specific insights backed by the actual data provided
2. Identified patterns (failure stages, recurring weaknesses, trends over time)
3. Concrete, actionable improvement recommendations tied to their background and skills
4. If CV is provided, highlight skill gaps between their background and the roles they're interviewing for

Be direct, personalized, and data-driven. Reference specific companies, roles, and feedback from their history.
If the data shows no relevant information, say so honestly and suggest what data would help."""


async def analysis_agent_node(state: AgentState) -> dict:
    query = state["raw_input"]
    user_id = state["user_id"]
    cv_context = state.get("cv_context")

    # ── 1. Fetch structured interview history from PostgreSQL ─────────────────
    interviews = await registry.execute("get_interviews", user_id=user_id, limit=50)

    # ── 2. Retrieve semantically relevant chunks via RAG (best-effort) ────────
    context_chunks = await registry.execute(
        "retrieve_context", query=query, user_id=user_id
    )
    rag_block = await registry.execute("build_context_block", chunks=context_chunks)

    # ── 3. Build structured interview summary ─────────────────────────────────
    if interviews:
        lines = []
        for iv in interviews:
            parts = [f"- {iv.get('company', '?')} | {iv.get('role', '?')}"]
            if iv.get("stage"):
                parts[0] += f" | Stage: {iv['stage']}"
            if iv.get("result"):
                parts[0] += f" | Result: {iv['result']}"
            if iv.get("date"):
                parts[0] += f" | Date: {iv['date']}"
            if iv.get("feedback"):
                parts.append(f"  Feedback: {iv['feedback']}")
            lines.append("\n".join(parts))
        structured_block = "\n".join(lines)
    else:
        structured_block = "No interviews recorded yet."

    # ── 4. Build full analysis prompt ─────────────────────────────────────────
    cv_section = f"\n=== Candidate CV / Background ===\n{cv_context}\n" if cv_context else ""
    rag_section = (
        f"\n=== Semantically Relevant Notes (RAG) ===\n{rag_block}\n"
        if context_chunks
        else ""
    )

    prompt = f"""User Question: {query}
{cv_section}
=== Full Interview History ({len(interviews)} records) ===
{structured_block}
{rag_section}
Please answer the question with specific insights from the data above."""

    # ── 5. LLM reasoning ─────────────────────────────────────────────────────
    answer = await registry.execute(
        "generate_text", prompt=prompt, system=ANALYSIS_SYSTEM
    )

    return {
        "retrieved_context": context_chunks,
        "response": answer,
        "messages": [AIMessage(content=answer)],
    }
