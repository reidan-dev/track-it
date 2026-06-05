import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PeriodProvider } from '@/contexts/PeriodContext'
import Layout from '@/components/layout/Layout'
import { InstallPrompt } from '@/components/shared/InstallPrompt'
import { LockGate } from '@/components/shared/LockGate'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Summary from '@/pages/Summary'
import Expenses from '@/pages/Expenses'
import Bills from '@/pages/Bills'
import Installments from '@/pages/Installments'
import Loans from '@/pages/Loans'
import Income from '@/pages/Income'
import CalendarPage from '@/pages/Calendar'
import Settings from '@/pages/Settings'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Layout>{children}<InstallPrompt /></Layout> : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <LockGate active={isAuthenticated}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/summary" element={<ProtectedRoute><Summary /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/bills" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
        <Route path="/installments" element={<ProtectedRoute><Installments /></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
        <Route path="/income" element={<ProtectedRoute><Income /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </LockGate>
  )
}

export default function App() {
  return (
    <PeriodProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
    </PeriodProvider>
  )
}
