import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/layouts/AuthLayout'
import DashboardLayout from '@/layouts/DashboardLayout'

// Views
import Login from '@/views/Login'
import ForgotPassword from '@/views/ForgotPassword'
import Register from '@/views/Register'
import Dashboard from '@/views/Dashboard'
import PersonalDashboard from '@/views/PersonalDashboard'
import UsersView from '@/views/Users'
import Onboarding from '@/views/Onboarding'
import Analytics from '@/views/Analytics'
import RFIDView from '@/views/RFID'
import FaceRecognition from '@/views/FaceRecognition'
import FaceAuthLog from '@/views/FaceAuthLog'
import AuditView from '@/views/Audit'
import AccessManagement from '@/views/AccessManagement'
import GuardDashboard from '@/views/GuardDashboard'
import HostelDashboard from '@/views/HostelDashboard'
import DeviceRegistry from '@/views/DeviceRegistry'
import { roleDashboardPath } from '@/utils/roleDashboard'

const ProtectedRoute = ({ children, roles: requiredRoles }) => {
  const { isAuthenticated, isInitializing, hasAnyRole, roles } = useAuth()

  if (isInitializing) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const isAdministrator = hasAnyRole(['SUPER_ADMIN', 'ADMIN'])
  if (requiredRoles && !isAdministrator && !hasAnyRole(requiredRoles)) {
    return <Navigate to={roleDashboardPath(roles)} replace />
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isInitializing, roles } = useAuth()

  if (isInitializing) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to={roleDashboardPath(roles)} replace />
  }

  return <AuthLayout>{children}</AuthLayout>
}

const DashboardRouter = () => {
  const { hasAnyRole } = useAuth()
  const isAdministrator = hasAnyRole(['SUPER_ADMIN', 'ADMIN'])
  return isAdministrator ? <Dashboard /> : <PersonalDashboard />
}

export const App = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* Protected Operations Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
            <UsersView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'VIEWER']}>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rfid"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD']}>
            <RFIDView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/face-recognition"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD']}>
            <FaceRecognition />
          </ProtectedRoute>
        }
      />
      <Route
        path="/face-auth-log"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD']}>
            <FaceAuthLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'VIEWER']}>
            <AuditView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/access"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
            <AccessManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guard"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD']}>
            <GuardDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hostel"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'WARDEN']}>
            <HostelDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
            <DeviceRegistry />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
