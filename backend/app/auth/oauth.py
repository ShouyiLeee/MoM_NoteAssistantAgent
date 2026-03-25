from authlib.integrations.httpx_client import AsyncOAuth2Client

from app.config import settings

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

SCOPES = "openid email profile"


def get_redirect_uri() -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/api/auth/google/callback"


async def get_google_login_url() -> str:
    """Build the Google OAuth authorization URL."""
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=get_redirect_uri(),
        scope=SCOPES,
    )
    uri, _ = client.create_authorization_url(GOOGLE_AUTHORIZE_URL)
    return uri


async def exchange_code_for_profile(code: str) -> dict:
    """Exchange authorization code for user profile info."""
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=get_redirect_uri(),
    )
    await client.fetch_token(GOOGLE_TOKEN_URL, code=code)
    response = await client.get(GOOGLE_USERINFO_URL)
    response.raise_for_status()
    return response.json()
    # Returns: {sub, email, name, picture, email_verified, ...}
