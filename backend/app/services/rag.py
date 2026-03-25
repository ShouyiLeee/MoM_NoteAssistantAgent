"""
RAG (Retrieval-Augmented Generation) service.
Combines embedding + Qdrant retrieval into a single helper used by agents.
"""

from app.services.embeddings import embedding_service
from app.db.qdrant_client import search
from app.config import settings


async def retrieve_context(query: str, user_id: str, top_k: int | None = None) -> list[str]:
    """
    Embed the query and retrieve the top-K most relevant interview chunks
    for the given user from Qdrant.

    Returns a list of raw text strings ready to be injected into a prompt.
    Fails gracefully — returns empty list if Qdrant is unavailable.
    """
    try:
        k = top_k or settings.TOP_K
        query_embedding = await embedding_service.embed(query)
        chunks = await search(query_embedding, user_id, top_k=k)
        return [chunk.get("text", "") for chunk in chunks if chunk.get("text")]
    except Exception:
        return []  # fail gracefully — agents can still work without context


def build_context_block(chunks: list[str]) -> str:
    """Format retrieved chunks into a prompt-ready context block."""
    if not chunks:
        return "No relevant interview records found."
    return "\n---\n".join(chunks)
