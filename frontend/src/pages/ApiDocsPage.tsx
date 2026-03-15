import { useState } from "react"
import { Link } from "react-router-dom"
import { Navbar } from "@/components/layout/Navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Check } from "lucide-react"

const API_BASE = import.meta.env.VITE_API_URL as string

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground"
      onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative">
      <pre className="rounded-md bg-muted px-4 py-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <CopyButton value={code} />
    </div>
  )
}

type HttpMethod = "GET" | "POST" | "DELETE"

function MethodBadge({ method }: { method: HttpMethod }) {
  const cls: Record<HttpMethod, string> = {
    GET:    "bg-emerald-100 text-emerald-800 border-emerald-200",
    POST:   "bg-blue-100    text-blue-800    border-blue-200",
    DELETE: "bg-rose-100    text-rose-800    border-rose-200",
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-semibold ${cls[method]}`}>
      {method}
    </span>
  )
}

interface Endpoint {
  method: HttpMethod
  path: string
  summary: string
  description: string
  auth: boolean
  body?: string
  response: string
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/me",
    summary: "Verify authentication",
    description: "Returns the authenticated user's ID and portfolio size. Use this to confirm a token is valid.",
    auth: true,
    response: `{
  "user_id": "uuid",
  "companies_count": 3
}`,
  },
  {
    method: "GET",
    path: "/companies",
    summary: "List portfolio",
    description: "Returns all companies in the user's portfolio, each with the latest analysis and valuation summary.",
    auth: true,
    response: `[
  {
    "id": "uuid",
    "name": "Apple Inc.",
    "ticker": "AAPL",
    "sector": "Technology",
    "created_at": "2024-01-01T00:00:00Z",
    "analyses": [
      {
        "id": "uuid",
        "moat_verdict": "wide",        // "wide" | "narrow" | "none"
        "moat_types": ["switching_costs", "intangible_assets"],
        "created_at": "2024-01-01T00:00:00Z",
        "valuation_results": [
          {
            "share_price": 189.50,
            "market_cap": 2940000000000,
            "dcf_intrinsic_value_base": 210.00,
            "dcf_intrinsic_value_bear": 160.00,
            "dcf_intrinsic_value_bull": 265.00,
            "pe_normalized": 28.5,
            "p_fcf": 31.2,
            "earnings_yield": 0.035,
            "cash_return": 0.041
          }
        ]
      }
    ]
  }
]`,
  },
  {
    method: "POST",
    path: "/companies",
    summary: "Add a company",
    description: "Creates a new company entry in the portfolio. After creating, upload reports via the web UI, then trigger analysis.",
    auth: true,
    body: `{
  "name": "Apple Inc.",
  "ticker": "AAPL",
  "sector": "Technology"
}`,
    response: `{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Apple Inc.",
  "ticker": "AAPL",
  "sector": "Technology",
  "created_at": "2024-01-01T00:00:00Z"
}`,
  },
  {
    method: "GET",
    path: "/companies/{company_id}",
    summary: "Get company detail",
    description: "Returns full company data including all analyses, valuation results, DCF parameters, financial metrics history, and uploaded reports.",
    auth: true,
    response: `{
  "id": "uuid",
  "name": "Apple Inc.",
  "ticker": "AAPL",
  "sector": "Technology",
  "reports": [ { "id": "uuid", "report_type": "annual", "fiscal_year": 2023, "parse_status": "done" } ],
  "financial_metrics": [ { "fiscal_year": 2023, "revenue": 394000000000, "net_income": 96995000000, "roe": 1.47 } ],
  "analyses": [
    {
      "id": "uuid",
      "moat_verdict": "wide",
      "moat_types": ["switching_costs", "intangible_assets"],
      "moat_reasoning": "...",
      "durability_assessment": "...",
      "growth_rating": "moderate",    // "strong" | "moderate" | "weak"
      "risk_rating": "strong",
      "roc_rating": "strong",
      "moat_duration_rating": "strong",
      "key_risks": "...",
      "bottom_line": "...",
      "valuation_results": [ { ... } ],
      "dcf_parameters": [ { "stage1_growth_rate": 0.08, "stage2_terminal_rate": 0.03, "discount_rate": 0.09, "projection_years": 10 } ]
    }
  ]
}`,
  },
  {
    method: "DELETE",
    path: "/companies/{company_id}",
    summary: "Delete a company",
    description: "Permanently removes the company and all associated analyses, reports, and financial metrics.",
    auth: true,
    response: `// 204 No Content`,
  },
  {
    method: "POST",
    path: "/companies/{company_id}/analyze",
    summary: "Trigger analysis",
    description: "Runs a full LLM analysis (moat identification, valuation quality, DCF) using Claude. Requires at least one successfully parsed report. Takes 30–120 seconds. The request returns immediately with status 202; results are written to the database and the DCF is auto-calculated with LLM-suggested parameters.",
    auth: true,
    response: `{
  "analysis_id": "uuid",
  "status": "complete"
}`,
  },
  {
    method: "POST",
    path: "/analyses/{analysis_id}/dcf",
    summary: "Recalculate DCF",
    description: "Pure-math DCF recalculation with custom assumptions. No LLM call — returns in under 100ms. Results are persisted to the database.",
    auth: true,
    body: `{
  "stage1_growth_rate": 0.10,      // Stage 1 FCF growth (e.g. 0.10 = 10%)
  "stage2_terminal_rate": 0.03,    // Terminal growth rate (e.g. 0.03 = 3%)
  "discount_rate": 0.09,           // WACC / discount rate (e.g. 0.09 = 9%)
  "projection_years": 10           // Number of Stage 1 years
}`,
    response: `{
  "intrinsic_value_per_share": 210.50,
  "bear_per_share": 160.20,
  "bull_per_share": 268.40,
  "intrinsic_value_total": 3245000000000,
  "pv_stage1": 980000000000,
  "pv_terminal": 2265000000000,
  "params": { "stage1_growth_rate": 0.10, "stage2_terminal_rate": 0.03, "discount_rate": 0.09, "projection_years": 10 }
}`,
  },
  {
    method: "GET",
    path: "/companies/{company_id}/price",
    summary: "Get live price",
    description: "Fetches the current market price for the company's ticker via yfinance. Useful for checking whether the current price has moved relative to the stored intrinsic value.",
    auth: true,
    response: `{
  "ticker": "AAPL",
  "price": 189.50
}`,
  },
  {
    method: "GET",
    path: "/tokens",
    summary: "List access tokens",
    description: "Returns all Personal Access Tokens for the current user. The raw token is never returned — only the prefix for identification.",
    auth: true,
    response: `[
  {
    "id": "uuid",
    "name": "My AI Assistant",
    "prefix": "mat_a3f2b1",
    "created_at": "2024-01-01T00:00:00Z",
    "last_used_at": "2024-02-15T10:30:00Z"
  }
]`,
  },
  {
    method: "POST",
    path: "/tokens",
    summary: "Create access token",
    description: "Generates a new PAT. The full token is returned only once — store it securely. Subsequent calls to GET /tokens will only show the prefix.",
    auth: true,
    body: `{
  "name": "My AI Assistant"
}`,
    response: `{
  "id": "uuid",
  "name": "My AI Assistant",
  "prefix": "mat_a3f2b1",
  "token": "mat_a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",  // shown ONCE
  "created_at": "2024-01-01T00:00:00Z",
  "last_used_at": null
}`,
  },
  {
    method: "DELETE",
    path: "/tokens/{token_id}",
    summary: "Revoke access token",
    description: "Permanently revokes a PAT. Any agent using this token will immediately receive 401 Unauthorized.",
    auth: true,
    response: `// 204 No Content`,
  },
]

