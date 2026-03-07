"""
Note Agent — converts raw interview notes into structured records.

Pipeline:
    Raw text input
        → LLM extraction (company, role, stage, result, feedback, date)
        → PostgreSQL (structured record)
        → Qdrant (chunked embeddings for RAG)
"""

from datetime import date

from langchain_core.messages import AIMessage

from app.agents.state import AgentState
from app.config import settings
from app.db.postgres import AsyncSessionLocal
from app.db.qdrant_client import upsert_chunks
from app.models.interview import Interview
from app.services.embeddings import embedding_service
from app.services.llm import llm

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

    # ── 1. Extract structured data via LLM ───────────────────────────────────
    extracted = await llm.generate_json(
        prompt=f"Interview notes:\n\n{raw_notes}",
        system=EXTRACTION_SYSTEM,
    )

    # ── 2. Persist structured record to PostgreSQL ────────────────────────────
    interview_date = None
    if extracted.get("date"):
        try:
            interview_date = date.fromisoformat(extracted["date"])
        except ValueError:
            pass

    async with AsyncSessionLocal() as session:
        interview = Interview(
            user_id=user_id,
            collection_id=state.get("collection_id"),
            company=extracted.get("company") or "Unknown",
            role=extracted.get("role") or "Unknown",
            date=interview_date,
            stage=extracted.get("stage"),
            result=extracted.get("result"),
            feedback=extracted.get("feedback"),
            raw_notes=raw_notes,
        )
        session.add(interview)
        await session.commit()
        await session.refresh(interview)
        interview_id = str(interview.id)

    # ── 3. Chunk + embed raw notes → Qdrant ──────────────────────────────────
    chunks = _chunk_text(raw_notes, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
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
    embeddings = await embedding_service.embed_batch(chunks)
    await upsert_chunks(payloads, embeddings)

    # ── 4. Build response ─────────────────────────────────────────────────────
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
        return [text]
    chunks = []
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks
