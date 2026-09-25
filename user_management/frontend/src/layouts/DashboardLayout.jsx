import React, { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { roleDashboardPath } from '@/utils/roleDashboard'
import dsvvLogo from '@/assets/Dsvv.png'
import {
  Activity, BarChart3, CreditCard, LayoutDashboard, LogOut, Menu,
  ShieldAlert, UserPlus, Users, X, ScanFace, ChevronDown, Mail, Lock,
  Shield, Home, Server
} from 'lucide-react'

export const DashboardLayout = ({ children }) => {
  const navigate = useNavigate()
  const { user, roles, email, hasRole, logout } = useAuth()
  const isAdministrator = hasRole('SUPER_ADMIN') || hasRole('ADMIN')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const userInitial = email?.charAt(0).toUpperCase() || 'A'
  const userRoles = roles.filter((role) => !role.startsWith('default-')).slice(0, 2)

  const navItems = [
    { name: 'Dashboard', path: roleDashboardPath(roles), icon: LayoutDashboard },
    { name: 'User Directory', path: '/users', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Onboard Person', path: '/onboarding', icon: UserPlus, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] },
    { name: 'RFID Cards', path: '/rfid', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD'] },
    { name: 'Face Lab', path: '/face-recognition', icon: ScanFace, roles: ['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD'] },
    { name: 'Auth Monitor', path: '/face-auth-log', icon: ShieldAlert, roles: ['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD'] },
    { name: 'Access Control', path: '/access', icon: Lock, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Guard Console', path: '/guard', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'GUARD', 'SECURITY_GUARD'] },
    { name: 'Hostel Management', path: '/hostel', icon: Home, roles: ['SUPER_ADMIN', 'ADMIN', 'WARDEN'] },
    { name: 'Device Registry', path: '/devices', icon: Server, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Audit Log', path: '/audit', icon: Activity, roles: ['SUPER_ADMIN', 'ADMIN', 'SECURITY_ADMIN', 'VIEWER'] },
  ]

  const filteredNavItems = navItems.filter((item) => isAdministrator || !item.roles || item.roles.some((role) => hasRole(role)))

  const handleLogout = async () => {
    setIsProfileMenuOpen(false)
    await logout()
    navigate('/login')
  }

  useEffect(() => {
    const closeProfileMenu = (event) => {
      const target = event.target
      if (!target.closest('[data-profile-menu]')) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('click', closeProfileMenu)
    return () => document.removeEventListener('click', closeProfileMenu)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-main)] lg:flex">
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0a2342]/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col bg-[#0a2342] text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-24 items-center justify-between border-b border-white/10 px-5">
          <Link
            to={roleDashboardPath(roles)}
            className="flex items-center justify-center text-white no-underline mx-auto"
            aria-label="DSVV dashboard"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <img src={dsvvLogo} alt="Dev Sanskriti Vishwavidyalaya" className="h-[78px] w-[78px] object-contain" />
          </Link>
          <button
            className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Workspace
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Primary navigation">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${
                    isActive
                      ? '!bg-[#f5bd19] !text-[#0a2342] shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={19} strokeWidth={2} />
                {item.name}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="min-w-0 flex-1">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-main)]/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] text-[#0a2342] lg:hidden"
              aria-label="Open navigation"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div>
              <p className="text-[16px] font-extrabold uppercase tracking-[0.18em] text-[#f5bd19] sm:text-xs">
                OCOC
              </p>
              <h2 className="font-display text-base font-extrabold text-[var(--text-main)] sm:text-lg">
                University Identity Platform
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative" data-profile-menu>
              <button
                className="flex items-center gap-2 rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] p-1 pr-2 text-[#0a2342] shadow-sm transition hover:border-[#f5bd19] hover:shadow-md"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsProfileMenuOpen(!isProfileMenuOpen)
                }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0a2342] text-sm font-bold text-[#f5bd19]">
                  {userInitial}
                </span>
                <ChevronDown
                  size={15}
                  className={`hidden text-muted sm:block transition-transform duration-200 ${
                    isProfileMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isProfileMenuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-72 overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-2 text-[var(--text-main)] shadow-[0_18px_48px_rgb(10_35_66/0.18)]"
                  role="menu"
                >
                  <div className="rounded-xl bg-[#0a2342] px-4 py-4 text-white">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f5bd19] font-bold text-[#0a2342]">
                        {userInitial}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{email || 'Administrator'}</p>
                        <p className="mt-0.5 text-xs text-slate-300">Secure session</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                      <Mail size={14} /> Account information
                    </div>
                    <p className="mt-2 break-all text-sm font-semibold">{email || 'Administrator'}</p>
                    {userRoles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {userRoles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-[#f5bd19]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7b5600]"
                          >
                            {role.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default DashboardLayout
