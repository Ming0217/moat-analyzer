import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Navbar } from "@/components/layout/Navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useReanalyzing } from "@/contexts/ReanalyzingContext"
import { Plus, TrendingUp, TrendingDown, Minus, MoreVertical, RefreshCw, Trash2, Loader2 } from "lucide-react"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { MoatVerdict, ValuationResults } from "@/types"

// Shape returned by GET /companies (list endpoint)
interface CompanyListItem {
  id: string
  name: string
  ticker: string
  sector: string
  created_at: string
  analyses: {
    id: string
    moat_verdict: MoatVerdict
    moat_types: string[]
    created_at: string
    valuation_results: ValuationResults[]
  }[]
}

function moatVariant(verdict: MoatVerdict) {
  if (verdict === "wide") return "wide"
  if (verdict === "narrow") return "narrow"
  return "none"
}

function moatLabel(verdict: MoatVerdict) {
  if (verdict === "wide") return "Wide Moat"
  if (verdict === "narrow") return "Narrow Moat"
  return "No Moat"
}

function ValuationIndicator({ base, price }: { base: number; price: number }) {
  if (!base || !price) return <span className="text-muted-foreground text-sm">—</span>
  const pct = ((base - price) / price) * 100
  if (pct > 0)
    return <span className="flex items-center gap-1 text-sm text-emerald-600"><TrendingUp className="h-3.5 w-3.5" />{pct.toFixed(1)}% undervalued</span>
  return <span className="flex items-center gap-1 text-sm text-red-500"><TrendingDown className="h-3.5 w-3.5" />{Math.abs(pct).toFixed(1)}% overvalued</span>
}

export function DashboardPage() {
  const queryClient = useQueryClient()
  const { isReanalyzing, startReanalyzing, stopReanalyzing } = useReanalyzing()
  const [companyToDelete, setCompanyToDelete] = useState<CompanyListItem | null>(null)

  const { data: companies, isLoading } = useQuery<CompanyListItem[]>({
    queryKey: ["companies"],
    queryFn: () => api.get<CompanyListItem[]>("/companies"),
  })

  const handleDelete = async () => {
    if (!companyToDelete) return
    await api.del(`/companies/${companyToDelete.id}`)
    queryClient.invalidateQueries({ queryKey: ["companies"] })
    setCompanyToDelete(null)
  }

  const handleReanalyze = (company: CompanyListItem) => {
    startReanalyzing(company.id)
    api.post(`/companies/${company.id}/analyze`)
      .then(() => {
        toast.success(`${company.ticker} analysis complete`)
        queryClient.invalidateQueries({ queryKey: ["companies"] })
        queryClient.invalidateQueries({ queryKey: ["company", company.id] })
      })
      .catch(() => toast.error(`Failed to re-analyze ${company.ticker}`))
      .finally(() => stopReanalyzing(company.id))

    toast.info(`Re-analysis started for ${company.name}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {companies?.length ?? 0} {companies?.length === 1 ? "company" : "companies"} tracked
            </p>
          </div>
          <Button asChild>
            <Link to="/company/new">
              <Plus className="h-4 w-4" />
              Add Company
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-5 w-32 rounded bg-muted" /></CardHeader>
                <CardContent><div className="space-y-2"><div className="h-4 w-24 rounded bg-muted" /><div className="h-4 w-20 rounded bg-muted" /></div></CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && companies?.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
            <Minus className="mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No companies yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add your first company to start analyzing its economic moat.</p>
            <Button asChild className="mt-4">
              <Link to="/company/new"><Plus className="h-4 w-4" />Add Company</Link>
            </Button>
          </div>
        )}

        {!isLoading && companies && companies.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <div key={company.id} className="relative">
                  <Link to={`/company/${company.id}`}>
                    <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base">{company.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{company.ticker} · {company.sector}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {company.analyses?.[0] && (
                              <Badge variant={moatVariant(company.analyses[0].moat_verdict)}>
                                {moatLabel(company.analyses[0].moat_verdict)}
                              </Badge>
                            )}
                            {/* spacer to match the menu button width */}
                            <div className="h-9 w-9" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(() => {
                          const raw = company.analyses?.[0]?.valuation_results
                          const val = Array.isArray(raw) ? raw[0] : raw
                          return val ? (
                            <>
                              <ValuationIndicator
                                base={val.dcf_intrinsic_value_base}
                                price={val.share_price ?? 0}
                              />
                              <div className="text-sm text-muted-foreground">
                                {val.dcf_intrinsic_value_base
                                  ? <>Intrinsic value <span className="font-medium text-foreground">${val.dcf_intrinsic_value_base.toFixed(2)}</span></>
                                  : "No intrinsic value"
                                }
                                {val.share_price
                                  ? <> · Current <span className="font-medium text-foreground">${val.share_price.toFixed(2)}</span></>
                                  : null
                                }
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">No analysis yet</p>
                          )
                        })()}
                      </CardContent>
                    </Card>
                  </Link>
                  {/* Menu sits outside <Link> to avoid navigation conflicts */}
                  <div className="absolute top-3 right-3" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => { if (!isReanalyzing(company.id)) handleReanalyze(company) }}
                          disabled={isReanalyzing(company.id)}
                        >
                          {isReanalyzing(company.id)
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />}
                          {isReanalyzing(company.id) ? "Analyzing…" : "Re-analyze"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setCompanyToDelete(company)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>

            {/* Delete confirmation dialog — rendered once, outside all cards */}
            <AlertDialog open={!!companyToDelete} onOpenChange={(open) => { if (!open) setCompanyToDelete(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {companyToDelete?.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {companyToDelete?.ticker} and all its analyses. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </main>
    </div>
  )
}
