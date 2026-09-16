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
import UsersView from '@/views/Users'
import Onboarding from '@/views/Onboarding'
import Analytics from '@/views/Analytics'
import RFIDView from '@/views/RFID'
import FaceRecognition from '@/views/FaceRecognition'
import FaceAuthLog from '@/views/FaceAuthLog'
import AuditView from '@/views/Audit'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth()

  if (isInitializing) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth()

  if (isInitializing) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <AuthLayout>{children}</AuthLayout>
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
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rfid"
        element={
          <ProtectedRoute>
            <RFIDView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/face-recognition"
        element={
          <ProtectedRoute>
            <FaceRecognition />
          </ProtectedRoute>
        }
      />
      <Route
        path="/face-auth-log"
        element={
          <ProtectedRoute>
            <FaceAuthLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <AuditView />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
