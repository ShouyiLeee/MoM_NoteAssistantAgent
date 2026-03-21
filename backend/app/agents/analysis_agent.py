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

ANALYSIS_SYSTEM = """You are an expert interview performance coach and data analyst.

Using the retrieved interview records provided in the context, answer the user's question with:
1. Clear, specific insights backed by the data
2. Identified patterns (failure stages, recurring weaknesses, trends)
3. Concrete, actionable improvement recommendations

Be direct and data-driven. If the context contains no relevant data, say so clearly."""


async def analysis_agent_node(state: AgentState) -> dict:
    query = state["raw_input"]
    user_id = state["user_id"]

    # ── 1. Retrieve relevant interview chunks via RAG tool ────────────────────
    context_chunks = await registry.execute(
        "retrieve_context", query=query, user_id=user_id
    )
    context_block = await registry.execute(
        "build_context_block", chunks=context_chunks
    )

    # ── 2. Build analysis prompt ──────────────────────────────────────────────
    prompt = f"""User Question:
{query}

Retrieved Interview Context:
{context_block}

Provide a thorough analysis based on the above interview records."""

    # ── 3. LLM reasoning via LLM tool ────────────────────────────────────────
    answer = await registry.execute(
        "generate_text", prompt=prompt, system=ANALYSIS_SYSTEM
    )

    return {
        "retrieved_context": context_chunks,
        "response": answer,
        "messages": [AIMessage(content=answer)],
    }
