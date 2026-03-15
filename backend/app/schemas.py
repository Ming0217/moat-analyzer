"""
Pydantic response models for API endpoints.

These models serve as the contract between backend and frontend,
catch schema drift at serialization time, and generate OpenAPI docs.
"""
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict


class _Base(BaseModel):
    """Base model that tolerates extra fields from Supabase responses."""
    model_config = ConfigDict(from_attributes=True, extra="ignore")


# ── Shared / nested models ────────────────────────────────────────────────────

class ValuationResultsOut(_Base):
    id: str
    analysis_id: str
    share_price: Optional[float] = None
    market_cap: Optional[float] = None
    enterprise_value: Optional[float] = None
    ps_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    pe_normalized: Optional[float] = None
    p_fcf: Optional[float] = None
    earnings_yield: Optional[float] = None
    cash_return: Optional[float] = None
    dcf_intrinsic_value_base: Optional[float] = None
    dcf_intrinsic_value_bull: Optional[float] = None
    dcf_intrinsic_value_bear: Optional[float] = None


class DcfParametersOut(_Base):
    id: str
    analysis_id: str
    stage1_growth_rate: float
    stage2_terminal_rate: float
    discount_rate: float
    projection_years: int
    updated_at: Optional[str] = None


class ReportOut(_Base):
    id: str
    company_id: str
    report_type: str
    fiscal_year: int
    fiscal_quarter: Optional[int] = None
    storage_path: str
    upload_date: str
    parse_status: str
    parse_error: Optional[str] = None


class FinancialMetricsOut(_Base):
    id: str
    company_id: str
    fiscal_year: int
    revenue: Optional[float] = None
    net_income: Optional[float] = None
    operating_income: Optional[float] = None
    total_equity: Optional[float] = None
    total_debt: Optional[float] = None
    cash: Optional[float] = None
    capex: Optional[float] = None
    operating_cash_flow: Optional[float] = None
    free_cash_flow: Optional[float] = None
    book_value_per_share: Optional[float] = None
    eps: Optional[float] = None
    interest_expense: Optional[float] = None
    shares_outstanding: Optional[float] = None
    reporting_currency: Optional[str] = None
    roe: Optional[float] = None
    roic: Optional[float] = None
    fcf_margin: Optional[float] = None


# ── Analysis models ───────────────────────────────────────────────────────────

MoatVerdict = Literal["wide", "narrow", "none"]
DriverRating = Literal["strong", "moderate", "weak"]


class AnalysisSummaryOut(_Base):
    """Nested in company list — lightweight."""
    id: str
    moat_verdict: MoatVerdict
    moat_types: List[str]
    created_at: str
    valuation_results: List[ValuationResultsOut] = []


class AnalysisFullOut(_Base):
    """Full analysis with all fields — used in company detail."""
    id: str
    created_at: str
    llm_model: str
    moat_verdict: MoatVerdict
    moat_types: List[str]
    moat_reasoning: str
    durability_assessment: str
    growth_rating: Optional[DriverRating] = None
    growth_reasoning: Optional[str] = None
    risk_rating: Optional[DriverRating] = None
    risk_reasoning: Optional[str] = None
    roc_rating: Optional[DriverRating] = None
    roc_reasoning: Optional[str] = None
    moat_duration_rating: Optional[DriverRating] = None
    moat_duration_reasoning: Optional[str] = None
    shareholder_letter_insights: Optional[str] = None
    key_risks: str
    bottom_line: str
    valuation_results: List[ValuationResultsOut] = []
    dcf_parameters: List[DcfParametersOut] = []


# ── Company models ────────────────────────────────────────────────────────────

class CompanyOut(_Base):
    """Base company fields."""
    id: str
    user_id: str
    name: str
    ticker: str
    sector: str
    created_at: str


class CompanyListItemOut(CompanyOut):
    """Company with latest analysis summary — used in dashboard list."""
    analyses: List[AnalysisSummaryOut] = []


class CompanyDetailOut(CompanyOut):
    """Full company detail with all nested data."""
    reports: List[ReportOut] = []
    analyses: List[AnalysisFullOut] = []
    financial_metrics: List[FinancialMetricsOut] = []


# ── Simple response models ────────────────────────────────────────────────────

class AnalysisTriggerOut(_Base):
    analysis_id: str
    status: str


class ReportProcessingOut(_Base):
    report_id: str
    status: str


class PriceOut(_Base):
    ticker: str
    price: float


class MeOut(_Base):
    user_id: str
    companies_count: int


class TokenOut(_Base):
    id: str
    name: str
    prefix: str
    scope: str
    created_at: str
    last_used_at: Optional[str] = None


class TokenCreatedOut(TokenOut):
    """Returned only on creation — includes the raw token."""
    token: str


class DcfResultOut(_Base):
    intrinsic_value_total: float
    intrinsic_value_per_share: Optional[float] = None
    pv_stage1: float
    pv_terminal: float
    bear_per_share: Optional[float] = None
    bull_per_share: Optional[float] = None
    params: dict
