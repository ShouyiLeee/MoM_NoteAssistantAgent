"""
Embedding service — wraps Gemini text-embedding-004.
Used by the RAG pipeline and MCP embedding tools.
"""

import asyncio
from google import genai
from app.config import settings


class EmbeddingService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.EMBEDDING_MODEL

    async def embed(self, text: str) -> list[float]:
        """Embed a single text string."""
        response = await self.client.aio.models.embed_content(
            model=self.model,
            contents=text,
        )
        return response.embeddings[0].values

    async def embed_batch(
        self, texts: list[str], max_concurrent: int = 5
    ) -> list[list[float]]:
        """Embed multiple texts concurrently with rate limiting.

        Uses asyncio.Semaphore to control concurrency instead of
        sequential loop. ~5x faster for large batches.
        """
        if not texts:
            return []

        semaphore = asyncio.Semaphore(max_concurrent)

        async def _embed_one(text: str) -> list[float]:
            async with semaphore:
                return await self.embed(text)

        return await asyncio.gather(*[_embed_one(t) for t in texts])


# Singleton
embedding_service = EmbeddingService()
