"""
LLM analysis service.

Builds a structured prompt from the company's financial metrics and
shareholder letter text, calls Claude, and parses the response into
the analyses and valuation_results tables.
"""
import json
from typing import Optional, List
import anthropic
from app.config import settings
from app.services.supabase_client import get_client
from app.services.price_fetcher import fetch_market_data, fetch_fx_rate
from app.services.dcf_calculator import calculate_dcf


SYSTEM_PROMPT = """You are a professional equity analyst trained in Pat Dorsey's economic moat framework
from "The Little Book That Builds Wealth." You analyze companies using a three-step process:

1. MOAT CHECK (Chapter 11): Examine historical returns on capital (ROE, ROIC, FCF margin).
   Strong, consistent returns above 10-15% suggest a moat.

2. MOAT IDENTIFICATION: Determine which moat type(s) apply:
   - Intangible assets (brands, patents, regulatory licenses)
   - Switching costs
   - Network effects
   - Cost advantages (scale, location, process)

3. VALUATION QUALITY (Chapter 12): Assess the four value drivers:
   - Growth potential
   - Risk / certainty of cash flows
   - Return on capital quality
   - Moat duration

4. VALUATION TOOLS (Chapter 13): Compute and interpret:
   - Normalized P/E (using average earnings across cycles)
   - P/S, P/B, P/FCF ratios
   - Earnings yield vs. 10-year Treasury
   - Cash return (FCF + net interest) / Enterprise Value
   - DCF assumptions (stage 1 growth, terminal rate, discount rate)

Return ONLY a valid JSON object matching the schema provided. No prose outside the JSON."""


def _build_user_prompt(company: dict, metrics: List[dict], shareholder_letter_text: Optional[str]) -> str:
    metrics_table = json.dumps(metrics, indent=2)
    letter_section = (
        f"\n\nSHAREHOLDER LETTER EXCERPTS:\n{shareholder_letter_text[:15000]}"
        if shareholder_letter_text
        else ""
    )
    return f"""Analyze this company using the Dorsey moat framework.

COMPANY: {company['name']} ({company['ticker']}) — {company['sector']}

HISTORICAL FINANCIAL METRICS (most recent years first):
{metrics_table}
{letter_section}

Return a JSON object with this exact schema:
{{
  "moat_verdict": "wide" | "narrow" | "none",
  "moat_types": ["intangible_assets" | "switching_costs" | "network_effects" | "cost_advantages"],
  "moat_reasoning": "string — detailed explanation referencing specific numbers",
  "durability_assessment": "string — how long the moat is likely to last and why",
  "growth_rating": "strong" | "moderate" | "weak",
  "growth_reasoning": "string",
  "risk_rating": "strong" | "moderate" | "weak",
  "risk_reasoning": "string",
  "roc_rating": "strong" | "moderate" | "weak",
  "roc_reasoning": "string",
  "moat_duration_rating": "strong" | "moderate" | "weak",
  "moat_duration_reasoning": "string",
  "shareholder_letter_insights": "string — capital allocation, candor, red flags (null if no letter)",
  "key_risks": "string — top 3-5 risks to the moat or valuation",
  "bottom_line": "string — 2-3 sentence investment summary",
  "dcf_stage1_growth_rate": number (e.g. 0.12),
  "dcf_terminal_rate": number (e.g. 0.03),
  "dcf_discount_rate": number (e.g. 0.09)
}}"""


