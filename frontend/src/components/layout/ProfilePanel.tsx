import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus, Trash2, Copy, Check, BookOpen, LogOut, AlertCircle, KeyRound,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

type Scope = "read" | "write" | "admin"

const SCOPE_META: Record<Scope, { label: string; color: string; description: string }> = {
  read:  { label: "Read",  color: "text-sky-700 bg-sky-50 border-sky-200",     description: "View portfolio & analyses" },
  write: { label: "Write", color: "text-violet-700 bg-violet-50 border-violet-200", description: "Read + create companies & trigger analysis" },
  admin: { label: "Admin", color: "text-rose-700 bg-rose-50 border-rose-200",   description: "Full access including delete" },
}

function ScopeBadge({ scope }: { scope: Scope }) {
  const meta = SCOPE_META[scope] ?? SCOPE_META.read
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${meta.color}`}>
      {meta.label}
    </span>
  )
}

interface TokenRow {
  id: string
  name: string
  prefix: string
  scope: Scope
  created_at: string
  last_used_at: string | null
}

interface CreatedToken extends TokenRow {
  token: string
}

function fmtDate(iso: string | null) {
  if (!iso) return "Never"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="p-1 rounded text-muted-foreground hover:text-foreground"
      onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

interface ProfilePanelProps {
  onClose: () => void
}

export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const { user, signOut, session } = useAuth()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")
  const [newScope, setNewScope] = useState<Scope>("read")
  const [revealed, setRevealed] = useState<CreatedToken | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const { data: tokens = [], isLoading } = useQuery<TokenRow[]>({
    queryKey: ["tokens"],
    queryFn: () => api.get<TokenRow[]>("/tokens"),
    enabled: !!session,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, scope }: { name: string; scope: Scope }) =>
      api.post<CreatedToken>("/tokens", { name, scope }),
    onSuccess: (data) => {
      setRevealed(data)
      setNewName("")
      setNewScope("read")
      void queryClient.invalidateQueries({ queryKey: ["tokens"] })
    },
    onError: () => toast.error("Failed to create token"),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.del(`/tokens/${id}`),
    onSuccess: () => {
      setConfirmId(null)
      void queryClient.invalidateQueries({ queryKey: ["tokens"] })
      toast.success("Token revoked")
    },
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute top-full left-0 right-0 z-50 bg-background border-b shadow-lg
                   animate-in slide-in-from-top-2 fade-in duration-150 max-h-[85vh] overflow-y-auto"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* ── User info ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold select-none">
              {user?.email ? initials(user.email) : "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
          </div>

          <div className="border-t" />

          {/* ── Personal Access Tokens ──────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Personal Access Tokens</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate tokens for AI agents and external tools to access your portfolio via the API.
            </p>

            {/* One-time reveal */}
            {revealed && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <p className="text-xs font-semibold text-emerald-800">Token created — copy it now. It won't be shown again.</p>
                </div>
                <div className="flex items-center gap-2 rounded border border-emerald-200 bg-white px-2 py-1.5">
                  <code className="flex-1 text-xs font-mono break-all text-foreground">{revealed.token}</code>
                  <CopyButton value={revealed.token} />
                </div>
                <button className="text-xs text-emerald-700 underline" onClick={() => setRevealed(null)}>
                  I've saved it — dismiss
                </button>
              </div>
            )}

            {/* Create token */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Token name (e.g. My AI Assistant)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate({ name: newName.trim(), scope: newScope }) }}
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={!newName.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate({ name: newName.trim(), scope: newScope })}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Scope selector */}
              <div className="flex gap-2">
                {(["read", "write", "admin"] as Scope[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setNewScope(s)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-left transition-colors ${
                      newScope === s
                        ? SCOPE_META[s].color + " ring-1 ring-current"
                        : "border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <p className="text-[11px] font-semibold">{SCOPE_META[s].label}</p>
                    <p className="text-[10px] leading-tight mt-0.5">{SCOPE_META[s].description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Token list */}
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : tokens.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tokens yet. Enter a name above to generate one.</p>
            ) : (
              <div className="space-y-1.5">
                {tokens.map(t => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{t.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px] py-0">{t.prefix}…</Badge>
                        <ScopeBadge scope={t.scope} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Created {fmtDate(t.created_at)} · Last used {fmtDate(t.last_used_at)}
                      </p>
                    </div>
                    {confirmId === t.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px]"
                          onClick={() => revokeMutation.mutate(t.id)}
                          disabled={revokeMutation.isPending}>
                          Revoke
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => setConfirmId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmId(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Never share tokens publicly. Use the narrowest scope your agent needs.</span>
            </div>
          </div>

          <div className="border-t" />

          {/* ── Links ───────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Link
              to="/api-docs"
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              API Reference
            </Link>
          </div>

          <div className="border-t" />

          {/* ── Sign out ────────────────────────────────────────────────── */}
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => { void signOut(); onClose() }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>

        </div>
      </div>
    </>
  )
}
