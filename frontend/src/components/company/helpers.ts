import type { DriverRating } from "@/types"

export function fmt$(n: number | null | undefined): string {
  if (n == null) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

export function fmtX(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toFixed(1)}x`
}

export function fmtPct(n: number | null | undefined): string {
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`
}

export function toFirst<T>(x: T[] | T | undefined): T | undefined {
  if (!x) return undefined
  return Array.isArray(x) ? x[0] : x
}

export const MOAT_TYPE_LABELS: Record<string, string> = {
  intangible_assets: "Intangible Assets",
  switching_costs:   "Switching Costs",
  network_effects:   "Network Effects",
  cost_advantages:   "Cost Advantages",
}

export const RATING_CLASSES: Record<DriverRating, string> = {
  strong:   "bg-emerald-100 text-emerald-800",
  moderate: "bg-amber-100   text-amber-800",
  weak:     "bg-rose-100    text-rose-800",
}
