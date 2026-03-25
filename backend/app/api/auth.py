from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token
from app.auth.oauth import exchange_code_for_profile, get_google_login_url
from app.config import settings
from app.db.postgres import get_db
from app.models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginUrlResponse(BaseModel):
    url: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None
    roles: list[str]


class UpdateRolesRequest(BaseModel):
    roles: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/google/login", response_model=LoginUrlResponse)
async def google_login():
    """Return the Google OAuth authorization URL for the frontend to redirect to."""
    url = await get_google_login_url()
    return {"url": url}


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchange Google OAuth code for JWT, then redirect to frontend with token."""
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    try:
        profile = await exchange_code_for_profile(code)
    except Exception as e:
        return RedirectResponse(url=f"{frontend_url}/login?error=oauth_failed")

    google_id = profile.get("sub")
    email = profile.get("email")
    name = profile.get("name", email)
    avatar_url = profile.get("picture")

    if not google_id or not email:
        return RedirectResponse(url=f"{frontend_url}/login?error=incomplete_profile")

    # Upsert user
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(google_id=google_id, email=email, name=name, avatar_url=avatar_url, roles=[])
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.name = name
        user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email, "roles": user.roles or []})
    return RedirectResponse(url=f"{frontend_url}/auth/callback?token={token}")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        roles=current_user.roles or [],
    )


@router.put("/roles", response_model=UserResponse)
async def update_roles(
    request: UpdateRolesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's roles. Called from role-select page."""
    valid_roles = {"interviewee", "interviewer"}
    roles = [r for r in request.roles if r in valid_roles]
    if not roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At least one valid role required: {valid_roles}",
        )

    current_user.roles = roles
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        roles=current_user.roles,
    )
