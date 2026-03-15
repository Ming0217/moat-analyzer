import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Navbar } from "@/components/layout/Navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, Copy, Check, KeyRound, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface TokenRow {
  id: string
  name: string
  prefix: string
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
  const copy = () => {
    void navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

export function TokensPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")
  const [revealed, setRevealed] = useState<CreatedToken | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const { data: tokens = [], isLoading } = useQuery<TokenRow[]>({
    queryKey: ["tokens"],
    queryFn: () => api.get<TokenRow[]>("/tokens"),
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<CreatedToken>("/tokens", { name }),
    onSuccess: (data) => {
      setRevealed(data)
      setNewName("")
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Portfolio
          </Link>
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold">Personal Access Tokens</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Generate tokens for AI agents and external tools to access your portfolio via the API.
              </p>
            </div>
          </div>
        </div>

        {/* One-time token reveal */}
        {revealed && (
          <Card className="mb-6 border-emerald-300 bg-emerald-50">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Token created — copy it now</p>
                  <p className="text-xs text-emerald-700 mt-0.5">This is the only time the full token will be shown. Store it somewhere safe.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2">
                <code className="flex-1 text-xs font-mono break-all text-foreground">{revealed.token}</code>
                <CopyButton value={revealed.token} />
              </div>
              <Button variant="outline" size="sm" className="border-emerald-300" onClick={() => setRevealed(null)}>
                I've saved it — dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create new token */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create New Token</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Token name (e.g. My AI Assistant)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim()) }}
              />
              <Button
                size="sm"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newName.trim())}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Token list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : tokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tokens yet. Generate one above.</p>
            ) : (
              <div className="space-y-2">
                {tokens.map(t => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.name}</span>
                        <Badge variant="outline" className="font-mono text-xs">{t.prefix}…</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {fmtDate(t.created_at)} · Last used {fmtDate(t.last_used_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {confirmId === t.id ? (
                        <>
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                            onClick={() => revokeMutation.mutate(t.id)}
                            disabled={revokeMutation.isPending}>
                            Confirm revoke
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                            onClick={() => setConfirmId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmId(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security note */}
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Tokens grant full access to your portfolio data. Treat them like passwords — never share them publicly or commit them to source control.</span>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          See the <Link to="/api-docs" className="text-primary hover:underline">API Reference</Link> for how to use tokens with your AI agent.
        </div>
      </main>
    </div>
  )
}
