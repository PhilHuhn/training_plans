import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/stores/auth-store'
import AppLayout from '@/components/layout/app-layout'
import LoginPage from '@/pages/login'
import RegisterPage from '@/pages/register'
import TrainingPage from '@/pages/training'
import ActivitiesPage from '@/pages/activities'
import CompetitionsPage from '@/pages/competitions'
import SettingsPage from '@/pages/settings'
import ChangelogPage from '@/pages/changelog'

function ProtectedRoute() {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

function PublicRoute() {
  const { token } = useAuthStore()
  if (token) return <Navigate to="/training" replace />
  return <Outlet />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/dashboard" element={<Navigate to="/training" replace />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/training" replace />} />
        <Route path="*" element={<Navigate to="/training" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
