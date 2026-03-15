export type MoatVerdict = "wide" | "narrow" | "none"
export type ReportType = "annual" | "quarterly" | "shareholder_letter"
export type ParseStatus = "pending" | "processing" | "done" | "failed"
export type DriverRating = "strong" | "moderate" | "weak"

export interface Company {
  id: string
  user_id: string
  name: string
  ticker: string
  sector: string
  created_at: string
  latest_analysis?: Analysis
  current_price?: number
}

export interface Report {
  id: string
  company_id: string
  report_type: ReportType
  fiscal_year: number
  fiscal_quarter: number | null
  storage_path: string
  upload_date: string
  parse_status: ParseStatus
}

export interface FinancialMetrics {
  id: string
  company_id: string
  fiscal_year: number
  revenue: number
  net_income: number
  operating_income: number
  total_equity: number
  total_debt: number
  cash: number
  capex: number
  operating_cash_flow: number
  free_cash_flow: number
  book_value_per_share: number
  eps: number
  interest_expense: number
  // Computed on the backend
  roe: number
  roic: number
  fcf_margin: number
}

export interface Analysis {
  id: string
  company_id: string
  created_at: string
  llm_model: string
  // Phase 1 — Moat
  moat_verdict: MoatVerdict
  moat_types: string[]
  moat_reasoning: string
  durability_assessment: string
  // Phase 2 — Valuation quality drivers
  growth_rating: DriverRating | null
  growth_reasoning: string | null
  risk_rating: DriverRating | null
  risk_reasoning: string | null
  roc_rating: DriverRating | null
  roc_reasoning: string | null
  moat_duration_rating: DriverRating | null
  moat_duration_reasoning: string | null
  // Summary
  shareholder_letter_insights: string | null
  key_risks: string
  bottom_line: string
  // Nested from API join (arrays because of Supabase select)
  valuation_results?: ValuationResults[]
  dcf_parameters?: DcfParameters[]
}

export interface ValuationResults {
  id: string
  analysis_id: string
  share_price: number
  market_cap: number
  enterprise_value: number
  ps_ratio: number
  pb_ratio: number
  pe_normalized: number
  p_fcf: number
  earnings_yield: number
  cash_return: number
  dcf_intrinsic_value_base: number
  dcf_intrinsic_value_bull: number
  dcf_intrinsic_value_bear: number
}

export interface DcfParameters {
  id: string
  analysis_id: string
  stage1_growth_rate: number
  stage2_terminal_rate: number
  discount_rate: number
  projection_years: number
  updated_at: string
}
