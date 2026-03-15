import { Link } from "react-router-dom"
import { Navbar } from "@/components/layout/Navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-4 border-primary/30 pl-4 py-1 text-sm text-muted-foreground italic leading-relaxed">
      {children}
    </blockquote>
  )
}

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {number}
      </div>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

function Tip({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums mt-0.5">
        {number}
      </span>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  )
}

export function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Back link + title */}
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Portfolio
          </Link>
          <h1 className="text-3xl font-bold">Dorsey's Moat Investing Methodology</h1>
          <p className="text-muted-foreground mt-1">
            A reference guide based on <em>The Little Book That Builds Wealth</em> by Pat Dorsey (Chapters 11–13)
          </p>
        </div>

        {/* The Game Plan */}
        <Card className="mb-8 bg-muted/40">
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">The Two-Step Game Plan</h2>
            <div className="space-y-2">
              <div className="flex gap-3 text-sm">
                <span className="font-bold text-primary shrink-0">Step 1.</span>
                <span>Find wonderful businesses with durable economic moats — companies that can fend off competition and earn excess returns on capital for many years.</span>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="font-bold text-primary shrink-0">Step 2.</span>
                <span>Wait until shares trade for <em>less than their intrinsic value</em>, then buy. Price paid is the single biggest determinant of future returns.</span>
              </div>
            </div>
            <Quote>
              "The best business in the world will be a bad investment if purchased at an unattractive price."
            </Quote>
          </CardContent>
        </Card>

        <div className="space-y-12">

          {/* ── SECTION 1: Identify the Moat ─────────────────────────────────── */}
          <section>
            <SectionHeader
              number="1"
              title="Identify the Economic Moat"
              subtitle="Chapter 11 — Three steps from returns data to moat verdict"
            />

            <div className="space-y-4">

              {/* 3-step process */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">The 3-Step Moat Process</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-bold text-primary">1</div>
                    <div>
                      <p className="font-medium text-sm">Show Me the Money</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Check historical returns on capital (ROE, ROIC, FCF margin) over <strong>at least a full decade</strong>. Strong, consistent returns above 10–15% suggest a moat exists. Poor returns — unless the business has structurally changed — mean no moat. A competitive advantage should always show up in the numbers.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-bold text-primary">2</div>
                    <div>
                      <p className="font-medium text-sm">Identify the Source of Advantage</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Ask <em>why</em> those returns are high and will stay high. Looking only at the track record is "driving by looking in the rearview mirror." Apply competitive analysis: Does the company have a brand, patents, switching costs, network effects, or cost advantages? Without a specific structural reason, high returns can disappear quickly.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-bold text-primary">3</div>
                    <div>
                      <p className="font-medium text-sm">Assess Moat Durability</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Judge how long the advantage will last. Some moats are real but bridgeable; others are wide enough to forecast high returns for many years. Dorsey uses three categories: <strong>Wide Moat</strong> (durable, decades), <strong>Narrow Moat</strong> (real but less certain), <strong>No Moat</strong>.
                      </p>
                      <Quote>"Some moats last for decades, while others are less durable."</Quote>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4 moat sources */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">The 4 Sources of Economic Moat</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      {
                        label: "Intangible Assets",
                        color: "bg-blue-100 text-blue-800",
                        body: "Brands, patents, or regulatory licenses that let a company charge premium prices or block competitors. A brand only constitutes a moat if it reliably leads to pricing power — not just recognition.",
                      },
                      {
                        label: "Switching Costs",
                        color: "bg-purple-100 text-purple-800",
                        body: "When the time, money, or risk of moving to a competitor is high, customers stay put. Enterprise software, payroll processors, and financial data providers often enjoy this advantage. High switching costs protect pricing power even without a well-known brand.",
                      },
                      {
                        label: "Network Effects",
                        color: "bg-emerald-100 text-emerald-800",
                        body: "A product or service becomes more valuable as more people use it, making it harder for new entrants to compete. Exchanges, credit card networks, and social platforms are classic examples — each new user strengthens the moat for all existing users.",
                      },
                      {
                        label: "Cost Advantages",
                        color: "bg-amber-100 text-amber-800",
                        body: "Sustainably lower costs from scale, location, processes, or unique access to resources allow the firm to undercut rivals or earn better margins at the same price. Relevant especially in commodity or price-sensitive industries where the low-cost producer wins.",
                      },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg border p-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mb-2 ${m.color}`}>{m.label}</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">{m.body}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Note: Efficient scale (a market too small to support more than one competitor) is sometimes cited as a fifth source, but Dorsey considers it a variant of cost advantages.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ── SECTION 2: Valuation Quality ─────────────────────────────────── */}
          <section>
            <SectionHeader
              number="2"
              title="Assess What the Company Is Worth"
              subtitle="Chapter 12 — The four value drivers and the investment vs. speculative return"
            />

            <div className="space-y-4">

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Intrinsic Value: The Core Idea</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Quote>
                    "A stock is worth the present value of all the cash it will generate in the future. That's it."
                  </Quote>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Companies create value by investing capital and generating a return on that investment. Free cash flow — what's left after operating expenses and capital expenditures — is "owner earnings." It's the money that could be extracted from the business each year without harming operations. The present value of that stream is what you should pay.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You don't need to know the <em>precise</em> value. You only need to know that the current price is lower than the most likely value — and by enough margin to absorb being wrong.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">The 4 Drivers of Valuation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      {
                        label: "Growth",
                        badge: "bg-emerald-100 text-emerald-800",
                        body: "How fast can the company grow its earnings and cash flows? More growth means a higher present value — but only when return on capital exceeds cost of capital. Growth at a low return on capital actually destroys value. Always ask whether reinvestment earns more than it costs.",
                      },
                      {
                        label: "Risk",
                        badge: "bg-rose-100 text-rose-800",
                        body: "How certain and predictable are the future cash flows? More predictable businesses deserve a lower discount rate and higher valuation multiples. Companies with economic moats tend to have lower risk because their competitive position makes cash flows more reliable.",
                      },
                      {
                        label: "Return on Capital",
                        badge: "bg-blue-100 text-blue-800",
                        body: "How much capital must the company reinvest to sustain growth? A business that grows with minimal reinvestment (capital-light) is worth far more than one requiring heavy capital expenditure for the same growth rate. High ROC means each dollar retained creates more than a dollar of value.",
                      },
                      {
                        label: "Moat Duration",
                        badge: "bg-purple-100 text-purple-800",
                        body: "How many years can the company fend off competitors and sustain excess returns? A longer competitive runway dramatically increases intrinsic value because you can reliably project high cash flows further into the future. Wide moats deserve a premium for this reason alone.",
                      },
                    ].map(d => (
                      <div key={d.label} className="rounded-lg border p-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mb-2 ${d.badge}`}>{d.label}</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">{d.body}</p>
                      </div>
                    ))}
                  </div>
                  <Quote>
                    "A company that has the potential to grow for a long time, with low capital investment, little competition, and reasonable risk, is potentially worth a lot more than one with similar growth prospects but lower returns on capital and an uncertain competitive outlook."
                  </Quote>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Investment Return vs. Speculative Return</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Over long periods, two things drive a stock's total return:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-100">
                      <p className="text-sm font-semibold text-emerald-800 mb-1">Investment Return</p>
                      <p className="text-sm text-emerald-700">Driven by earnings growth and dividends — the company's actual financial performance. This is what you can forecast with reasonable confidence when the company has a moat.</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-4 border border-amber-100">
                      <p className="text-sm font-semibold text-amber-800 mb-1">Speculative Return</p>
                      <p className="text-sm text-amber-700">Driven by changes in the P/E multiple — the mood of the market.</p>
                      <Quote>"No one knows what a stock's speculative returns will be over the next five or 10 years."</Quote>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong>The practical implication:</strong> Buying at a low P/E minimizes the risk of a negative speculative return. Microsoft compounded earnings at 16%/yr over a decade but delivered only 7%/yr to shareholders because the P/E contracted from 50× to 20×. Careful valuation ties your returns to something you can forecast (earnings growth) rather than something you can't (market sentiment).
                  </p>
                </CardContent>
              </Card>

            </div>
          </section>

          {/* ── SECTION 3: Valuation Tools ───────────────────────────────────── */}
          <section>
            <SectionHeader
              number="3"
              title="Apply the Valuation Tools"
              subtitle="Chapter 13 — Price multiples, yield measures, and five tips for finding stocks on sale"
            />

            <div className="space-y-4">

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Price Multiples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">P/S</Badge>
                      <span className="text-sm font-medium">Price / Sales</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Useful when earnings are temporarily depressed or negative — almost every company has sales even in a downturn. Best for finding <strong>high-margin companies that have hit a speed bump</strong>: a low P/S with historically strong margins suggests the market is pricing in permanent damage that may not materialize. <em>Do not compare P/S across industries</em> — a low-margin retailer will always look "cheap" versus a high-margin software company.
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">P/B</Badge>
                      <span className="text-sm font-medium">Price / Book Value</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Most useful for <strong>financial services firms</strong> (banks, insurers), where assets are liquid and book value closely reflects tangible value. Less meaningful for asset-light or intangible-heavy businesses — Harley-Davidson's brand doesn't appear in book value, which is why a P/B of 5× is rational. Watch for goodwill inflation from acquisitions; subtract it for a cleaner picture. An <em>abnormally low</em> P/B for a bank can signal that book value is in question (bad loans, write-offs pending).
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">P/E</Badge>
                      <span className="text-sm font-medium">Price / Normalized Earnings</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      The most common multiple, but easily misused. Avoid forward consensus estimates — they tend to be too pessimistic before a recovery and too optimistic before a slowdown. <strong>Dorsey's preferred approach: use your own estimate</strong> of average earnings across good years and bad — a normalized "E" based on your own research. A P/E only has meaning in context: compare against the same company over time, peers, or the market — always adjusted for differences in growth, ROC, and competitive position.
                    </p>
                    <Quote>
                      "Look at how the company has performed in good times and bad, do some thinking about whether the future will be a lot better or worse than the past, and come up with your own estimate of how much the company could earn in an average year."
                    </Quote>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">P/FCF</Badge>
                      <span className="text-sm font-medium">Price / Free Cash Flow</span>
                      <span className="text-xs text-primary font-medium">Dorsey's Favorite</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Free cash flow is harder to manipulate than GAAP earnings and gives a more accurate picture of profit potential. Especially useful for subscription and prepayment businesses (which collect cash before delivering the service) — these companies often look expensive on P/E but reasonable on P/FCF. Note the limitation: cash flow ignores depreciation, so asset-heavy businesses with lots of depreciating fixed assets can look artificially cheap.
                    </p>
                  </div>

                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Yield-Based Measures</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Yield-based metrics are valuable because you can benchmark them directly against bond yields — providing an objective hurdle rate.
                  </p>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">E/P</Badge>
                      <span className="text-sm font-medium">Earnings Yield (inverse of P/E)</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Flip the P/E ratio: earnings ÷ price. A P/E of 15 = 6.7% earnings yield. Compare this directly to the 10-year Treasury yield. If earnings yield exceeds the bond yield, equities may offer an attractive risk premium — especially since the equity earnings stream will generally <em>grow</em> over time while bond coupons are fixed.
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">(FCF + Net Interest) / EV</Badge>
                      <span className="text-sm font-medium">Cash Return</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <strong>Formula:</strong> (Free Cash Flow + Net Interest Expense) ÷ Enterprise Value<br />
                      <strong>Enterprise Value</strong> = Market Cap + Long-Term Debt − Cash
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      Tells you how much free cash flow the entire capital structure (equity + debt) generates relative to what it would cost to buy the whole business. Improves on earnings yield because it uses FCF (owner earnings) and incorporates the debt burden — making it comparable across companies with different capital structures. Think of it like the rental yield on an apartment building you buy outright after paying off the mortgage.
                    </p>
                    <Quote>
                      "Cash return tells us how much free cash flow a company is generating relative to the cost of buying the whole company, including its debt burden."
                    </Quote>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">5 Tips for Finding Undervalued Stocks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tip number={1}>
                    <strong>Always remember the four drivers:</strong> risk, return on capital, competitive advantage, and growth. Pay less for riskier stocks; pay more for high ROC, strong moats, and robust growth. These drivers compound each other — never focus on growth alone (PEG ratio) and forget that growth at a high ROC is worth far more than growth at a low ROC.
                  </Tip>
                  <Tip number={2}>
                    <strong>Use multiple tools.</strong> If one metric says cheap, apply two or three more. When multiple measures align — low P/FCF, attractive earnings yield, cash return above bond yields — it's a strong signal. "The stars won't always align, but when they do, it's a good indication that you've found a truly undervalued company."
                  </Tip>
                  <Tip number={3}>
                    <strong>Be patient.</strong> Wonderful businesses rarely trade at great prices. Keep a watch list of high-quality companies at prices you'd love to own them. Wait, then pounce. "There are no called strikes in investing" (Buffett, as cited by Dorsey). Not making money beats losing money.
                  </Tip>
                  <Tip number={4}>
                    <strong>Be tough — buy when others won't.</strong> Great businesses get cheap when the headlines are bad and investors overreact. You must buy when everyone else is selling. It's uncomfortable, but that's exactly when the margin of safety is widest and the expected return is highest.
                  </Tip>
                  <Tip number={5}>
                    <strong>Be yourself — do your own work.</strong> Decisions grounded in your own research are easier to hold through volatility. If you understand the moat and believe the stock is below intrinsic value, you can act with conviction. Relying entirely on outside tips means you'll constantly second-guess yourself — and buy high and sell low.
                  </Tip>
                </CardContent>
              </Card>

            </div>
          </section>

          {/* ── Quick Reference ───────────────────────────────────────────────── */}
          <section>
            <Card className="bg-muted/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Reference Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="font-semibold mb-2">Moat Check</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>☐ ROE &gt; 15% sustained over 10 years?</li>
                      <li>☐ ROIC &gt; 10–15% across cycles?</li>
                      <li>☐ FCF margin healthy and consistent?</li>
                      <li>☐ Identified moat source (1 of 4)?</li>
                      <li>☐ Moat duration: wide / narrow / none?</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Quality Check</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>☐ Growth: strong / moderate / weak?</li>
                      <li>☐ Cash flow predictability (risk)?</li>
                      <li>☐ Capital-light or capital-intensive?</li>
                      <li>☐ Moat duration rating confirmed?</li>
                      <li>☐ Investment return forecast reasonable?</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Valuation Check</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>☐ P/FCF vs. peers and history?</li>
                      <li>☐ Normalized P/E (your own "E")?</li>
                      <li>☐ Earnings yield vs. 10-yr Treasury?</li>
                      <li>☐ Cash return vs. bond yields?</li>
                      <li>☐ DCF intrinsic value vs. current price?</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </main>
    </div>
  )
}
