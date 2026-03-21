"""
RAG Tools — wraps retrieval-augmented generation operations as registered tools.
"""

from app.tools.registry import registry
from app.services.rag import retrieve_context, build_context_block
from app.db.qdrant_client import upsert_chunks


@registry.register(
    name="retrieve_context",
    description="Embed a query and retrieve top-K relevant interview chunks for a user from Qdrant.",
    parameters={
        "query": {"type": "str", "required": True, "description": "Search query"},
        "user_id": {"type": "str", "required": True, "description": "User identifier"},
        "top_k": {"type": "int", "required": False, "description": "Number of results (default from config)"},
    },
    category="rag",
)
async def tool_retrieve_context(
    query: str, user_id: str, top_k: int | None = None
) -> list[str]:
    """Retrieve relevant context chunks via RAG."""
    return await retrieve_context(query, user_id, top_k=top_k)


@registry.register(
    name="build_context_block",
    description="Format retrieved chunks into a prompt-ready context string.",
    parameters={
        "chunks": {"type": "list[str]", "required": True, "description": "Retrieved text chunks"},
    },
    category="rag",
)
async def tool_build_context_block(chunks: list[str]) -> str:
    """Format context chunks for LLM prompt injection."""
    return build_context_block(chunks)


@registry.register(
    name="store_chunks",
    description="Store text chunks with embeddings into Qdrant vector store.",
    parameters={
        "payloads": {"type": "list[dict]", "required": True, "description": "Chunk metadata payloads"},
        "embeddings": {"type": "list[list[float]]", "required": True, "description": "Embedding vectors"},
    },
    category="rag",
)
async def tool_store_chunks(
    payloads: list[dict], embeddings: list[list[float]]
) -> None:
    """Upsert chunks + embeddings into Qdrant."""
    await upsert_chunks(payloads, embeddings)
