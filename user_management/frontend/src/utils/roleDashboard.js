/**
 * Role-Based Dashboard Routing and Access Controls
 *
 * Rules:
 * - Super Admin: Full access to all dashboards and modules. Default redirect: /dashboard
 * - Admin: Access only to the Access Management Dashboard and related features. Default redirect: /access
 * - Warden: Access only to the Hostel Management Dashboard and hostel-related features. Default redirect: /hostel
 * - Guard: Access only to the Guard Console for security and access-control operations. Default redirect: /guard
 * - Campus Users (Student/Faculty/Worker/Visitor): Digital Identity Workspace (/dashboard)
 */

export const roleDashboardPath = (roles = []) => {
  const assigned = new Set(roles.map((role) => String(role).toUpperCase()))

  if (assigned.has('SUPER_ADMIN')) {
    return '/dashboard'
  }
  if (assigned.has('ADMIN')) {
    return '/access'
  }
  if (assigned.has('WARDEN')) {
    return '/hostel'
  }
  if (assigned.has('GUARD') || assigned.has('SECURITY_GUARD') || assigned.has('SECURITY_ADMIN')) {
    return '/guard'
  }
  if (assigned.has('VIEWER')) {
    return '/analytics'
  }

  // Student, faculty, staff, worker, and visitor accounts
  return '/dashboard'
}

/**
 * Route-level permission definition
 */
export const ROUTE_PERMISSIONS = {
  '/dashboard': ['SUPER_ADMIN', 'STUDENT', 'FACULTY', 'WORKER', 'VISITOR', 'USER', 'STAFF'],
  '/users': ['SUPER_ADMIN'],
  '/onboarding': ['SUPER_ADMIN'],
  '/analytics': ['SUPER_ADMIN', 'VIEWER'],
  '/access': ['SUPER_ADMIN', 'ADMIN'],
  '/devices': ['SUPER_ADMIN', 'ADMIN'],
  '/guard': ['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN'],
  '/rfid': ['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN'],
  '/face-recognition': ['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN'],
  '/face-auth-log': ['SUPER_ADMIN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN'],
  '/hostel': ['SUPER_ADMIN', 'WARDEN'],
  '/leave': ['SUPER_ADMIN', 'ADMIN', 'STUDENT', 'WARDEN', 'CHANCELLOR', 'MEDICAL_OFFICER', 'SECURITY_ADMIN'],
  '/audit': ['SUPER_ADMIN', 'SECURITY_ADMIN', 'VIEWER'],
}

/**
 * Checks if the given roles have permission to view a specific path
 */
export const isAuthorizedForRoute = (path, roles = []) => {
  const assigned = new Set(roles.map((role) => String(role).toUpperCase()))

  // Super Admin has unrestricted full access to everything
  if (assigned.has('SUPER_ADMIN')) {
    return true
  }

  // Route-specific checks
  const normalizedPath = path.split('?')[0].split('#')[0]

  // Pure Admin: restricted exclusively to Access Management and related device registry
  if (assigned.has('ADMIN') && !assigned.has('SUPER_ADMIN')) {
    if (normalizedPath === '/access' || normalizedPath === '/devices' || normalizedPath === '/leave') {
      return true
    }
    // Admin is NOT allowed on /dashboard, /users, /hostel, /guard, etc.
    return false
  }

  // Pure Warden: restricted exclusively to Hostel Management
  if (assigned.has('WARDEN') && !assigned.has('SUPER_ADMIN')) {
    if (normalizedPath === '/hostel' || normalizedPath === '/leave') {
      return true
    }
    return false
  }

  // Pure Guard: restricted exclusively to Guard Console and gate scanners
  if (
    (assigned.has('GUARD') || assigned.has('SECURITY_GUARD') || assigned.has('SECURITY_ADMIN')) &&
    !assigned.has('SUPER_ADMIN')
  ) {
    if (['/guard', '/rfid', '/face-recognition', '/face-auth-log', '/leave'].includes(normalizedPath)) {
      return true
    }
    return false
  }

  // Standard route permissions for other roles
  const allowedRoles = ROUTE_PERMISSIONS[normalizedPath]
  if (!allowedRoles) {
    return false
  }

  return allowedRoles.some((r) => assigned.has(r))
}

export default {
  roleDashboardPath,
  isAuthorizedForRoute,
  ROUTE_PERMISSIONS,
}
