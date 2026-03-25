from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import settings


def create_access_token(data: dict[str, Any]) -> str:
    """Create a JWT access token with expiry."""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload["exp"] = expire
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict[str, Any]:
    """Verify JWT and return payload. Raises JWTError if invalid."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def decode_token_unverified(token: str) -> dict[str, Any]:
    """Decode without verification — for debugging only."""
    return jwt.get_unverified_claims(token)
