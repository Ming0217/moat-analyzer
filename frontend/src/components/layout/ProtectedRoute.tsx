import { Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  return <>{children}</>
}
