from datetime import date as Date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Interview Upload ──────────────────────────────────────────────────────────

class InterviewUploadRequest(BaseModel):
    user_id: str
    raw_notes: str = Field(..., min_length=10, description="Raw interview notes or transcript")
    jd_text: str | None = Field(None, description="Job Description text (optional, improves extraction)")
    collection_id: UUID | None = None


class ExtractedInterview(BaseModel):
    company: str | None = None
    role: str | None = None
    date: Date | None = None
    stage: str | None = None   # Coding | System Design | Behavioral | HR | General
    result: str | None = None  # Pass | Fail | Pending
    feedback: str | None = None


class InterviewUploadResponse(BaseModel):
    interview_id: str
    extracted: ExtractedInterview
    message: str


# ── Interview History ─────────────────────────────────────────────────────────

class InterviewSummary(BaseModel):
    id: str
    company: str
    role: str
    stage: str | None
    result: str | None
    feedback: str | None
    date: str | None


class InterviewHistoryResponse(BaseModel):
    interviews: list[InterviewSummary]
    total: int


# ── Analysis ──────────────────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    user_id: str
    query: str = Field(..., min_length=5, description="Natural language question about interview performance")


class AnalysisResponse(BaseModel):
    answer: str
    context_chunks_used: int


# ── Mock Interview ────────────────────────────────────────────────────────────

class MockInterviewRequest(BaseModel):
    user_id: str
    target_role: str = Field(..., description="e.g. 'ML Engineer', 'Software Engineer'")
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class MockInterviewQuestion(BaseModel):
    question: str
    follow_ups: list[str]
    focus_area: str | None = None
    difficulty: str | None = None


class MockInterviewResponse(BaseModel):
    session_id: str
    question: MockInterviewQuestion
    message: str


# ── CV ────────────────────────────────────────────────────────────────────────

class CVUploadRequest(BaseModel):
    user_id: str
    cv_text: str = Field(..., min_length=50, description="Raw CV/resume text content")
    filename: str | None = None


class CVResponse(BaseModel):
    id: str
    user_id: str
    version: int
    summary: str | None
    skills: list[str]
    experience_years: int | None
    education: str | None
    recent_roles: list[str]
    change_summary: str | None
    is_active: bool
    created_at: str


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsResponse(BaseModel):
    total: int
    pass_rate: float
    by_result: dict[str, int]
    by_stage: dict[str, dict]
    by_company: dict[str, dict]
    timeline: list[dict]
    weakest_stage: str | None
