import hashlib
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.supabase_client import get_client

bearer = HTTPBearer()


def _get_user_and_scope(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> tuple[str, str]:
    """
    Returns (user_id, scope).
    - PAT tokens: scope stored in DB ('read' | 'write' | 'admin')
    - Supabase JWTs (dashboard users): always 'admin'
    """
    token = credentials.credentials

    if token.startswith("mat_"):
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        client = get_client()
        result = (
            client.table("access_tokens")
            .select("id, user_id, scope")
            .eq("token_hash", token_hash)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked token")
        row = result.data[0]
        try:
            client.table("access_tokens").update(
                {"last_used_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", row["id"]).execute()
        except Exception:
            pass
        return row["user_id"], row["scope"]

    # Supabase JWT — dashboard users always have full access
    try:
        response = get_client().auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return response.user.id, "admin"
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user_id(
    user_and_scope: tuple[str, str] = Depends(_get_user_and_scope),
) -> str:
    """Read-only endpoints: any valid token is accepted."""
    return user_and_scope[0]


def require_write(
    user_and_scope: tuple[str, str] = Depends(_get_user_and_scope),
) -> str:
    """Write endpoints: requires 'write' or 'admin' scope."""
    user_id, scope = user_and_scope
    if scope == "read":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token scope insufficient — 'write' or 'admin' scope required",
        )
    return user_id


def require_admin(
    user_and_scope: tuple[str, str] = Depends(_get_user_and_scope),
) -> str:
    """Delete endpoints: requires 'admin' scope."""
    user_id, scope = user_and_scope
    if scope != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token scope insufficient — 'admin' scope required",
        )
    return user_id
