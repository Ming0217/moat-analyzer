from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_current_user_id, require_write, require_admin
from app.services.supabase_client import get_client
from app.schemas import CompanyOut

router = APIRouter()


class CompanyCreate(BaseModel):
    name: str
    ticker: str
    sector: str


@router.get("")
async def list_companies(user_id: str = Depends(get_current_user_id)):
    """Return all companies belonging to the current user."""
    client = get_client()
    result = (
        client.table("companies")
        .select("*, analyses(id, moat_verdict, moat_types, created_at, valuation_results(*))")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    data = result.data
    for company in data:
        if company.get("analyses"):
            company["analyses"].sort(key=lambda a: a["created_at"], reverse=True)
            # Only return the latest analysis for the dashboard list view
            company["analyses"] = company["analyses"][:1]
    return data


@router.post("", status_code=201, response_model=CompanyOut)
async def create_company(
    payload: CompanyCreate,
    user_id: str = Depends(require_write),
):
    client = get_client()
    result = (
        client.table("companies")
        .insert({"user_id": user_id, **payload.model_dump()})
        .execute()
    )
    return result.data[0]


@router.get("/{company_id}")
async def get_company(
    company_id: str,
    user_id: str = Depends(get_current_user_id),
):
    client = get_client()
    result = (
        client.table("companies")
        .select("*, reports(*), analyses(*, valuation_results(*), dcf_parameters(*)), financial_metrics(*)")
        .eq("id", company_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Company not found")
    data = result.data
    # Sort analyses newest-first so analyses[0] is always the latest
    if data.get("analyses"):
        data["analyses"].sort(key=lambda a: a["created_at"], reverse=True)
    return data


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: str,
    user_id: str = Depends(require_admin),
):
    client = get_client()
    client.table("companies").delete().eq("id", company_id).eq("user_id", user_id).execute()
