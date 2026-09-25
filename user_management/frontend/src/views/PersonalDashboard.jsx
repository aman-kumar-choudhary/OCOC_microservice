import React from 'react'
import { ShieldCheck, UserRound, Building2, Home, Shield } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const OPERATIONAL_ROLES = new Set([
  'STUDENT', 'FACULTY', 'WARDEN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN',
  'STAFF', 'WORKER', 'VISITOR',
])

const PersonalDashboard = () => {
  const { user, roles, email } = useAuth()
  const name = user?.name || user?.preferred_username || email || 'there'
  const assignedRoles = roles.filter((role) => OPERATIONAL_ROLES.has(String(role).toUpperCase()))
  const isWarden = assignedRoles.some((role) => String(role).toUpperCase() === 'WARDEN')
  const isGuard = assignedRoles.some((role) => ['GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN'].includes(String(role).toUpperCase()))
  const workspace = isWarden ? 'Hostel workspace' : isGuard ? 'Guard workspace' : 'Personal workspace'

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="overflow-hidden rounded-2xl bg-[#0a2342] text-white shadow-lg">
        <div className="px-6 py-8 sm:px-9 sm:py-10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f5bd19]">
            <ShieldCheck size={16} /> OCOC · Your workspace
          </div>
          <h1 className="mt-3 text-3xl font-extrabold">Welcome, {name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Your account is active. This workspace shows the access assigned to your account; campus administration tools are available to administrators.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRound size={20} /></span>
            <div>
              <h2 className="font-bold text-slate-900">Account</h2>
              <p className="text-sm text-slate-500">{email || user?.preferred_username || 'Signed in with Keycloak'}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {assignedRoles.length ? assignedRoles.map((role) => (
              <span key={role} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                {role.replaceAll('_', ' ')}
              </span>
            )) : <span className="text-sm text-slate-500">No operational role is assigned yet.</span>}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
              {isWarden ? <Home size={20} /> : isGuard ? <Shield size={20} /> : <Building2 size={20} />}
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Assigned workspace</h2>
              <p className="text-sm text-slate-500">{workspace}</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">
            Your available pages are shown in the navigation menu. If you need another area, ask an administrator to update your access.
          </p>
        </article>
      </div>
    </section>
  )
}

export default PersonalDashboard
