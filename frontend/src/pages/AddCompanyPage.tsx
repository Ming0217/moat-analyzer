import { useState, useRef, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Navbar } from "@/components/layout/Navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import {
  Upload, FileText, X, CheckCircle2, AlertCircle, Loader2, ChevronRight, Building2
} from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL as string

const SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Consumer Staples",
  "Consumer Discretionary", "Industrials", "Energy", "Materials",
  "Utilities", "Real Estate", "Communication Services",
]

const REPORT_TYPE_LABELS: Record<string, string> = {
  annual: "Annual Report (10-K)",
  quarterly: "Quarterly Report (10-Q)",
  shareholder_letter: "Shareholder Letter",
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - i)

// ─── Filename heuristics ────────────────────────────────────────────────────

function extractFiscalYear(filename: string): number {
  const shortCurrent = CURRENT_YEAR % 100 // e.g. 26 for 2026

  // 0. SEC EDGAR fiscal-period date embedded in filename: ticker-YYYYMMDD[x|.]
  //    e.g. pdd-20241231x20f.htm → 2024  (filing date 2025-04-28 is irrelevant)
  //    This must be checked BEFORE the generic 4-digit scan so the filing-date
  //    prefix "2025-04-28_..." doesn't win over the actual period-end year.
  const secDate = filename.match(/(\d{4})(\d{2})(\d{2})(?:x|\.)/i)
  if (secDate) {
    const y = parseInt(secDate[1])
    if (y >= 2000 && y <= CURRENT_YEAR) return y
  }

  // 1. Prefer unambiguous 4-digit year (2000–CURRENT_YEAR)
  const fourDigit = filename.match(/\b(20\d{2})\b/)
  if (fourDigit) {
    const y = parseInt(fourDigit[1])
    if (y <= CURRENT_YEAR) return y
  }

  // 2. Fall back to 2-digit year shorthand (e.g. "24" → 2024).
  //    Try contextual patterns from most to least specific so we don't
  //    accidentally grab quarter digits or other numbers.
  const twoDigitPatterns: RegExp[] = [
    /\bfy(\d{2})\b/i,          // FY24
    /q[1-4][-_](\d{2})\b/i,   // Q4-24
    /[-_](\d{2})[-_]/,         // -24- or _24_
    /[-_](\d{2})\b/,           // trailing -24 or _24
    /\b(\d{2})[-_]/,           // leading 24- or 24_
  ]
  for (const pattern of twoDigitPatterns) {
    const m = filename.match(pattern)
    if (m) {
      const yr = parseInt(m[1])
      if (yr >= 0 && yr <= shortCurrent) return 2000 + yr
    }
  }

  return CURRENT_YEAR - 1 // safe default
}

function parseFilename(filename: string): Pick<FileEntry, "reportType" | "fiscalYear" | "fiscalQuarter"> {
  // Normalise: lowercase, treat separators as spaces
  const s = filename.toLowerCase().replace(/[_\-\.]/g, " ")

  // Report type — check most-specific patterns first
  let reportType: ReportType = "annual"
  if (/10[\s]?q|quarterly/.test(s)) {
    reportType = "quarterly"
  } else if (/letter|shareholder|chairman/.test(s)) {
    reportType = "shareholder_letter"
  } else if (/10[\s]?k|annual/.test(s)) {
    reportType = "annual"
  }

  const fiscalYear = extractFiscalYear(filename)

  // Quarter (only meaningful for quarterly reports)
  let fiscalQuarter: number | null = null
  if (reportType === "quarterly") {
    const qMatch = s.match(/q([1-4])/)
    fiscalQuarter = qMatch ? parseInt(qMatch[1]) : 1
  }

  return { reportType, fiscalYear, fiscalQuarter }
}

type ReportType = "annual" | "quarterly" | "shareholder_letter"
type FileStatus = "pending" | "uploading" | "done" | "error"

interface FileEntry {
  id: string
  file: File
  reportType: ReportType
  fiscalYear: number
  fiscalQuarter: number | null
  status: FileStatus
  error?: string
}

