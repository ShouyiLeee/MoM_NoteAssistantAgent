"""
Embedding service — wraps Gemini text-embedding-004.
Used by the RAG pipeline and Note Agent for vector storage.
"""

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

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts sequentially."""
        results = []
        for text in texts:
            embedding = await self.embed(text)
            results.append(embedding)
        return results


# Singleton
embedding_service = EmbeddingService()
