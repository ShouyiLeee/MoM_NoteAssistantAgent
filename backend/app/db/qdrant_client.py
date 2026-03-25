import uuid
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from app.config import settings

# gemini-embedding-001 produces 3072-dimensional vectors
# text-embedding-004 produces 768-dimensional vectors
VECTOR_SIZE = 3072

qdrant = AsyncQdrantClient(url=settings.QDRANT_URL)


async def init_qdrant():
    """Create the collection if it does not exist."""
    collections = await qdrant.get_collections()
    existing = [c.name for c in collections.collections]
    if settings.QDRANT_COLLECTION not in existing:
        await qdrant.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


async def upsert_chunks(chunks: list[dict], embeddings: list[list[float]]):
    """Store text chunks with their embeddings in Qdrant."""
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=embedding,
            payload=chunk,
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]
    await qdrant.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)


async def search(
    query_vector: list[float], user_id: str, top_k: int = 5
) -> list[dict]:
    """Retrieve the top-K most relevant chunks for a user."""
    results = await qdrant.search(
        collection_name=settings.QDRANT_COLLECTION,
        query_vector=query_vector,
        query_filter=Filter(
            must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
        ),
        limit=top_k,
    )
    return [hit.payload for hit in results]