const PYTHON_EXAMPLE = `import httpx

BASE_URL = "${API_BASE}"
TOKEN = "mat_your_token_here"

headers = {"Authorization": f"Bearer {TOKEN}"}

# Verify token
me = httpx.get(f"{BASE_URL}/me", headers=headers).json()
print(f"Authenticated as {me['user_id']}, {me['companies_count']} companies")

# List portfolio
companies = httpx.get(f"{BASE_URL}/companies", headers=headers).json()
for c in companies:
    analysis = c["analyses"][0] if c["analyses"] else None
    val = analysis["valuation_results"][0] if analysis and analysis["valuation_results"] else None
    intrinsic = val["dcf_intrinsic_value_base"] if val else "N/A"
    print(f"{c['ticker']:6} | moat={analysis['moat_verdict'] if analysis else 'none':6} | intrinsic=\${intrinsic}")

# Trigger re-analysis for a specific company
company_id = companies[0]["id"]
result = httpx.post(f"{BASE_URL}/companies/{company_id}/analyze", headers=headers, timeout=180)
print(result.json())

# Custom DCF with your own assumptions
analysis_id = companies[0]["analyses"][0]["id"]
dcf = httpx.post(
    f"{BASE_URL}/analyses/{analysis_id}/dcf",
    headers=headers,
    json={"stage1_growth_rate": 0.08, "stage2_terminal_rate": 0.025, "discount_rate": 0.10, "projection_years": 10},
).json()
print(f"Intrinsic value: \${dcf['intrinsic_value_per_share']} (bear: \${dcf['bear_per_share']}, bull: \${dcf['bull_per_share']})")
`

