import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { ReanalyzingProvider } from "@/contexts/ReanalyzingContext"
import { Loader2 } from "lucide-react"

// Eagerly loaded — entry points users hit first
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { DashboardPage } from "@/pages/DashboardPage"

// Lazy loaded — only fetched when the route is visited
const CompanyPage = lazy(() => import("@/pages/CompanyPage").then(m => ({ default: m.CompanyPage })))
const AddCompanyPage = lazy(() => import("@/pages/AddCompanyPage").then(m => ({ default: m.AddCompanyPage })))
const MethodologyPage = lazy(() => import("@/pages/MethodologyPage").then(m => ({ default: m.MethodologyPage })))
const TokensPage = lazy(() => import("@/pages/TokensPage").then(m => ({ default: m.TokensPage })))
const ApiDocsPage = lazy(() => import("@/pages/ApiDocsPage").then(m => ({ default: m.ApiDocsPage })))

const queryClient = new QueryClient()

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReanalyzingProvider>
      <TooltipProvider>
        <Toaster position="bottom-center" richColors />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/company/new" element={<ProtectedRoute><AddCompanyPage /></ProtectedRoute>} />
              <Route path="/company/:id/upload" element={<ProtectedRoute><AddCompanyPage /></ProtectedRoute>} />
              <Route path="/company/:id" element={<ProtectedRoute><CompanyPage /></ProtectedRoute>} />
              <Route path="/methodology" element={<ProtectedRoute><MethodologyPage /></ProtectedRoute>} />
              <Route path="/settings/tokens" element={<ProtectedRoute><TokensPage /></ProtectedRoute>} />
              <Route path="/api-docs" element={<ProtectedRoute><ApiDocsPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </ReanalyzingProvider>
    </QueryClientProvider>
  )
}
