import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.postgres import Base


class UserCV(Base):
    """Stores processed CV summaries per user. Only one version is active at a time."""

    __tablename__ = "user_cvs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    version = Column(Integer, default=1)
    original_filename = Column(String, nullable=True)
    original_file_path = Column(String, nullable=True)  # stored file path (future use)

    # LLM-extracted fields
    name = Column(String, nullable=True)             # extracted full name
    contact_info = Column(Text, nullable=True)       # JSON: {email, phone, linkedin}
    summary = Column(Text, nullable=True)            # 2-3 sentence professional summary
    skills = Column(Text, nullable=True)             # JSON list of skills as string
    experience_years = Column(Integer, nullable=True)
    education = Column(Text, nullable=True)
    recent_roles = Column(Text, nullable=True)       # JSON list of recent roles

    # Raw content (original text for re-processing if needed)
    raw_text = Column(Text, nullable=False)
    change_summary = Column(Text, nullable=True)     # What changed vs previous version

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
