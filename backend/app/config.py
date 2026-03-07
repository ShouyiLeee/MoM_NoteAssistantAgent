from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM
    GEMINI_API_KEY: str
    LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-004"

    # PostgreSQL
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/interview_agent"

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "interview_notes"

    # RAG
    TOP_K: int = 5
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # App
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