// ─── Step indicators ───────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Company details", "Upload reports", "Processing"]
  return (
    <div className="overflow-x-auto mb-8">
      <div className="flex items-center gap-2 min-w-max">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
              ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span className={`text-sm ${active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
          </div>
        )
      })}
      </div>
    </div>
  )
}

// ─── Step 1: Company details ────────────────────────────────────────────────

function Step1({
  onNext,
}: {
  onNext: (companyId: string) => void
}) {
  const { session } = useAuth()
  const [name, setName] = useState("")
  const [ticker, setTicker] = useState("")
  const [sector, setSector] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name, ticker: ticker.toUpperCase(), sector }),
      })
      if (!res.ok) throw new Error("Failed to create company")
      const company = await res.json() as { id: string }
      onNext(company.id)
    } catch {
      setError("Failed to create company. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Company details
        </CardTitle>
        <CardDescription>Enter the company you want to analyze.</CardDescription>
      </CardHeader>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" placeholder="e.g. Apple Inc." value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticker">Ticker symbol</Label>
            <Input
              id="ticker"
              placeholder="e.g. AAPL"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="uppercase"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sector</Label>
            <Select value={sector} onValueChange={setSector} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a sector" />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !sector}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Continue"}
          </Button>
        </CardContent>
      </form>
    </Card>
  )
}

// ─── Step 2: File upload ────────────────────────────────────────────────────

function FileRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: FileEntry
  onUpdate: (id: string, patch: Partial<FileEntry>) => void
  onRemove: (id: string) => void
}) {
  const isPending = entry.status === "pending"

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{entry.file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            ({(entry.file.size / 1024 / 1024).toFixed(1)} MB)
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {entry.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {entry.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
          {isPending && (
            <button onClick={() => onRemove(entry.id)} className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {entry.status === "error" && (
        <p className="text-xs text-destructive">{entry.error}</p>
      )}

      {isPending && (
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[160px] space-y-1">
            <Label className="text-xs">Report type <span className="text-muted-foreground font-normal">(auto-detected)</span></Label>
            <Select
              value={entry.reportType}
              onValueChange={(v) => onUpdate(entry.id, { reportType: v as ReportType, fiscalQuarter: v === "quarterly" ? 1 : null })}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-24 space-y-1">
            <Label className="text-xs">Fiscal year</Label>
            <Select
              value={String(entry.fiscalYear)}
              onValueChange={(v) => onUpdate(entry.id, { fiscalYear: Number(v) })}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {entry.reportType === "quarterly" && (
            <div className="w-20 space-y-1">
              <Label className="text-xs">Quarter</Label>
              <Select
                value={String(entry.fiscalQuarter ?? 1)}
                onValueChange={(v) => onUpdate(entry.id, { fiscalQuarter: Number(v) })}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)} className="text-xs">Q{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Step2({
  companyId,
  onDone,
}: {
  companyId: string
  onDone: () => void
}) {
  const { session, user } = useAuth()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((incoming: File[]) => {
    const pdfs = incoming.filter(
      (f) => f.type === "application/pdf" || f.type === "text/html" || /\.html?$/i.test(f.name)
    )
    setFiles((prev) => {
      const existingNames = new Set(prev.map((e) => e.file.name))
      const newEntries: FileEntry[] = pdfs
        .filter((f) => !existingNames.has(f.name))
        .map((f) => ({
          id: `${f.name}-${Date.now()}-${Math.random()}`,
          file: f,
          ...parseFilename(f.name),
          status: "pending",
        }))
      return [...prev, ...newEntries]
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleUpdate = (id: string, patch: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f))
  }

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleUpload = async () => {
    if (!files.length || !user) return
    setUploading(true)

    for (const entry of files) {
      if (entry.status !== "pending") continue

      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "uploading" } : f))

      try {
        // 1. Upload PDF directly to Supabase Storage
        const storagePath = `${user.id}/${companyId}/${Date.now()}_${entry.file.name}`
        const { error: uploadError } = await supabase.storage
          .from("reports")
          .upload(storagePath, entry.file)

        if (uploadError) throw new Error(uploadError.message)

        // 2. Notify backend to parse the file
        const res = await fetch(`${API_URL}/companies/${companyId}/reports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            company_id: companyId,
            report_type: entry.reportType,
            fiscal_year: entry.fiscalYear,
            fiscal_quarter: entry.fiscalQuarter,
            storage_path: storagePath,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { detail?: string }
          throw new Error(body.detail ?? "Backend failed to process file")
        }

        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "done" } : f))
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed"
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "error", error: msg } : f))
      }
    }

    setUploading(false)
    onDone()
  }

  const allDone = files.length > 0 && files.every((f) => f.status === "done")
  const hasErrors = files.some((f) => f.status === "error")
  const pendingCount = files.filter((f) => f.status === "pending").length

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload reports
        </CardTitle>
        <CardDescription>
          Upload annual reports, quarterly reports, and shareholder letters.
          You can add multiple years — more data means a better moat analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 sm:p-8 text-center transition-colors
            ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40"}`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF and HTM/HTML files accepted (10-K, 20-F, quarterly reports)</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.htm,.html"
            multiple
            className="hidden"
            onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{files.length} file{files.length !== 1 ? "s" : ""} selected</p>
              {(allDone || hasErrors) && (
                <div className="flex items-center gap-2">
                  {allDone && <Badge variant="wide">All uploaded</Badge>}
                  {hasErrors && <Badge variant="none">Some failed</Badge>}
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {files.map((entry) => (
                <FileRow key={entry.id} entry={entry} onUpdate={handleUpdate} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            className="flex-1"
            onClick={() => void handleUpload()}
            disabled={uploading || pendingCount === 0}
          >
            {uploading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              : `Upload ${pendingCount > 0 ? pendingCount : ""} file${pendingCount !== 1 ? "s" : ""}`}
          </Button>
          {(allDone || hasErrors) && (
            <Button variant="outline" onClick={onDone}>
              Continue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Step 3: Processing complete ────────────────────────────────────────────

function Step3({ companyId }: { companyId: string }) {
  const navigate = useNavigate()
  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <div>
          <h2 className="text-lg font-semibold">Reports uploaded</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your reports have been uploaded and parsed. You can now run a full LLM
            analysis from the company page.
          </p>
        </div>
        <Button onClick={() => navigate(`/company/${companyId}`)}>
          Go to company analysis
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function AddCompanyPage() {
  // When rendered at /company/:id/upload the company already exists — skip step 1
  const { id: existingId } = useParams<{ id?: string }>()
  const [step, setStep] = useState<1 | 2 | 3>(existingId ? 2 : 1)
  const [companyId, setCompanyId] = useState<string | null>(existingId ?? null)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{existingId ? "Upload reports" : "Add company"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload financial reports to start your moat analysis.
          </p>
        </div>

        <StepIndicator current={step} />

        {step === 1 && (
          <Step1 onNext={(id) => { setCompanyId(id); setStep(2) }} />
        )}
        {step === 2 && companyId && (
          <Step2 companyId={companyId} onDone={() => setStep(3)} />
        )}
        {step === 3 && companyId && (
          <Step3 companyId={companyId} />
        )}
      </main>
    </div>
  )
}
