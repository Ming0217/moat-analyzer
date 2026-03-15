"""
DCF calculator — pure math, no LLM.
Called by the /analyses/:id/dcf endpoint when the user moves sliders.
"""
from typing import Optional


def calculate_dcf(
    base_fcf: float,
    stage1_growth_rate: float,
    stage2_terminal_rate: float,
    discount_rate: float,
    projection_years: int,
    shares_outstanding: Optional[float],
) -> dict:
    """
    Two-stage DCF model.

    Stage 1: Project FCF for `projection_years` at `stage1_growth_rate`.
    Stage 2: Terminal value using the Gordon Growth Model.
    Discount all cash flows back to present value.
    """
    if discount_rate <= stage2_terminal_rate:
        raise ValueError("Discount rate must be greater than terminal growth rate.")

    # Stage 1: project and discount each year's FCF
    pv_stage1 = 0.0
    fcf = base_fcf
    for year in range(1, projection_years + 1):
        fcf *= (1 + stage1_growth_rate)
        pv_stage1 += fcf / (1 + discount_rate) ** year

    # Terminal value (Gordon Growth Model) at end of Stage 1
    terminal_fcf = fcf * (1 + stage2_terminal_rate)
    terminal_value = terminal_fcf / (discount_rate - stage2_terminal_rate)
    pv_terminal = terminal_value / (1 + discount_rate) ** projection_years

    intrinsic_value_total = pv_stage1 + pv_terminal

    # Per-share value
    intrinsic_value_per_share = (
        intrinsic_value_total / shares_outstanding if shares_outstanding else None
    )

    # Scenarios: bear (−30% on growth), bull (+30% on growth)
    bear = _scenario(base_fcf, stage1_growth_rate * 0.7, stage2_terminal_rate, discount_rate, projection_years, shares_outstanding)
    bull = _scenario(base_fcf, stage1_growth_rate * 1.3, stage2_terminal_rate, discount_rate, projection_years, shares_outstanding)

    return {
        "intrinsic_value_total": round(intrinsic_value_total, 2),
        "intrinsic_value_per_share": round(intrinsic_value_per_share, 2) if intrinsic_value_per_share else None,
        "pv_stage1": round(pv_stage1, 2),
        "pv_terminal": round(pv_terminal, 2),
        "bear_per_share": bear,
        "bull_per_share": bull,
        "params": {
            "stage1_growth_rate": stage1_growth_rate,
            "stage2_terminal_rate": stage2_terminal_rate,
            "discount_rate": discount_rate,
            "projection_years": projection_years,
        },
    }


def _scenario(
    base_fcf: float,
    stage1_growth_rate: float,
    stage2_terminal_rate: float,
    discount_rate: float,
    projection_years: int,
    shares_outstanding: Optional[float],
) -> Optional[float]:
    """Compute intrinsic value per share for a single scenario without recursion."""
    if discount_rate <= stage2_terminal_rate:
        return None
    pv = 0.0
    fcf = base_fcf
    for year in range(1, projection_years + 1):
        fcf *= (1 + stage1_growth_rate)
        pv += fcf / (1 + discount_rate) ** year
    terminal_value = (fcf * (1 + stage2_terminal_rate)) / (discount_rate - stage2_terminal_rate)
    pv += terminal_value / (1 + discount_rate) ** projection_years
    return round(pv / shares_outstanding, 2) if shares_outstanding else None
