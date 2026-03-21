"""
Embedding Tools — wraps embedding operations as registered tools.
"""

import asyncio

from app.tools.registry import registry
from app.services.embeddings import embedding_service


@registry.register(
    name="embed_text",
    description="Generate an embedding vector for a single text string.",
    parameters={
        "text": {"type": "str", "required": True, "description": "Text to embed"},
    },
    category="embedding",
)
async def embed_text(text: str) -> list[float]:
    """Embed a single text string."""
    return await embedding_service.embed(text)


@registry.register(
    name="embed_batch",
    description="Generate embedding vectors for multiple texts concurrently.",
    parameters={
        "texts": {"type": "list[str]", "required": True, "description": "List of texts to embed"},
        "max_concurrent": {"type": "int", "required": False, "description": "Max concurrent API calls (default 5)"},
    },
    category="embedding",
)
async def embed_batch(texts: list[str], max_concurrent: int = 5) -> list[list[float]]:
    """Embed multiple texts with concurrency control.

    Uses asyncio.Semaphore to batch API calls instead of sequential loops.
    This is a Phase 3 improvement baked into the tool.
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _embed_one(text: str) -> list[float]:
        async with semaphore:
            return await embedding_service.embed(text)

    return await asyncio.gather(*[_embed_one(t) for t in texts])
