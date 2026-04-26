import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/stores/auth'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { SetupPage } from '@/pages/SetupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DevicesPage } from '@/pages/DevicesPage'
import { DeviceDetailPage } from '@/pages/DeviceDetailPage'
import { QuickActionsPage } from '@/pages/QuickActionsPage'
import { SchedulesPage } from '@/pages/SchedulesPage'
import { RoomsZonesPage } from '@/pages/RoomsZonesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { RegisterPage } from '@/pages/RegisterPage'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, fetchUser, user } = useAuthStore()
  useEffect(() => { if (isAuthenticated && !user) fetchUser() }, [isAuthenticated, user, fetchUser])
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/devices/:id" element={<ProtectedRoute><DeviceDetailPage /></ProtectedRoute>} />
          <Route path="/quick-actions" element={<ProtectedRoute><QuickActionsPage /></ProtectedRoute>} />
          <Route path="/schedules" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
          <Route path="/rooms-zones" element={<ProtectedRoute><RoomsZonesPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" />
    </QueryClientProvider>
  )
}
