"""
Note Agent — converts raw interview notes into structured records.

Pipeline:
    Raw text input
        → LLM extraction (company, role, stage, result, feedback, date)
        → PostgreSQL (structured record)
        → Qdrant (chunked embeddings for RAG)

All external operations go through MCP tools.
"""

from datetime import date

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.config import settings
from app.tools.registry import registry

# Import tool modules to ensure tools are registered
import app.tools.llm_tools      # noqa: F401
import app.tools.embedding_tools # noqa: F401
import app.tools.rag_tools      # noqa: F401
import app.tools.db_tools       # noqa: F401


EXTRACTION_SYSTEM = """You are an expert at extracting structured interview information from raw notes or transcripts.

Extract the following fields. Use null for any field not mentioned.

{
  "company":  "<string | null>",
  "role":     "<string | null>",
  "date":     "<YYYY-MM-DD string | null>",
  "stage":    "<one of: Coding, System Design, Behavioral, HR, General | null>",
  "result":   "<one of: Pass, Fail, Pending | null>",
  "feedback": "<concise summary of key feedback points | null>"
}

Respond ONLY with valid JSON."""


async def note_agent_node(state: AgentState) -> dict:
    raw_notes = state["raw_input"]
    user_id = state["user_id"]
    jd_text = state.get("jd_text")
    cv_context = state.get("cv_context")

    # ── 1. Build enriched extraction prompt ───────────────────────────────────
    prompt_parts = [f"Interview notes:\n\n{raw_notes}"]
    if jd_text:
        prompt_parts.append(f"\nJob Description:\n\n{jd_text}")
    if cv_context:
        prompt_parts.append(f"\nCandidate CV Context:\n\n{cv_context}")

    # ── 2. Extract structured data via LLM tool ──────────────────────────────
    extracted = await registry.execute(
        "generate_json",
        prompt="\n".join(prompt_parts),
        system=EXTRACTION_SYSTEM,
    )

    # ── 3. Persist structured record via DB tool ─────────────────────────────
    interview_date = None
    if extracted.get("date"):
        try:
            interview_date = date.fromisoformat(extracted["date"])
        except ValueError:
            pass

    interview_id = await registry.execute(
        "save_interview",
        user_id=user_id,
        company=extracted.get("company") or "Unknown",
        role=extracted.get("role") or "Unknown",
        date=interview_date,
        stage=extracted.get("stage"),
        result=extracted.get("result"),
        feedback=extracted.get("feedback"),
        raw_notes=raw_notes,
        jd_text=jd_text,
        collection_id=state.get("collection_id"),
    )

    # ── 4. Chunk + embed raw notes via Embedding & RAG tools ─────────────────
    chunks = _chunk_text(raw_notes, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
    if chunks:
        payloads = [
            {
                "text": chunk,
                "user_id": user_id,
                "interview_id": interview_id,
                "company": extracted.get("company"),
                "role": extracted.get("role"),
                "stage": extracted.get("stage"),
                "result": extracted.get("result"),
            }
            for chunk in chunks
        ]
        embeddings = await registry.execute("embed_batch", texts=chunks)
        await registry.execute("store_chunks", payloads=payloads, embeddings=embeddings)

    # ── 5. Build response ─────────────────────────────────────────────────────
    response_lines = [
        "Interview recorded successfully.",
        f"  Company  : {extracted.get('company', 'N/A')}",
        f"  Role     : {extracted.get('role', 'N/A')}",
        f"  Stage    : {extracted.get('stage', 'N/A')}",
        f"  Result   : {extracted.get('result', 'N/A')}",
        f"  Date     : {extracted.get('date', 'N/A')}",
        f"  ID       : {interview_id}",
    ]
    response = "\n".join(response_lines)

    return {
        "interview_data": {**extracted, "interview_id": interview_id},
        "response": response,
        "messages": [AIMessage(content=response)],
    }


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    if not words:
        return []  # skip whitespace-only or empty input
    chunks = []
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks
