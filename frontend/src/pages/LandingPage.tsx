import { Link } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import { CastleIcon } from "@/components/icons/CastleIcon"
import {
  Shield, TrendingUp, Calculator, FileText, Sun, Moon,
} from "lucide-react"

const FEATURES = [
  {
    icon: Shield,
    title: "Moat Identification",
    description:
      "AI-powered analysis identifies intangible assets, switching costs, network effects, and cost advantages using Pat Dorsey's framework.",
  },
  {
    icon: TrendingUp,
    title: "Valuation Quality",
    description:
      "Assess growth potential, risk, return on capital, and moat duration — the four drivers that determine what a business is worth.",
  },
  {
    icon: Calculator,
    title: "Interactive DCF",
    description:
      "Adjust growth rates, discount rates, and projection years with live sliders. See bear, base, and bull intrinsic values instantly.",
  },
  {
    icon: FileText,
    title: "Filing Analysis",
    description:
      "Upload 10-K, 10-Q, 20-F filings or shareholder letters. Financial metrics are extracted automatically — no manual data entry.",
  },
]

export function LandingPage() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <CastleIcon className="h-10 w-10 shrink-0" />
              <span>MoatAnalyzer</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggle} className="text-muted-foreground hover:text-foreground" aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              {user ? (
                <Button asChild size="sm">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/signup">Get started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Find the Moat<br />Know the Value
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Upload company filings, and let AI identify economic moats,
          compute valuation metrics, and build an interactive DCF model
          — all in one place.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          {user ? (
            <Button size="lg" asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild>
                <Link to="/signup">Get started — it's free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
        <div className="grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Built on Pat Dorsey's "The Little Book That Builds Wealth"</p>
          <div className="flex gap-4">
            <Link to="/methodology" className="hover:text-foreground transition-colors">Methodology</Link>
            <Link to="/api-docs" className="hover:text-foreground transition-colors">API</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
