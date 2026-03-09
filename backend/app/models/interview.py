import uuid

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.postgres import Base


class Collection(Base):
    """Groups of interviews organised by a user (e.g. 'Job Search 2025')."""

    __tablename__ = "collections"

    collection_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False, default="job_seeker")  # job_seeker | recruiter
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Interview(Base):
    """A single interview event extracted from user-uploaded notes."""

    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collections.collection_id", ondelete="SET NULL"),
        nullable=True,
    )
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    date = Column(Date, nullable=True)
    stage = Column(String, nullable=True)   # Coding | System Design | Behavioral | HR | General
    result = Column(String, nullable=True)  # Pass | Fail | Pending
    feedback = Column(Text, nullable=True)
    raw_notes = Column(Text, nullable=True)
    jd_text = Column(Text, nullable=True)    # Job Description text
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Candidate(Base):
    """Recruiter mode: tracks a candidate across multiple interviews."""

    __tablename__ = "candidates"

    candidate_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)  # the recruiter's user_id
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    skills = Column(Text, nullable=True)        # stored as JSON string
    evaluation_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