const CURL_EXAMPLE = `# Set your token
export TOKEN="mat_your_token_here"
export BASE="${API_BASE}"

# Verify auth
curl -H "Authorization: Bearer $TOKEN" $BASE/me

# List portfolio
curl -H "Authorization: Bearer $TOKEN" $BASE/companies

# Trigger analysis
curl -X POST -H "Authorization: Bearer $TOKEN" $BASE/companies/{company_id}/analyze

# Custom DCF
curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"stage1_growth_rate":0.08,"stage2_terminal_rate":0.025,"discount_rate":0.10,"projection_years":10}' \\
  $BASE/analyses/{analysis_id}/dcf
`

export function ApiDocsPage() {
  const [tab, setTab] = useState<"python" | "curl">("python")

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Portfolio
          </Link>
          <h1 className="text-3xl font-bold">API Reference</h1>
          <p className="text-muted-foreground mt-1">
            Integrate MoatAnalyzer with your AI agent or external tools using Personal Access Tokens.
          </p>
        </div>

        <div className="space-y-8">

          {/* Authentication */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All API requests require a <strong>Bearer token</strong> in the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Authorization</code> header.
                Generate a Personal Access Token from the <Link to="/settings/tokens" className="text-primary hover:underline">Tokens settings page</Link>.
              </p>
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Base URL</p>
                <CodeBlock code={API_BASE} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Request header</p>
                <CodeBlock code={`Authorization: Bearer mat_a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1`} />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                Tokens grant full read/write access to your portfolio. Never expose them in client-side code or public repositories. Revoke compromised tokens immediately from the <Link to="/settings/tokens" className="underline">Tokens page</Link>.
              </div>
            </CardContent>
          </Card>

          {/* Quick start */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 border-b pb-3">
                <Button size="sm" variant={tab === "python" ? "default" : "ghost"} className="h-7 px-3 text-xs" onClick={() => setTab("python")}>Python</Button>
                <Button size="sm" variant={tab === "curl" ? "default" : "ghost"} className="h-7 px-3 text-xs" onClick={() => setTab("curl")}>cURL</Button>
              </div>
              <CodeBlock code={tab === "python" ? PYTHON_EXAMPLE : CURL_EXAMPLE} language={tab === "python" ? "python" : "bash"} />
            </CardContent>
          </Card>

          {/* Endpoint reference */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Endpoints</h2>
            <div className="space-y-4">
              {ENDPOINTS.map(ep => (
                <Card key={`${ep.method}-${ep.path}`}>
                  <CardContent className="pt-5 space-y-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <MethodBadge method={ep.method} />
                      <code className="text-sm font-mono font-semibold">{ep.path}</code>
                      <span className="text-sm text-muted-foreground">{ep.summary}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ep.description}</p>

                    {ep.body && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Request body</p>
                        <CodeBlock code={ep.body} language="json" />
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Response</p>
                      <CodeBlock code={ep.response} language="json" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Agent tips */}
          <Card className="bg-muted/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tips for AI Agents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Start every session with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /me</code> to confirm the token is valid and get the user context.</p>
              <p>• Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /companies</code> for a quick portfolio overview; use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /companies/{"{id}"}</code> when you need full analysis text, financial metrics, or DCF parameters.</p>
              <p>• <code className="text-xs bg-muted px-1.5 py-0.5 rounded">POST /companies/{"{id}"}/analyze</code> is a long-running call (30–120 s) — set your HTTP client timeout accordingly (e.g. 180 s).</p>
              <p>• The <code className="text-xs bg-muted px-1.5 py-0.5 rounded">POST /analyses/{"{id}"}/dcf</code> endpoint is pure math and returns in &lt;100 ms — safe to call repeatedly with different assumptions to explore scenarios.</p>
              <p>• <code className="text-xs bg-muted px-1.5 py-0.5 rounded">moat_verdict</code> is one of <code className="text-xs bg-muted px-1.5 py-0.5 rounded">"wide"</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">"narrow"</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">"none"</code>. Driver ratings are <code className="text-xs bg-muted px-1.5 py-0.5 rounded">"strong"</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">"moderate"</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">"weak"</code>.</p>
              <p>• All monetary values are in USD. Rates are decimals (0.10 = 10%). Timestamps are ISO 8601 UTC.</p>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}
