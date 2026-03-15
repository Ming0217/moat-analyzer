"""
Valuation computation service.

Computes valuation ratios (P/S, P/B, P/E, P/FCF, earnings yield, cash return)
and runs the initial DCF model after an LLM analysis completes.

Extracted from llm.py to keep the LLM service focused on prompt building
and Claude interaction, while valuation math lives here.
"""
from typing import Optional, List, Dict, Any
from app.services.supabase_client import get_client
from app.services.price_fetcher import fetch_market_data, fetch_fx_rate
from app.services.dcf_calculator import calculate_dcf


def _resolve_fcf(latest: dict) -> Optional[float]:
    """
    Derive free cash flow from the most recent financial metrics row.
    Prefers GAAP OCF − capex; falls back to stored FCF with a sanity check.
    """
    _ocf = latest.get("operating_cash_flow")
    _capex = latest.get("capex")
    _stored_fcf = latest.get("free_cash_flow")

    if _ocf is not None and _capex is not None:
        return _ocf - abs(_capex)
    if _stored_fcf is not None:
        if _capex is not None and abs(_stored_fcf) < abs(_capex) * 0.05:
            return None
        return _stored_fcf
    return None


def compute_and_store_valuation(
    analysis_id: str,
    ticker: str,
    metrics: List[dict],
    dcf_params: Dict[str, Any],
) -> None:
    """
    Fetch live market data, compute valuation ratios, run DCF,
    and persist results to valuation_results + dcf_parameters tables.
    """
    client = get_client()

    # Fetch current price and market cap
    market_data = fetch_market_data(ticker)
    price = market_data["price"]
    live_market_cap = market_data["market_cap"]

    latest = metrics[-1] if metrics else {}

    # Resolve market cap: prefer live data, fall back to price × parsed shares
    if live_market_cap is not None:
        market_cap = live_market_cap
    else:
        shares = latest.get("shares_outstanding") or 0
        market_cap = (price * shares) if price and shares else None

    # Currency conversion: metrics may be in non-USD (e.g. RMB for 20-F filings)
    # while market_cap is always USD from Finnhub/yfinance.
    reporting_currency = latest.get("reporting_currency") or "USD"
    fx_rate = fetch_fx_rate(reporting_currency)

    if fx_rate and fx_rate != 1.0 and market_cap is not None:
        market_cap_local = market_cap * fx_rate
    else:
        market_cap_local = market_cap

    debt = latest.get("total_debt") or 0
    cash = latest.get("cash") or 0
    ev_local = (market_cap_local + debt - cash) if market_cap_local is not None else None
    ev_usd = (ev_local / fx_rate) if (ev_local is not None and fx_rate and fx_rate != 1.0) else ev_local

    revenue = latest.get("revenue") or None
    equity = latest.get("total_equity") or None
    net_income = latest.get("net_income") or None
    fcf = _resolve_fcf(latest)
    interest_exp = latest.get("interest_expense") or 0

    # Compute and store valuation ratios
    valuation = {
        "analysis_id": analysis_id,
        "share_price": price,
        "market_cap": market_cap,
        "enterprise_value": ev_usd,
        "ps_ratio": market_cap_local / revenue if market_cap_local and revenue else None,
        "pb_ratio": market_cap_local / equity if market_cap_local and equity else None,
        "pe_normalized": market_cap_local / net_income if market_cap_local and net_income else None,
        "p_fcf": market_cap_local / fcf if market_cap_local and fcf else None,
        "earnings_yield": net_income / market_cap_local if net_income and market_cap_local else None,
        "cash_return": (fcf + interest_exp) / ev_local if fcf and ev_local else None,
        "dcf_intrinsic_value_base": None,
        "dcf_intrinsic_value_bull": None,
        "dcf_intrinsic_value_bear": None,
    }
    client.table("valuation_results").insert(valuation).execute()

    # Store LLM-suggested DCF params
    client.table("dcf_parameters").insert({
        "analysis_id": analysis_id,
        "stage1_growth_rate": dcf_params["stage1_growth_rate"],
        "stage2_terminal_rate": dcf_params["terminal_rate"],
        "discount_rate": dcf_params["discount_rate"],
        "projection_years": 10,
    }).execute()

    # Auto-run DCF so intrinsic value is populated immediately
    base_fcf_usd = fcf
    if base_fcf_usd is not None and reporting_currency != "USD" and fx_rate:
        base_fcf_usd = base_fcf_usd / fx_rate

    shares_outstanding = (market_cap / price) if (market_cap and price) else None

    if base_fcf_usd is not None and shares_outstanding is not None:
        try:
            dcf_result = calculate_dcf(
                base_fcf=base_fcf_usd,
                stage1_growth_rate=dcf_params["stage1_growth_rate"],
                stage2_terminal_rate=dcf_params["terminal_rate"],
                discount_rate=dcf_params["discount_rate"],
                projection_years=10,
                shares_outstanding=shares_outstanding,
            )
            client.table("valuation_results").update({
                "dcf_intrinsic_value_base": dcf_result["intrinsic_value_per_share"],
                "dcf_intrinsic_value_bear": dcf_result["bear_per_share"],
                "dcf_intrinsic_value_bull": dcf_result["bull_per_share"],
            }).eq("analysis_id", analysis_id).execute()
        except (ValueError, ZeroDivisionError):
            pass
