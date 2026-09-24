/**
 * Choose the first workspace a user should see after Keycloak authentication.
 * The roles come from the signed `realm_access.roles` token claim.
 */
export const roleDashboardPath = (roles = []) => {
  const assigned = new Set(roles.map((role) => String(role).toUpperCase()))

  if (assigned.has('SUPER_ADMIN') || assigned.has('ADMIN') || assigned.has('USER_MANAGER')) {
    return '/dashboard'
  }
  if (assigned.has('WARDEN')) return '/hostel'
  if (assigned.has('GUARD') || assigned.has('SECURITY_GUARD') || assigned.has('SECURITY_ADMIN')) {
    return '/guard'
  }
  if (assigned.has('VIEWER')) return '/analytics'

  // Student, faculty, staff, worker, and visitor accounts use the general
  // authenticated landing page until a specialised workspace is added.
  return '/dashboard'
}
