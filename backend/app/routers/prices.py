from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user_id
from app.services.supabase_client import get_client
from app.services.price_fetcher import fetch_price
from app.schemas import PriceOut

router = APIRouter()


@router.get("/companies/{company_id}/price", response_model=PriceOut)
async def get_price(
    company_id: str,
    user_id: str = Depends(get_current_user_id),
):
    client = get_client()
    company = (
        client.table("companies")
        .select("ticker")
        .eq("id", company_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not company.data:
        raise HTTPException(status_code=404, detail="Company not found")

    ticker = company.data["ticker"]
    price = fetch_price(ticker)
    if price is None:
        raise HTTPException(status_code=502, detail=f"Could not fetch price for {ticker}")

    return {"ticker": ticker, "price": price}
