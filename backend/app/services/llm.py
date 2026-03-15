"""
LLM analysis service.

Builds a structured prompt from the company's financial metrics and
shareholder letter text, calls Claude, parses the response, and stores
the analysis. Valuation computation is delegated to valuation_service.
"""
import json
from typing import Optional, List
import anthropic
from app.config import settings
from app.services.supabase_client import get_client
from app.services.valuation_service import compute_and_store_valuation


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


def _parse_llm_response(raw: str) -> dict:
    """Strip markdown code fences if present and parse JSON."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip().rstrip("`").strip()
    return json.loads(text)


def run_analysis(company: dict, metrics: List[dict], user_id: str) -> str:
    """
    Orchestrates a full analysis run:
    1. Fetch shareholder letter text
    2. Call Claude for moat analysis
    3. Store analysis row
    4. Delegate valuation computation to valuation_service
    """
    client = get_client()

    # 1. Fetch shareholder letter text
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

    # 2. Call Claude
    claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_user_prompt(company, metrics, letter_text)}],
    )
    result = _parse_llm_response(message.content[0].text)

    # 3. Store analysis
    analysis_row = client.table("analyses").insert({
        "user_id": user_id,
        "company_id": company["id"],
        "llm_model": "claude-sonnet-4-6",
        "moat_verdict": result["moat_verdict"],
        "moat_types": result["moat_types"],
        "moat_reasoning": result["moat_reasoning"],
        "durability_assessment": result["durability_assessment"],
        "growth_rating": result["growth_rating"],
        "growth_reasoning": result["growth_reasoning"],
        "risk_rating": result["risk_rating"],
        "risk_reasoning": result["risk_reasoning"],
        "roc_rating": result["roc_rating"],
        "roc_reasoning": result["roc_reasoning"],
        "moat_duration_rating": result["moat_duration_rating"],
        "moat_duration_reasoning": result["moat_duration_reasoning"],
        "shareholder_letter_insights": result.get("shareholder_letter_insights"),
        "key_risks": result["key_risks"],
        "bottom_line": result["bottom_line"],
    }).execute()

    analysis_id = analysis_row.data[0]["id"]

    # 4. Delegate valuation computation
    compute_and_store_valuation(
        analysis_id=analysis_id,
        ticker=company["ticker"],
        metrics=metrics,
        dcf_params={
            "stage1_growth_rate": result["dcf_stage1_growth_rate"],
            "terminal_rate": result["dcf_terminal_rate"],
            "discount_rate": result["dcf_discount_rate"],
        },
    )

    return analysis_id
