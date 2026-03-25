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
  "name": "<full name or null>",
  "contact_info": {
    "email": "<email or null>",
    "phone": "<phone or null>",
    "linkedin": "<linkedin URL or null>"
  },
  "summary": "<2-3 sentence professional summary>",
  "skills": ["skill1", "skill2", "skill3"],
  "experience_years": <integer or null>,
  "education": "<highest degree + field, e.g. BSc Computer Science>",
  "recent_roles": ["<Role> at <Company> (<year>)", ...]
}

Be concise. For skills, list specific technical and professional skills (max 20).
For contact_info, only include fields that are explicitly present in the CV."""

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
            .limit(1)
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
        contact_info = extracted.get("contact_info")
        contact_json = json.dumps(contact_info) if contact_info else None

        new_cv = UserCV(
            user_id=user_id,
            version=new_version,
            original_filename=filename,
            name=extracted.get("name"),
            contact_info=contact_json,
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
            .limit(1)
        )
        return result.scalar_one_or_none()


async def extract_cv_fields(raw_text: str) -> dict:
    """
    Run LLM extraction on raw CV text.
    Returns extracted fields dict WITHOUT saving to DB.
    Used by the extract-only endpoints (user reviews before saving).
    """
    return await llm.generate_json(
        prompt=f"CV Text:\n\n{raw_text}",
        system=EXTRACTION_SYSTEM,
    )


async def process_cv_from_extracted(user_id: str, data, filename: str | None = None) -> UserCV:
    """
    Save a CV from already-extracted (and possibly user-edited) fields.
    data: CVSaveRequest or dict with all CV fields.
    Handles deduplication the same as process_cv().
    """
    # Normalize: support both Pydantic model and dict
    if hasattr(data, "model_dump"):
        fields = data.model_dump()
    else:
        fields = dict(data)

    raw_text = fields.get("raw_text", "")
    fn = fields.get("original_filename") or filename

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserCV)
            .where(UserCV.user_id == user_id, UserCV.is_active == True)
            .order_by(UserCV.version.desc())
            .limit(1)
        )
        existing_cv = result.scalar_one_or_none()

        if existing_cv:
            new_summary = fields.get("summary") or ""
            new_skills = json.dumps(fields.get("skills") or [])
            diff_prompt = (
                f"EXISTING CV SUMMARY:\n{existing_cv.summary}\n"
                f"Skills: {existing_cv.skills}\n\n"
                f"NEW CV SUMMARY:\n{new_summary}\n"
                f"Skills: {new_skills}"
            )
            verdict = (await llm.generate(prompt=diff_prompt, system=DIFF_SYSTEM)).strip().upper()
            if verdict == "SAME":
                return existing_cv

            change_prompt = (
                f"Old CV: {existing_cv.summary}\nNew CV: {new_summary}\n"
                f"Old skills: {existing_cv.skills}\nNew skills: {new_skills}\n"
                "Summarize the key changes in 1-2 sentences."
            )
            change_summary = await llm.generate(
                prompt=change_prompt,
                system="You summarize changes between CV versions concisely.",
            )
            await session.execute(
                update(UserCV)
                .where(UserCV.user_id == user_id, UserCV.is_active == True)
                .values(is_active=False)
            )
            new_version = (existing_cv.version or 1) + 1
        else:
            change_summary = "Initial CV upload."
            new_version = 1

        contact = fields.get("contact_info")
        contact_json = json.dumps(contact) if contact else None

        new_cv = UserCV(
            user_id=user_id,
            version=new_version,
            original_filename=fn,
            name=fields.get("name"),
            contact_info=contact_json,
            summary=fields.get("summary"),
            skills=json.dumps(fields.get("skills") or []),
            experience_years=fields.get("experience_years"),
            education=fields.get("education"),
            recent_roles=json.dumps(fields.get("recent_roles") or []),
            raw_text=raw_text,
            change_summary=change_summary,
            is_active=True,
        )
        session.add(new_cv)
        await session.commit()
        await session.refresh(new_cv)
        return new_cv


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
