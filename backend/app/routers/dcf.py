from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import require_write
from app.services.supabase_client import get_client
from app.services.dcf_calculator import calculate_dcf
from app.services.price_fetcher import fetch_fx_rate
from app.schemas import DcfResultOut

router = APIRouter()


class DcfParams(BaseModel):
    stage1_growth_rate: float   # e.g. 0.12 for 12%
    stage2_terminal_rate: float # e.g. 0.03 for 3%
    discount_rate: float        # e.g. 0.09 for 9%
    projection_years: int       # e.g. 10


@router.post("/analyses/{analysis_id}/dcf", response_model=DcfResultOut)
async def recalculate_dcf(
    analysis_id: str,
    params: DcfParams,
    user_id: str = Depends(require_write),
):
    """
    Recalculate intrinsic value with user-supplied assumptions.
    Pure math — no LLM call. Returns result in < 100ms.
    """
    client = get_client()

    analysis = (
        client.table("analyses")
        .select("id, company_id, valuation_results(share_price, market_cap, enterprise_value)")
        .eq("id", analysis_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not analysis.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    metrics = (
        client.table("financial_metrics")
        .select("fiscal_year, free_cash_flow, operating_cash_flow, capex, reporting_currency")
        .eq("company_id", analysis.data["company_id"])
        .order("fiscal_year", desc=True)
        .limit(1)
        .execute()
    )
    if not metrics.data:
        raise HTTPException(status_code=422, detail="No financial metrics found")

    row = metrics.data[0]
    _ocf, _capex, _stored = row.get("operating_cash_flow"), row.get("capex"), row.get("free_cash_flow")
    if _ocf is not None and _capex is not None:
        base_fcf = _ocf - abs(_capex)
    elif _stored is not None and (_capex is None or abs(_stored) >= abs(_capex) * 0.05):
        base_fcf = _stored
    else:
        base_fcf = None

    if base_fcf is None:
        raise HTTPException(status_code=422, detail="No reliable FCF available for DCF calculation")

    # Convert base_fcf to USD if financial metrics are in a foreign currency.
    # DCF produces a total firm value; dividing by shares (derived from USD market cap)
    # requires both to be in the same currency.
    reporting_currency = row.get("reporting_currency") or "USD"
    if reporting_currency != "USD":
        fx_rate = fetch_fx_rate(reporting_currency)
        if fx_rate:
            base_fcf = base_fcf / fx_rate

    shares_outstanding = (
        analysis.data["valuation_results"]["market_cap"]
        / analysis.data["valuation_results"]["share_price"]
    ) if analysis.data.get("valuation_results") else None

    result = calculate_dcf(
        base_fcf=base_fcf,
        stage1_growth_rate=params.stage1_growth_rate,
        stage2_terminal_rate=params.stage2_terminal_rate,
        discount_rate=params.discount_rate,
        projection_years=params.projection_years,
        shares_outstanding=shares_outstanding,
    )

    # Persist updated params
    client.table("dcf_parameters").upsert(
        {"analysis_id": analysis_id, **params.model_dump()},
        on_conflict="analysis_id",
    ).execute()

    # Write DCF values back to valuation_results so the dashboard can display them
    client.table("valuation_results").update({
        "dcf_intrinsic_value_base": result["intrinsic_value_per_share"],
        "dcf_intrinsic_value_bear": result["bear_per_share"],
        "dcf_intrinsic_value_bull": result["bull_per_share"],
    }).eq("analysis_id", analysis_id).execute()

    return result
