import type { DriverRating, Report, ValuationResults, DcfParameters, MoatVerdict, FinancialMetrics } from "@/types"

export interface AnalysisFull {
  id: string
  created_at: string
  llm_model: string
  moat_verdict: MoatVerdict
  moat_types: string[]
  moat_reasoning: string
  durability_assessment: string
  growth_rating: DriverRating | null
  growth_reasoning: string | null
  risk_rating: DriverRating | null
  risk_reasoning: string | null
  roc_rating: DriverRating | null
  roc_reasoning: string | null
  moat_duration_rating: DriverRating | null
  moat_duration_reasoning: string | null
  shareholder_letter_insights: string | null
  key_risks: string
  bottom_line: string
  valuation_results: ValuationResults[] | ValuationResults
  dcf_parameters: DcfParameters[] | DcfParameters
}

export interface CompanyDetail {
  id: string
  name: string
  ticker: string
  sector: string
  created_at: string
  reports: Report[]
  analyses: AnalysisFull[]
  financial_metrics: FinancialMetrics[]
}
