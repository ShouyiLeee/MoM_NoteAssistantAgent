"""
CV Service — processes, summarizes, and deduplicates user CVs.

Pipeline:
    Raw CV text
        → LLM extraction (summary, skills, experience, education, roles)
        → Compare with existing active CV (dedup check)
        → Store new version if significantly different
"""

import json

from sqlalchemy import select, update

from app.db.postgres import AsyncSessionLocal
from app.models.cv import UserCV
from app.services.llm import llm

EXTRACTION_SYSTEM = """You are an expert HR analyst who reads CVs/resumes.

Extract the following information from the CV text provided.
Return ONLY valid JSON with this exact structure:

{
  "summary": "<2-3 sentence professional summary>",
  "skills": ["skill1", "skill2", "skill3"],
  "experience_years": <integer or null>,
  "education": "<highest degree + field, e.g. BSc Computer Science>",
  "recent_roles": ["<Role> at <Company> (<year>)", ...]
}

Be concise. For skills, list specific technical and professional skills (max 20)."""

DIFF_SYSTEM = """You are comparing two CV summaries to determine if they represent meaningfully different versions.

Answer with EXACTLY one word: SAME or DIFFERENT.

DIFFERENT means: new job added, significant new skills, different role/position, or major experience update.
SAME means: minor wording changes, formatting differences only, or trivially updated."""


async def process_cv(user_id: str, raw_text: str, filename: str | None = None) -> UserCV:
    """
    Process a CV: extract structured info, check for duplicates, store if new.
    Returns the active UserCV record (new or existing).
    """
    async with AsyncSessionLocal() as session:
        # ── 1. Get current active CV ───────────────────────────────────────────
        result = await session.execute(
            select(UserCV)
            .where(UserCV.user_id == user_id, UserCV.is_active == True)
            .order_by(UserCV.version.desc())
        )
        existing_cv = result.scalar_one_or_none()

        # ── 2. Extract structured data from new CV ────────────────────────────
        extracted = await llm.generate_json(
            prompt=f"CV Text:\n\n{raw_text}",
            system=EXTRACTION_SYSTEM,
        )

        # ── 3. Check if meaningfully different from existing CV ───────────────
        if existing_cv:
            diff_prompt = (
                f"EXISTING CV SUMMARY:\n{existing_cv.summary}\n"
                f"Skills: {existing_cv.skills}\n\n"
                f"NEW CV SUMMARY:\n{extracted.get('summary', '')}\n"
                f"Skills: {json.dumps(extracted.get('skills', []))}"
            )
            verdict = await llm.generate(prompt=diff_prompt, system=DIFF_SYSTEM)
            verdict = verdict.strip().upper()

            if verdict == "SAME":
                # No meaningful change — return existing
                return existing_cv

            # Different — deactivate old, create new version
            change_prompt = (
                f"Old CV: {existing_cv.summary}\nNew CV: {extracted.get('summary', '')}\n"
                f"Old skills: {existing_cv.skills}\nNew skills: {json.dumps(extracted.get('skills', []))}\n"
                f"Summarize the key changes in 1-2 sentences."
            )
            change_summary = await llm.generate(prompt=change_prompt, system="You summarize changes between CV versions concisely.")

            await session.execute(
                update(UserCV)
                .where(UserCV.user_id == user_id, UserCV.is_active == True)
                .values(is_active=False)
            )
            new_version = (existing_cv.version or 1) + 1
        else:
            change_summary = "Initial CV upload."
            new_version = 1

        # ── 4. Store new CV ───────────────────────────────────────────────────
        skills_json = json.dumps(extracted.get("skills", []))
        recent_roles_json = json.dumps(extracted.get("recent_roles", []))

        new_cv = UserCV(
            user_id=user_id,
            version=new_version,
            original_filename=filename,
            summary=extracted.get("summary"),
            skills=skills_json,
            experience_years=extracted.get("experience_years"),
            education=extracted.get("education"),
            recent_roles=recent_roles_json,
            raw_text=raw_text,
            change_summary=change_summary,
            is_active=True,
        )
        session.add(new_cv)
        await session.commit()
        await session.refresh(new_cv)
        return new_cv


async def get_active_cv(user_id: str) -> UserCV | None:
    """Fetch the current active CV for a user."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserCV)
            .where(UserCV.user_id == user_id, UserCV.is_active == True)
            .order_by(UserCV.version.desc())
        )
        return result.scalar_one_or_none()


async def get_cv_context(user_id: str) -> str | None:
    """Return a compact CV summary string for use in LLM prompts."""
    cv = await get_active_cv(user_id)
    if not cv:
        return None
    skills = ", ".join(json.loads(cv.skills or "[]"))
    roles = " | ".join(json.loads(cv.recent_roles or "[]"))
    return (
        f"Candidate Background:\n"
        f"Summary: {cv.summary}\n"
        f"Skills: {skills}\n"
        f"Experience: {cv.experience_years} years\n"
        f"Education: {cv.education}\n"
        f"Recent Roles: {roles}"
    )
