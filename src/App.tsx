import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import InventoryPage from './pages/InventoryPage'
import AssetDetailPage from './pages/AssetDetailPage'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeProfilePage from './pages/EmployeeProfilePage'
import MaintenancePage from './pages/MaintenancePage'
import ReplacementPage from './pages/ReplacementPage'
import ReportsPage from './pages/ReportsPage'
import AuditLogPage from './pages/AuditLogPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import LoadingSpinner from './components/ui/LoadingSpinner'

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { user, userProfile, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner size="lg" message="Loading..." /></div>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && userProfile?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner size="lg" message="Loading..." /></div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/:id" element={<AssetDetailPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="replacement" element={<ReplacementPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-log" element={<ProtectedRoute adminOnly><AuditLogPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
