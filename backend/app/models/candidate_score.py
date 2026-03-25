import uuid
from datetime import datetime, timezone

from sqlalchemy import Float, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.postgres import Base


class CandidateJDScore(Base):
    __tablename__ = "candidate_jd_scores"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    jd_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    cv_id: Mapped[str] = mapped_column(String, nullable=False)
    candidate_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    candidate_name: Mapped[str | None] = mapped_column(String, nullable=True)
    fit_score: Mapped[float] = mapped_column(Float, nullable=False)
    score_breakdown: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {skills, experience, education}
    scored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
