import { useState, useCallback, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Navbar } from "@/components/layout/Navbar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/hooks/useAuth"
import { useReanalyzing } from "@/contexts/ReanalyzingContext"
import { api } from "@/lib/api"
import { fmt$, fmtX, fmtPct, toFirst, MOAT_TYPE_LABELS, RATING_CLASSES } from "@/components/company/helpers"
import type { AnalysisFull, CompanyDetail } from "@/components/company/types"
import type { DriverRating, Report, ValuationResults, FinancialMetrics } from "@/types"
import {
  Loader2, Play, Info, RefreshCw, Upload,
  CheckCircle, AlertCircle, Clock, Trash2,
} from "lucide-react"

// ── Small reusable pieces ────────────────────────────────────────────────────

function RatingBadge({ rating }: { rating: DriverRating | null }) {
  if (!rating) return null
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${RATING_CLASSES[rating]}`}>
      {rating}
    </span>
  )
}

const PARSE_ICON = {
  pending:    <Clock      className="h-3.5 w-3.5 text-muted-foreground" />,
  processing: <Loader2    className="h-3.5 w-3.5 animate-spin text-amber-500" />,
  done:       <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
  failed:     <AlertCircle className="h-3.5 w-3.5 text-rose-500" />,
}

// ── Historical Profitability (DuPont) ────────────────────────────────────────

const DUPONT_TIPS = {
  netMargin:
    "Net income divided by revenue. Shows how much profit the company keeps from each dollar of sales. Higher and more consistent margins over time suggest pricing power — a hallmark of a real moat.",
  roa:
    "Net income divided by total assets. Measures how efficiently management converts the asset base into profit. Firms with durable moats typically earn ROA of 7%+ across a full economic cycle.",
  leverage:
    "Total assets divided by shareholders' equity (the DuPont equity multiplier). A ratio of 1.0 means no debt; higher means more leverage.",
  roe:
    "The DuPont product: Net Margin × Asset Turnover × Financial Leverage. Sustained ROE above 15% over a full decade is a strong signal that a real competitive advantage exists.",
}

function HistoricalMetricsCard({ metrics }: { metrics: FinancialMetrics[] }) {
  if (metrics.length === 0) return null

  const sorted = [...metrics].sort((a, b) => a.fiscal_year - b.fiscal_year)

  type Row = { year: number; netMargin: number | null; roa: number | null; leverage: number | null; roe: number | null }

  const rows: Row[] = sorted.map(m => {
    const approxAssets = (m.total_debt ?? 0) + (m.total_equity ?? 0)
    return {
      year:      m.fiscal_year,
      netMargin: m.revenue && m.revenue !== 0 ? (m.net_income / m.revenue) * 100 : null,
      roa:       approxAssets > 0 ? (m.net_income / approxAssets) * 100 : null,
      leverage:  m.total_equity && m.total_equity !== 0 ? approxAssets / m.total_equity : null,
      roe:       m.total_equity && m.total_equity !== 0 ? (m.net_income / m.total_equity) * 100 : null,
    }
  })

  function colAvg(key: keyof Omit<Row, "year">): number | null {
    const vals = rows.map(r => r[key]).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  function fmt(v: number | null, dec = 1): string {
    return v == null ? "—" : v.toFixed(dec)
  }

  const metricRows: { key: keyof Omit<Row, "year">; label: string; tip: string }[] = [
    { key: "netMargin", label: "Net Margin (%)",        tip: DUPONT_TIPS.netMargin },
    { key: "roa",       label: "Return on Assets (%)",  tip: DUPONT_TIPS.roa },
    { key: "leverage",  label: "Financial Leverage",     tip: DUPONT_TIPS.leverage },
    { key: "roe",       label: "Return on Equity (%)",  tip: DUPONT_TIPS.roe },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Historical Profitability</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 bg-background z-10 text-left font-medium text-muted-foreground py-2 pr-4 min-w-[160px]">Metric</th>
                {rows.map(r => (
                  <th key={r.year} className="text-right font-medium text-muted-foreground py-2 px-2 whitespace-nowrap min-w-[52px]">
                    {r.year}
                  </th>
                ))}
                <th className="text-right font-semibold py-2 pl-3 pr-1 whitespace-nowrap">Avg</th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map(m => (
                <tr key={m.key} className="border-b last:border-0">
                  <td className="sticky left-0 bg-background z-10 py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{m.label}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-pointer shrink-0" />
                        </PopoverTrigger>
                        <PopoverContent className="max-w-xs text-sm">{m.tip}</PopoverContent>
                      </Popover>
                    </div>
                  </td>
                  {rows.map(r => (
                    <td key={r.year} className="text-right py-2 px-2">
                      {fmt(r[m.key])}
                    </td>
                  ))}
                  <td className="text-right font-semibold py-2 pl-3 pr-1">
                    {fmt(colAvg(m.key))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Total assets estimated as total debt + total equity. Dorsey's moat screen: sustained ROE above 15% across a full economic cycle.
        </p>
      </CardContent>
    </Card>
  )
}

// ── Tab 1 — Moat Analysis ────────────────────────────────────────────────────

function MoatTab({ a, metrics }: { a: AnalysisFull; metrics: FinancialMetrics[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Moat Sources</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {(a.moat_types ?? []).map(t => (
              <span key={t} className="rounded-full bg-blue-100 text-blue-800 px-3 py-0.5 text-xs font-medium">
                {MOAT_TYPE_LABELS[t] ?? t}
              </span>
            ))}
          </div>
          <p className="text-sm leading-relaxed">{a.moat_reasoning}</p>
        </CardContent>
      </Card>
      <HistoricalMetricsCard metrics={metrics} />
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Moat Durability</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{a.durability_assessment}</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Key Risks</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{a.key_risks}</p></CardContent>
      </Card>
      <Card className="bg-muted/30">
        <CardHeader className="pb-2"><CardTitle className="text-base">Bottom Line</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{a.bottom_line}</p></CardContent>
      </Card>
    </div>
  )
}

// ── Tab 2 — Valuation Quality ────────────────────────────────────────────────

const DRIVER_TIPS: Record<string, string> = {
  growth: "How fast can the company grow earnings and cash flows? Growth only creates value when return on capital exceeds the cost of capital.",
  risk: "How predictable are the future cash flows? More certain businesses deserve a lower discount rate and a higher valuation multiple.",
  roc: "Return on capital — how efficiently invested capital is converted into profit. Sustained ROC above 10–15% is the fingerprint of a real moat.",
  moat_duration: "How many years can the company defend its advantage? A longer runway justifies paying a premium today.",
}

function QualityTab({ a }: { a: AnalysisFull }) {
  const drivers = [
    { key: "growth",        label: "Growth",            rating: a.growth_rating,        reasoning: a.growth_reasoning },
    { key: "risk",          label: "Risk / Certainty",  rating: a.risk_rating,          reasoning: a.risk_reasoning },
    { key: "roc",           label: "Return on Capital", rating: a.roc_rating,           reasoning: a.roc_reasoning },
    { key: "moat_duration", label: "Moat Duration",     rating: a.moat_duration_rating, reasoning: a.moat_duration_reasoning },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {drivers.map(d => (
        <Card key={d.key}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-semibold">{d.label}</CardTitle>
                <Popover>
                  <PopoverTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" /></PopoverTrigger>
                  <PopoverContent className="max-w-xs text-sm">{DRIVER_TIPS[d.key]}</PopoverContent>
                </Popover>
              </div>
              <RatingBadge rating={d.rating} />
            </div>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{d.reasoning ?? "—"}</p></CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Return Decomposition ─────────────────────────────────────────────────────

const RETURN_TIPS = {
  investmentReturn:
    "The portion of your return driven purely by the company's earnings growth. This is the return you can forecast with reasonable confidence.",
  speculativeReturn:
    "The portion driven by changes in the P/E ratio — what Dorsey calls the 'mood of the market'. Buying at a low P/E minimizes the risk of a negative speculative return.",
}

function ReturnDecompositionCard({ val, metrics }: { val: ValuationResults | undefined; metrics: FinancialMetrics[] }) {
  const epsHistory = metrics.filter(m => m.eps != null && m.eps > 0).sort((a, b) => a.fiscal_year - b.fiscal_year)
  const historicalGrowth = epsHistory.length >= 2
    ? Math.pow(epsHistory[epsHistory.length - 1].eps! / epsHistory[0].eps!, 1 / (epsHistory.length - 1)) - 1
    : null
  const currentPE = val?.pe_normalized ?? null
  const clampedHistGrowth = historicalGrowth != null ? Math.min(Math.max(historicalGrowth, -0.2), 0.4) : 0.1

  const [epsGrowth, setEpsGrowth] = useState(clampedHistGrowth)
  const [exitPE, setExitPE] = useState(currentPE ?? 15)
  const [holdingYears, setHoldingYears] = useState(5)

  const investmentReturn = epsGrowth
  const speculativeReturn = currentPE && currentPE > 0 ? Math.pow(exitPE / currentPE, 1 / holdingYears) - 1 : null
  const totalReturn = speculativeReturn != null ? (1 + investmentReturn) * (1 + speculativeReturn) - 1 : null

  function fmtRet(n: number | null): string {
    if (n == null) return "—"
    return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}% / yr`
  }
  function retColor(n: number | null): string {
    if (n == null) return ""
    return n >= 0 ? "text-emerald-600" : "text-rose-600"
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Investment &amp; Speculative Returns</h3>
      <Card>
        <CardContent className="p-6 space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Two things drive stock returns: the <strong>investment return</strong> (earnings growth) and the <strong>speculative return</strong> (change in the P/E multiple).
          </p>
          {currentPE != null && <div className="text-sm"><span className="text-muted-foreground">Current P/E: </span><strong>{currentPE.toFixed(1)}x</strong></div>}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">
                Expected EPS Growth Rate
                {historicalGrowth != null && <span className="ml-2 text-xs">(hist. {historicalGrowth >= 0 ? "+" : ""}{(historicalGrowth * 100).toFixed(1)}%/yr over {epsHistory.length - 1}y)</span>}
              </span>
              <span className="font-medium tabular-nums">{epsGrowth >= 0 ? "+" : ""}{(epsGrowth * 100).toFixed(1)}%</span>
            </div>
            <input type="range" min={-0.1} max={0.4} step={0.005} value={epsGrowth} onChange={e => setEpsGrowth(parseFloat(e.target.value))} className="w-full accent-primary" />
          </div>
          {currentPE != null && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Exit P/E <span className="ml-2 text-xs">(= current → zero speculative return)</span></span>
                <span className="font-medium tabular-nums">{exitPE.toFixed(1)}x</span>
              </div>
              <input type="range" min={5} max={60} step={0.5} value={exitPE} onChange={e => setExitPE(parseFloat(e.target.value))} className="w-full accent-primary" />
            </div>
          )}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Holding Period</span>
              <span className="font-medium tabular-nums">{holdingYears} yrs</span>
            </div>
            <input type="range" min={1} max={20} step={1} value={holdingYears} onChange={e => setHoldingYears(parseInt(e.target.value))} className="w-full accent-primary" />
          </div>
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Investment Return</span>
                <Popover><PopoverTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-pointer" /></PopoverTrigger><PopoverContent className="max-w-xs text-sm">{RETURN_TIPS.investmentReturn}</PopoverContent></Popover>
              </div>
              <span className={`font-semibold tabular-nums ${retColor(investmentReturn)}`}>{fmtRet(investmentReturn)}</span>
            </div>
            {speculativeReturn != null && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Speculative Return</span>
                  <Popover><PopoverTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-pointer" /></PopoverTrigger><PopoverContent className="max-w-xs text-sm">{RETURN_TIPS.speculativeReturn}</PopoverContent></Popover>
                </div>
                <span className={`font-semibold tabular-nums ${retColor(speculativeReturn)}`}>{fmtRet(speculativeReturn)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="font-semibold">{totalReturn != null ? "Total Expected Return" : "Investment Return (est.)"}</span>
              <span className={`text-lg font-bold tabular-nums ${retColor(totalReturn ?? investmentReturn)}`}>{fmtRet(totalReturn ?? investmentReturn)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Tab 3 — Valuation Tools ──────────────────────────────────────────────────

const VALUATION_TIPS: Record<string, string> = {
  ps_ratio:        "Price / Sales. Useful when earnings are temporarily depressed. Compare within the same sector.",
  pb_ratio:        "Price / Book Value. Most meaningful for capital-intensive businesses.",
  pe_normalized:   "Price / Normalized Earnings. Average earnings across a full economic cycle to smooth out peaks and troughs.",
  p_fcf:           "Price / Free Cash Flow — Dorsey's preferred multiple. FCF is harder to manipulate than GAAP earnings.",
  earnings_yield:  "Earnings / Price (inverse of P/E). Compare to the 10-year Treasury yield.",
  cash_return:     "(FCF + Net Interest) / Enterprise Value. Measures total cash returned relative to the entire capital structure.",
}

interface DcfSliderState {
  stage1_growth_rate: number
  stage2_terminal_rate: number
  discount_rate: number
  projection_years: number
}

interface DcfResult {
  intrinsic_value_per_share: number | null
  bear_per_share: number | null
  bull_per_share: number | null
}

function ToolsTab({ a, metrics }: { a: AnalysisFull; metrics: FinancialMetrics[] }) {
  const val   = toFirst(a.valuation_results)
  const init  = toFirst(a.dcf_parameters)

  const [sliders, setSliders] = useState<DcfSliderState>({
    stage1_growth_rate:   init?.stage1_growth_rate   ?? 0.10,
    stage2_terminal_rate: init?.stage2_terminal_rate ?? 0.03,
    discount_rate:        init?.discount_rate        ?? 0.09,
    projection_years:     init?.projection_years     ?? 10,
  })
  const slidersRef = useRef(sliders)
  slidersRef.current = sliders

  const [dcfResult, setDcfResult] = useState<DcfResult | null>(() =>
    val?.dcf_intrinsic_value_base != null
      ? { intrinsic_value_per_share: val.dcf_intrinsic_value_base, bear_per_share: val.dcf_intrinsic_value_bear ?? null, bull_per_share: val.dcf_intrinsic_value_bull ?? null }
      : null
  )
  const [dcfLoading, setDcfLoading] = useState(false)

  const runDcf = useCallback(async () => {
    setDcfLoading(true)
    try {
      const result = await api.post<DcfResult>(`/analyses/${a.id}/dcf`, slidersRef.current)
      setDcfResult(result)
    } finally {
      setDcfLoading(false)
    }
  }, [a.id])

  const multiples = [
    { key: "ps_ratio",       label: "P / S",           value: val?.ps_ratio,       fmt: fmtX   },
    { key: "pb_ratio",       label: "P / B",           value: val?.pb_ratio,       fmt: fmtX   },
    { key: "pe_normalized",  label: "P / E (norm.)",   value: val?.pe_normalized,  fmt: fmtX   },
    { key: "p_fcf",          label: "P / FCF",         value: val?.p_fcf,          fmt: fmtX   },
    { key: "earnings_yield", label: "Earnings Yield",  value: val?.earnings_yield, fmt: fmtPct },
    { key: "cash_return",    label: "Cash Return",     value: val?.cash_return,    fmt: fmtPct },
  ] as const

  const pctSliders = [
    { key: "stage1_growth_rate"   as const, label: "Stage 1 Growth Rate",    min: 0,    max: 0.30, step: 0.005 },
    { key: "stage2_terminal_rate" as const, label: "Terminal Growth Rate",   min: 0,    max: 0.05, step: 0.005 },
    { key: "discount_rate"        as const, label: "Discount Rate (WACC)",   min: 0.04, max: 0.20, step: 0.005 },
  ]

  return (
    <div className="space-y-8">
      {val && (
        <div className="flex flex-wrap gap-6 text-sm">
          <span><span className="text-muted-foreground">Price </span><strong>{fmt$(val.share_price)}</strong></span>
          <span><span className="text-muted-foreground">Mkt Cap </span><strong>{fmt$(val.market_cap)}</strong></span>
          <span><span className="text-muted-foreground">EV </span><strong>{fmt$(val.enterprise_value)}</strong></span>
        </div>
      )}
      {val?.share_price == null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Live price could not be fetched — price-based multiples are unavailable. Re-run the analysis to try again.
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold mb-3">Price Multiples &amp; Yields</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {multiples.map(m => (
            <Card key={m.key}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <Popover><PopoverTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-pointer shrink-0" /></PopoverTrigger><PopoverContent className="max-w-xs text-sm">{VALUATION_TIPS[m.key]}</PopoverContent></Popover>
                </div>
                <p className="text-xl font-bold">{m.fmt(m.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <ReturnDecompositionCard val={val} metrics={metrics} />
      <div>
        <h3 className="text-sm font-semibold mb-3">Discounted Cash Flow</h3>
        <Card>
          <CardContent className="p-6 space-y-5">
            {(() => {
              const latest = [...metrics].sort((a, b) => b.fiscal_year - a.fiscal_year)[0]
              if (!latest?.free_cash_flow) return null
              return (
                <div className="text-sm text-muted-foreground">
                  Base FCF: <strong className="text-foreground">{fmt$(latest.free_cash_flow)}</strong>
                  <span className="ml-1.5 text-xs">(FY{latest.fiscal_year})</span>
                </div>
              )
            })()}
            {pctSliders.map(s => (
              <div key={s.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums">{(sliders[s.key] * 100).toFixed(1)}%</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={sliders[s.key]}
                  onChange={e => setSliders(p => ({ ...p, [s.key]: parseFloat(e.target.value) }))}
                  onMouseUp={runDcf} onTouchEnd={runDcf} className="w-full accent-primary" />
              </div>
            ))}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Projection Years</span>
                <span className="font-medium tabular-nums">{sliders.projection_years} yrs</span>
              </div>
              <input type="range" min={5} max={20} step={1} value={sliders.projection_years}
                onChange={e => setSliders(p => ({ ...p, projection_years: parseInt(e.target.value) }))}
                onMouseUp={runDcf} onTouchEnd={runDcf} className="w-full accent-primary" />
            </div>
            {!dcfResult && !dcfLoading && <Button size="sm" onClick={runDcf} className="w-full">Calculate Intrinsic Value</Button>}
            {dcfLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2"><Loader2 className="h-4 w-4 animate-spin" />Calculating…</div>
            ) : dcfResult ? (
              <div className="pt-4 border-t space-y-3">
                <p className="text-xs text-muted-foreground">Intrinsic value per share</p>
                <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
                  <div><p className="text-xs text-muted-foreground mb-1">Bear</p><p className="text-lg font-bold text-rose-600">{fmt$(dcfResult.bear_per_share)}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Base</p><p className="text-xl sm:text-2xl font-bold">{fmt$(dcfResult.intrinsic_value_per_share)}</p></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Bull</p><p className="text-lg font-bold text-emerald-600">{fmt$(dcfResult.bull_per_share)}</p></div>
                </div>
                {val?.share_price != null && dcfResult.intrinsic_value_per_share != null && (
                  <p className="text-center text-xs text-muted-foreground">
                    Current price {fmt$(val.share_price)}{" · "}
                    {dcfResult.intrinsic_value_per_share >= val.share_price
                      ? <span className="text-emerald-600 font-medium">{fmtPct((dcfResult.intrinsic_value_per_share - val.share_price) / val.share_price)} upside</span>
                      : <span className="text-rose-600 font-medium">{fmtPct((val.share_price - dcfResult.intrinsic_value_per_share) / val.share_price)} downside</span>}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Tab 4 — Shareholder Letters ──────────────────────────────────────────────

function LettersTab({ a }: { a: AnalysisFull }) {
  return (
    <div>
      {a.shareholder_letter_insights ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Insights from Shareholder Letters</CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-relaxed">{a.shareholder_letter_insights}</p></CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No shareholder letter insights — upload a letter and re-run the analysis.</p>
      )}
    </div>
  )
}

// ── Tab 5 — Reports ──────────────────────────────────────────────────────────

const REPORT_TYPE_LABEL: Record<string, string> = {
  annual: "Annual Report",
  quarterly: "Quarterly Report",
  shareholder_letter: "Shareholder Letter",
}

function ReportsTab({ reports, companyId }: { reports: Report[]; companyId: string }) {
  const queryClient = useQueryClient()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [reparsingId, setReparsingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (reportId: string) => api.del(`/reports/${reportId}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["company", companyId] }); setConfirmId(null) },
  })
  const reparseMutation = useMutation({
    mutationFn: (reportId: string) => api.post(`/reports/${reportId}/reparse`),
    onMutate: (reportId) => setReparsingId(reportId),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ["company", companyId] }); setReparsingId(null) },
  })

  const groups = [
    { type: "annual",             items: reports.filter(r => r.report_type === "annual") },
    { type: "quarterly",          items: reports.filter(r => r.report_type === "quarterly") },
    { type: "shareholder_letter", items: reports.filter(r => r.report_type === "shareholder_letter") },
  ].filter(g => g.items.length > 0)

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No reports uploaded yet. Use <strong>Upload Reports</strong> to add files.</p>
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.type}>
          <h3 className="text-sm font-semibold mb-3">{REPORT_TYPE_LABEL[group.type]}s</h3>
          <div className="space-y-2">
            {group.items
              .sort((a, b) => b.fiscal_year - a.fiscal_year || (b.fiscal_quarter ?? 0) - (a.fiscal_quarter ?? 0))
              .map(r => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-y-1 rounded-lg border px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">FY {r.fiscal_year}{r.fiscal_quarter ? ` Q${r.fiscal_quarter}` : ""}</span>
                    <div className="flex items-center gap-1 text-muted-foreground capitalize">{PARSE_ICON[r.parse_status]}{r.parse_status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:block text-xs text-muted-foreground">
                      {new Date(r.upload_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {confirmId === r.id ? (
                      <>
                        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                          {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground" title="Re-parse" onClick={() => reparseMutation.mutate(r.id)} disabled={reparsingId === r.id}>
                          {reparsingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirmId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function CompanyPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const token = session?.access_token ?? ""
  const queryClient = useQueryClient()
  const { isReanalyzing } = useReanalyzing()
  const reanalyzingFromDashboard = !!id && isReanalyzing(id)

  const { data: company, isLoading, error } = useQuery<CompanyDetail>({
    queryKey: ["company", id],
    queryFn: () => api.get<CompanyDetail>(`/companies/${id}`),
    enabled: !!id && !!token,
  })

  const analyzeMutation = useMutation({
    mutationFn: () => api.post(`/companies/${id}/analyze`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company", id] }),
  })

  if (isLoading) {
    return (<div className="min-h-screen bg-background"><Navbar /><div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></div>)
  }
  if (error || !company) {
    return (<div className="min-h-screen bg-background"><Navbar /><div className="flex items-center justify-center h-[60vh] text-muted-foreground text-sm">Company not found.</div></div>)
  }

  const analysis = company.analyses?.[0] ?? null
  const analysisDate = analysis ? new Date(analysis.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{company.ticker} · {company.sector}</p>
            {analysisDate && <p className="text-xs text-muted-foreground mt-0.5">Last analyzed {analysisDate}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {analysis && <Badge variant={analysis.moat_verdict}>{analysis.moat_verdict === "wide" ? "Wide Moat" : analysis.moat_verdict === "narrow" ? "Narrow Moat" : "No Moat"}</Badge>}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/company/${id}/upload`}><Upload className="mr-2 h-3.5 w-3.5" />Upload Reports</Link>
              </Button>
              <Button size="sm" variant={analysis ? "outline" : "default"} onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || reanalyzingFromDashboard}>
                {analyzeMutation.isPending || reanalyzingFromDashboard
                  ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Analyzing…</>
                  : analysis ? <><RefreshCw className="mr-2 h-3.5 w-3.5" />Re-analyze</> : <><Play className="mr-2 h-3.5 w-3.5" />Run Analysis</>}
              </Button>
            </div>
          </div>
        </div>

        {analyzeMutation.isError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{(analyzeMutation.error as Error).message}</div>
        )}
        {analyzeMutation.isPending && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Claude is analyzing this company — this takes 30–120 seconds. Please wait…</div>
        )}
        {reanalyzingFromDashboard && !analyzeMutation.isPending && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />Re-analysis in progress — results will update automatically when complete.
          </div>
        )}

        <Tabs defaultValue={analysis ? "moat" : "reports"}>
          <TabsList className="mb-6 flex w-full">
            {analysis && <TabsTrigger value="moat" className="flex-1"><span className="sm:hidden">Moat</span><span className="hidden sm:inline">Moat Analysis</span></TabsTrigger>}
            {analysis && <TabsTrigger value="quality" className="flex-1"><span className="sm:hidden">Quality</span><span className="hidden sm:inline">Valuation Quality</span></TabsTrigger>}
            {analysis && <TabsTrigger value="tools" className="flex-1"><span className="sm:hidden">Tools</span><span className="hidden sm:inline">Valuation Tools</span></TabsTrigger>}
            {analysis && <TabsTrigger value="letters" className="flex-1"><span className="sm:hidden">Letters</span><span className="hidden sm:inline">Shareholder Letters</span></TabsTrigger>}
            <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
          </TabsList>
          {analysis && <TabsContent value="moat"><MoatTab a={analysis} metrics={company.financial_metrics ?? []} /></TabsContent>}
          {analysis && <TabsContent value="quality"><QualityTab a={analysis} /></TabsContent>}
          {analysis && <TabsContent value="tools"><ToolsTab a={analysis} metrics={company.financial_metrics ?? []} /></TabsContent>}
          {analysis && <TabsContent value="letters"><LettersTab a={analysis} /></TabsContent>}
          <TabsContent value="reports"><ReportsTab reports={company.reports} companyId={company.id} /></TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
