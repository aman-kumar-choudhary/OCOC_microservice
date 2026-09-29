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
import LeaveManagement from '@/views/LeaveManagement'
import Legal from '@/views/Legal'
import { roleDashboardPath, isAuthorizedForRoute } from '@/utils/roleDashboard'

/**
 * Root redirector: sends authenticated users to their authorized workspace
 */
const RootRedirect = () => {
  const { isAuthenticated, isInitializing, roles } = useAuth()
  if (isInitializing) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={roleDashboardPath(roles)} replace />
}

/**
 * Role-aware ProtectedRoute: blocks unauthorized access and redirects to authorized dashboard
 */
const ProtectedRoute = ({ children, path, roles: requiredRoles }) => {
  const { isAuthenticated, isInitializing, roles } = useAuth()

  if (isInitializing) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const assigned = new Set(roles.map((r) => String(r).toUpperCase()))
  const isSuperAdmin = assigned.has('SUPER_ADMIN')

  // Super Admin has full unrestricted access to everything
  if (isSuperAdmin) {
    return <DashboardLayout>{children}</DashboardLayout>
  }

  // Strict path authorization check
  if (path && !isAuthorizedForRoute(path, roles)) {
    return <Navigate to={roleDashboardPath(roles)} replace />
  }

  // Explicit roles check if provided
  if (requiredRoles && !requiredRoles.some((r) => assigned.has(String(r).toUpperCase()))) {
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

/**
 * Dashboard router: automatically sends users to their assigned workspace
 */
const DashboardRouter = () => {
  const { roles } = useAuth()
  const assigned = new Set(roles.map((r) => String(r).toUpperCase()))

  // Super Admin: full access to main analytics & management overview
  if (assigned.has('SUPER_ADMIN')) {
    return <Dashboard />
  }

  // Admin: strictly limited to Access Management Dashboard
  if (assigned.has('ADMIN')) {
    return <Navigate to="/access" replace />
  }

  // Warden: strictly limited to Hostel Management Dashboard
  if (assigned.has('WARDEN')) {
    return <Navigate to="/hostel" replace />
  }

  // Guard: strictly limited to Guard Console
  if (assigned.has('GUARD') || assigned.has('SECURITY_GUARD') || assigned.has('SECURITY_ADMIN')) {
    return <Navigate to="/guard" replace />
  }

  // General Campus Identity Workspace (Student, Faculty, Worker, Visitor)
  return <PersonalDashboard />
}

export const App = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

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
      <Route path="/terms" element={<Legal />} />
      <Route path="/privacy" element={<Legal />} />

      {/* Protected Operations Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute path="/dashboard">
            <DashboardRouter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute path="/users" roles={['SUPER_ADMIN']}>
            <UsersView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute path="/onboarding" roles={['SUPER_ADMIN']}>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute path="/analytics" roles={['SUPER_ADMIN', 'VIEWER']}>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rfid"
        element={
          <ProtectedRoute path="/rfid" roles={['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN']}>
            <RFIDView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/face-recognition"
        element={
          <ProtectedRoute path="/face-recognition" roles={['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN']}>
            <FaceRecognition />
          </ProtectedRoute>
        }
      />
      <Route
        path="/face-auth-log"
        element={
          <ProtectedRoute path="/face-auth-log" roles={['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN']}>
            <FaceAuthLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/access"
        element={
          <ProtectedRoute path="/access" roles={['SUPER_ADMIN', 'ADMIN']}>
            <AccessManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices"
        element={
          <ProtectedRoute path="/devices" roles={['SUPER_ADMIN', 'ADMIN']}>
            <DeviceRegistry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guard"
        element={
          <ProtectedRoute path="/guard" roles={['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN']}>
            <GuardDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hostel"
        element={
          <ProtectedRoute path="/hostel" roles={['SUPER_ADMIN', 'WARDEN']}>
            <HostelDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave"
        element={
          <ProtectedRoute path="/leave" roles={['SUPER_ADMIN', 'ADMIN', 'STUDENT', 'WARDEN', 'CHANCELLOR', 'MEDICAL_OFFICER', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD']}>
            <LeaveManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute path="/audit" roles={['SUPER_ADMIN', 'SECURITY_ADMIN', 'VIEWER']}>
            <AuditView />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

export default App
