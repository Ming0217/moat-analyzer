import asyncio
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user_id, require_write
from app.services.supabase_client import get_client
from app.services.llm import run_analysis
from app.schemas import AnalysisTriggerOut, AnalysisFullOut

router = APIRouter()


@router.post("/companies/{company_id}/analyze", status_code=202, response_model=AnalysisTriggerOut)
async def trigger_analysis(
    company_id: str,
    user_id: str = Depends(require_write),
):
    """
    Trigger a full LLM analysis run for a company.
    Reads all parsed financial metrics + shareholder letter text,
    calls Claude, and stores results in analyses + valuation_results.
    """
    client = get_client()

    company = client.table("companies").select("*").eq("id", company_id).eq("user_id", user_id).single().execute()
    if not company.data:
        raise HTTPException(status_code=404, detail="Company not found")

    # Check that at least one report of any type has been successfully parsed
    processed = (
        client.table("reports")
        .select("id")
        .eq("company_id", company_id)
        .eq("parse_status", "done")
        .limit(1)
        .execute()
    )
    if not processed.data:
        raise HTTPException(
            status_code=422,
            detail="No processed reports found. Upload at least one report and wait for parsing to complete.",
        )

    # Financial metrics may be empty if only shareholder letters were uploaded.
    # The LLM can still deliver qualitative moat analysis from the letter text.
    metrics = (
        client.table("financial_metrics")
        .select("*")
        .eq("company_id", company_id)
        .order("fiscal_year")
        .execute()
    )

    # run_analysis is a synchronous function (uses sync Anthropic + Supabase clients).
    # Running it in a thread pool releases the event loop so FastAPI can serve
    # other requests (e.g. GET /companies/:id) while the LLM call is in flight.
    analysis_id = await asyncio.to_thread(
        run_analysis,
        company=company.data,
        metrics=metrics.data,
        user_id=user_id,
    )

    return {"analysis_id": analysis_id, "status": "complete"}


@router.get("/companies/{company_id}/analyses", response_model=list[AnalysisFullOut])
async def list_analyses(
    company_id: str,
    user_id: str = Depends(get_current_user_id),
):
    client = get_client()
    result = (
        client.table("analyses")
        .select("*, valuation_results(*), dcf_parameters(*)")
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data
