from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None


class CVExtractedFields(BaseModel):
    """Fields extracted by AI — all editable by user before saving."""
    name: str | None = None
    contact_info: ContactInfo | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience_years: int | None = None
    education: str | None = None
    recent_roles: list[str] = Field(default_factory=list)


class CVExtractResponse(BaseModel):
    """Returned after extraction — NOT yet saved to DB. User can edit fields."""
    raw_text: str
    extracted: CVExtractedFields


class CVSaveRequest(BaseModel):
    """Send this after user reviews/edits extracted fields to save to DB."""
    raw_text: str
    original_filename: str | None = None
    name: str | None = None
    contact_info: ContactInfo | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience_years: int | None = None
    education: str | None = None
    recent_roles: list[str] = Field(default_factory=list)


class CVUpdateRequest(BaseModel):
    """Partial update for an already-saved CV."""
    name: str | None = None
    contact_info: ContactInfo | None = None
    summary: str | None = None
    skills: list[str] | None = None
    experience_years: int | None = None
    education: str | None = None
    recent_roles: list[str] | None = None


class CVResponse(BaseModel):
    id: str
    user_id: str
    version: int
    name: str | None = None
    contact_info: ContactInfo | None = None
    summary: str | None = None
    skills: list[str]
    experience_years: int | None = None
    education: str | None = None
    recent_roles: list[str]
    change_summary: str | None = None
    original_filename: str | None = None
    is_active: bool
    created_at: str
