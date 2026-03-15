from fastapi import APIRouter, Depends
from app.dependencies import get_current_user_id
from app.services.supabase_client import get_client

router = APIRouter()


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Return basic info about the authenticated user. Useful for agents to verify a token."""
    result = (
        get_client()
        .table("companies")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    return {"user_id": user_id, "companies_count": result.count or 0}
