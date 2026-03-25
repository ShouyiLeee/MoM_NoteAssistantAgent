import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base


class QuestionSet(Base):
    __tablename__ = "question_sets"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    jd_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    owner_user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    questions: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array of question objects
    difficulty: Mapped[str] = mapped_column(String, default="medium")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