def run_analysis(company: dict, metrics: List[dict], user_id: str) -> str:
    client = get_client()

    # Fetch shareholder letter text if available
    letters = (
        client.table("reports")
        .select("extracted_text")
        .eq("company_id", company["id"])
        .eq("report_type", "shareholder_letter")
        .eq("parse_status", "done")
        .order("fiscal_year", desc=True)
        .limit(3)
        .execute()
    )
    letter_text = "\n\n---\n\n".join(
        r["extracted_text"] for r in letters.data if r.get("extracted_text")
    ) or None

    # Fetch current price and market cap directly from market data
    market_data = fetch_market_data(company["ticker"])
    price = market_data["price"]
    live_market_cap = market_data["market_cap"]

    # Call Claude
    claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_user_prompt(company, metrics, letter_text)}],
    )
    raw = message.content[0].text.strip()
    # Strip markdown code fences if Claude wrapped the JSON
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip().rstrip("`").strip()
    result = json.loads(raw)

    # Store analysis
    analysis_row = client.table("analyses").insert({
        "user_id": user_id,
        "company_id": company["id"],
        "llm_model": "claude-sonnet-4-6",
        # Phase 1 — Moat
        "moat_verdict": result["moat_verdict"],
        "moat_types": result["moat_types"],
        "moat_reasoning": result["moat_reasoning"],
        "durability_assessment": result["durability_assessment"],
        # Phase 2 — Valuation quality drivers
        "growth_rating": result["growth_rating"],
        "growth_reasoning": result["growth_reasoning"],
        "risk_rating": result["risk_rating"],
        "risk_reasoning": result["risk_reasoning"],
        "roc_rating": result["roc_rating"],
        "roc_reasoning": result["roc_reasoning"],
        "moat_duration_rating": result["moat_duration_rating"],
        "moat_duration_reasoning": result["moat_duration_reasoning"],
        # Summary
        "shareholder_letter_insights": result.get("shareholder_letter_insights"),
        "key_risks": result["key_risks"],
        "bottom_line": result["bottom_line"],
    }).execute()

    analysis_id = analysis_row.data[0]["id"]

    # Compute valuation ratios from latest metrics (empty dict if no structured data)
    latest = metrics[-1] if metrics else {}
    # Use live market cap from yfinance — PDF-parsed shares_outstanding is unreliable
    # because scale ("in millions/thousands") varies by filing and is not applied to shares.
    # Fall back to price × parsed shares only if live market cap is unavailable.
    if live_market_cap is not None:
        market_cap = live_market_cap
    else:
        shares = latest.get("shares_outstanding") or 0
        market_cap = (price * shares) if price and shares else None

    # Currency conversion: financial metrics may be in a non-USD currency (e.g. RMB for
    # Chinese 20-F filings) while market_cap is always in USD from Finnhub/yfinance.
    # Convert market_cap to the reporting currency so ratios are dimensionally consistent.
    reporting_currency = latest.get("reporting_currency") or "USD"
    fx_rate = fetch_fx_rate(reporting_currency)  # units of reporting currency per 1 USD

    if fx_rate and fx_rate != 1.0 and market_cap is not None:
        # Express market cap in the same currency as the financial statements
        market_cap_local = market_cap * fx_rate
    else:
        market_cap_local = market_cap

    debt = latest.get("total_debt") or 0
    cash = latest.get("cash") or 0
    # ev_local is in the reporting currency — used for yield-based ratios (cash_return)
    # so that numerator (FCF) and denominator (EV) are in the same currency.
    ev_local = (market_cap_local + debt - cash) if market_cap_local is not None else None
    # ev_usd converts back to USD for display (EV shown on the Valuation Tools page).
    ev_usd = (ev_local / fx_rate) if (ev_local is not None and fx_rate and fx_rate != 1.0) else ev_local
    revenue = latest.get("revenue") or None
    equity = latest.get("total_equity") or None
    net_income = latest.get("net_income") or None
    _ocf        = latest.get("operating_cash_flow")
    _capex      = latest.get("capex")
    _stored_fcf = latest.get("free_cash_flow")

    if _ocf is not None and _capex is not None:
        # Most reliable: GAAP OCF − capex
        fcf = _ocf - abs(_capex)
    elif _stored_fcf is not None:
        # Sanity check: reject stored FCF when it's implausibly small vs. capex.
        # This catches non-GAAP "Free Cash Flow" labels that match the wrong table row
        # (e.g., a YoY change column showing "-3" in millions instead of the actual value).
        if _capex is not None and abs(_stored_fcf) < abs(_capex) * 0.05:
            fcf = None
        else:
            fcf = _stored_fcf
    else:
        fcf = None
    interest_exp = latest.get("interest_expense") or 0

    valuation = {
        "analysis_id": analysis_id,
        "share_price": price,
        "market_cap": market_cap,  # always USD for display
        "enterprise_value": ev_usd,  # USD for display
        "ps_ratio": market_cap_local / revenue if market_cap_local and revenue else None,
        "pb_ratio": market_cap_local / equity if market_cap_local and equity else None,
        "pe_normalized": market_cap_local / net_income if market_cap_local and net_income else None,
        "p_fcf": market_cap_local / fcf if market_cap_local and fcf else None,
        "earnings_yield": net_income / market_cap_local if net_income and market_cap_local else None,
        "cash_return": (fcf + interest_exp) / ev_local if fcf and ev_local else None,
        "dcf_intrinsic_value_base": None,  # Set after DCF calc
        "dcf_intrinsic_value_bull": None,
        "dcf_intrinsic_value_bear": None,
    }
    client.table("valuation_results").insert(valuation).execute()

    # Store LLM-suggested DCF params
    client.table("dcf_parameters").insert({
        "analysis_id": analysis_id,
        "stage1_growth_rate": result["dcf_stage1_growth_rate"],
        "stage2_terminal_rate": result["dcf_terminal_rate"],
        "discount_rate": result["dcf_discount_rate"],
        "projection_years": 10,
    }).execute()

    # Auto-run DCF with LLM-suggested parameters so intrinsic value is populated immediately.
    # FCF is in reporting currency — convert to USD so it's consistent with market_cap.
    base_fcf_usd = fcf
    if base_fcf_usd is not None and reporting_currency != "USD" and fx_rate:
        base_fcf_usd = base_fcf_usd / fx_rate

    shares_outstanding = (market_cap / price) if (market_cap and price) else None

    if base_fcf_usd is not None and shares_outstanding is not None:
        try:
            dcf_result = calculate_dcf(
                base_fcf=base_fcf_usd,
                stage1_growth_rate=result["dcf_stage1_growth_rate"],
                stage2_terminal_rate=result["dcf_terminal_rate"],
                discount_rate=result["dcf_discount_rate"],
                projection_years=10,
                shares_outstanding=shares_outstanding,
            )
            client.table("valuation_results").update({
                "dcf_intrinsic_value_base": dcf_result["intrinsic_value_per_share"],
                "dcf_intrinsic_value_bear": dcf_result["bear_per_share"],
                "dcf_intrinsic_value_bull": dcf_result["bull_per_share"],
            }).eq("analysis_id", analysis_id).execute()
        except (ValueError, ZeroDivisionError):
            pass  # Invalid params (e.g. discount_rate ≤ terminal_rate) — leave DCF as null

    return analysis_id
