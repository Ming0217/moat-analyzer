import hashlib
import secrets
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_current_user_id, require_admin
from app.services.supabase_client import get_client
from app.schemas import TokenOut, TokenCreatedOut

router = APIRouter()

VALID_SCOPES = {"read", "write", "admin"}


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class TokenCreate(BaseModel):
    name: str
    scope: Literal["read", "write", "admin"] = "read"


@router.get("/tokens", response_model=list[TokenOut])
async def list_tokens(user_id: str = Depends(get_current_user_id)):
    """List all PATs for the current user (never returns the raw token)."""
    result = (
        get_client()
        .table("access_tokens")
        .select("id, name, prefix, scope, created_at, last_used_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("/tokens", status_code=201, response_model=TokenCreatedOut)
async def create_token(
    payload: TokenCreate,
    user_id: str = Depends(get_current_user_id),
):
    """Create a new PAT. Returns the raw token ONCE — it cannot be retrieved again."""
    raw = "mat_" + secrets.token_hex(20)   # 44 chars total
    prefix = raw[:12]                        # "mat_" + first 8 hex chars shown in UI
    result = (
        get_client()
        .table("access_tokens")
        .insert({
            "user_id": user_id,
            "name": payload.name,
            "token_hash": _hash(raw),
            "prefix": prefix,
            "scope": payload.scope,
        })
        .execute()
    )
    return {**result.data[0], "token": raw}


@router.delete("/tokens/{token_id}", status_code=204)
async def revoke_token(
    token_id: str,
    user_id: str = Depends(require_admin),
):
    """Permanently revoke a PAT. Requires admin scope."""
    result = (
        get_client()
        .table("access_tokens")
        .select("id")
        .eq("id", token_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Token not found")
    get_client().table("access_tokens").delete().eq("id", token_id).eq("user_id", user_id).execute()
