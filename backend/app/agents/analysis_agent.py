"""
Analysis Agent — answers questions about interview performance using RAG.

Pipeline:
    User query
        → Embed query
        → Retrieve top-K interview chunks from Qdrant
        → Build prompt with context
        → Gemini Flash reasoning
        → Structured insight
"""

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.services.llm import llm
from app.services.rag import retrieve_context, build_context_block

ANALYSIS_SYSTEM = """You are an expert interview performance coach and data analyst.

Using the retrieved interview records provided in the context, answer the user's question with:
1. Clear, specific insights backed by the data
2. Identified patterns (failure stages, recurring weaknesses, trends)
3. Concrete, actionable improvement recommendations

Be direct and data-driven. If the context contains no relevant data, say so clearly."""


async def analysis_agent_node(state: AgentState) -> dict:
    query = state["raw_input"]
    user_id = state["user_id"]

    # ── 1. Retrieve relevant interview chunks via RAG ─────────────────────────
    context_chunks = await retrieve_context(query, user_id)
    context_block = build_context_block(context_chunks)

    # ── 2. Build analysis prompt ──────────────────────────────────────────────
    prompt = f"""User Question:
{query}

Retrieved Interview Context:
{context_block}

Provide a thorough analysis based on the above interview records."""

    # ── 3. LLM reasoning ──────────────────────────────────────────────────────
    answer = await llm.generate(prompt=prompt, system=ANALYSIS_SYSTEM)

    return {
        "retrieved_context": context_chunks,
        "response": answer,
        "messages": [AIMessage(content=answer)],
    }
