import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { ReanalyzingProvider } from "@/contexts/ReanalyzingContext"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { CompanyPage } from "@/pages/CompanyPage"
import { AddCompanyPage } from "@/pages/AddCompanyPage"
import { MethodologyPage } from "@/pages/MethodologyPage"
import { TokensPage } from "@/pages/TokensPage"
import { ApiDocsPage } from "@/pages/ApiDocsPage"

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReanalyzingProvider>
      <TooltipProvider>
        <Toaster position="bottom-center" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
            />
            <Route
              path="/company/new"
              element={<ProtectedRoute><AddCompanyPage /></ProtectedRoute>}
            />
            <Route
              path="/company/:id/upload"
              element={<ProtectedRoute><AddCompanyPage /></ProtectedRoute>}
            />
            <Route
              path="/company/:id"
              element={<ProtectedRoute><CompanyPage /></ProtectedRoute>}
            />
            <Route
              path="/methodology"
              element={<ProtectedRoute><MethodologyPage /></ProtectedRoute>}
            />
            <Route path="/settings/tokens" element={<ProtectedRoute><TokensPage /></ProtectedRoute>} />
            <Route path="/api-docs" element={<ProtectedRoute><ApiDocsPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ReanalyzingProvider>
    </QueryClientProvider>
  )
}
