import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, UserRound, Building2, Home, Shield, MapPin,
  CreditCard, Clock, CheckCircle2, AlertCircle, ExternalLink,
  Loader2, Sparkles, Phone, Mail, Award, BookOpen, Layers,
  GraduationCap, Wrench, UserCheck, Hash, Briefcase
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import userService from '@/services/userService'

const OPERATIONAL_ROLES = new Set([
  'STUDENT', 'FACULTY', 'WARDEN', 'GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN',
  'STAFF', 'WORKER', 'VISITOR',
])

export const PersonalDashboard = () => {
  const { user, roles, email } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    const fetchProfile = async () => {
      setLoading(true)
      try {
        const data = await userService.getProfile()
        if (isMounted) setProfile(data)
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error?.message || 'Unable to load profile data.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchProfile()
    return () => { isMounted = false }
  }, [])

  const assignedRoles = roles.filter((role) => OPERATIONAL_ROLES.has(String(role).toUpperCase()))
  const isWarden = assignedRoles.some((r) => String(r).toUpperCase() === 'WARDEN')
  const isGuard = assignedRoles.some((r) => ['GUARD', 'SECURITY_GUARD', 'SECURITY_ADMIN'].includes(String(r).toUpperCase()))
  const isStudent = (profile?.user_type || '').toLowerCase() === 'student' || assignedRoles.includes('STUDENT')
  const isFaculty = (profile?.user_type || '').toLowerCase() === 'faculty' || assignedRoles.includes('FACULTY')
  const isWorker = (profile?.user_type || '').toLowerCase() === 'worker' || assignedRoles.includes('WORKER')
  const isVisitor = (profile?.user_type || '').toLowerCase() === 'visitor' || assignedRoles.includes('VISITOR')

  const displayName = profile?.full_name || user?.name || user?.preferred_username || email || 'Campus Member'
  const workspaceTitle = profile?.dashboard_name || (isWarden ? 'Hostel Management Workspace' : isGuard ? 'Guard Console Workspace' : isStudent ? 'Student Identity Workspace' : isFaculty ? 'Faculty & Academic Workspace' : 'Personal Workspace')

  return (
    <section className="mx-auto max-w-6xl space-y-6 pb-12 animate-fade-in">
      {/* ── Top Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a2342] via-[#0f2e54] to-[#163a66] text-white shadow-xl">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-[#f5bd19]/10 blur-3xl pointer-events-none" />
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#f5bd19]">
                <ShieldCheck size={16} /> OCOC · {workspaceTitle}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome, {displayName}
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-slate-300 leading-relaxed">
                Your campus digital identity is verified and active. View your authorized locations, RFID card status, and academic/operational profile below.
              </p>
            </div>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {isWarden && (
                <Link
                  to="/hostel"
                  className="btn bg-[#f5bd19] text-[#0a2342] hover:bg-[#e0ab12] font-extrabold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Home size={15} /> Launch Hostel Console
                </Link>
              )}
              {isGuard && (
                <Link
                  to="/guard"
                  className="btn bg-red-500 text-white hover:bg-red-600 font-extrabold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Shield size={15} /> Open Guard Console
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-xs min-h-[300px]">
          <Loader2 size={32} className="animate-spin text-amber-500" />
          <p className="text-xs font-bold text-slate-600">Loading your personalized campus profile...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* ── Left 2 Columns: Identity & Location Grants ── */}
          <div className="md:col-span-2 space-y-6">
            {/* Identity & Persona Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0a2342] text-amber-400 font-extrabold text-xl flex items-center justify-center shadow-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base text-slate-900">{displayName}</h2>
                    <p className="text-xs text-slate-500">{profile?.email || email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {profile?.status || 'active'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-slate-100 text-slate-800 border border-slate-200">
                    {profile?.user_type || 'user'}
                  </span>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {profile?.roll_number && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Roll Number</span>
                    <span className="font-mono font-bold text-slate-900">{profile.roll_number}</span>
                  </div>
                )}
                {profile?.employee_id && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Employee ID</span>
                    <span className="font-mono font-bold text-slate-900">{profile.employee_id}</span>
                  </div>
                )}
                {profile?.department && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Department / School</span>
                    <span className="font-semibold text-slate-900">{profile.department}</span>
                  </div>
                )}
                {profile?.course && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Enrolled Course</span>
                    <span className="font-semibold text-slate-900">{profile.course} {profile.semester ? `(Semester ${profile.semester})` : ''}</span>
                  </div>
                )}
                {profile?.hostel && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-0.5">Assigned Hostel</span>
                    <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                      <Home size={13} className="text-amber-600" /> {profile.hostel}
                    </span>
                  </div>
                )}
                {profile?.designation && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Designation</span>
                    <span className="font-semibold text-slate-900">{profile.designation}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Phone Contact</span>
                    <span className="font-semibold text-slate-900">{profile.phone}</span>
                  </div>
                )}
                {profile?.visitor_purpose && (
                  <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200/80 sm:col-span-2">
                    <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block mb-0.5">Visit Purpose</span>
                    <span className="font-semibold text-purple-950">{profile.visitor_purpose} (Host: {profile.visitor_contact || 'Campus Administration'})</span>
                  </div>
                )}
              </div>

              {/* Roles Badge List */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Granted Operational Roles</span>
                <div className="flex flex-wrap gap-2">
                  {assignedRoles.length ? (
                    assignedRoles.map((role) => (
                      <span key={role} className="rounded-full border border-amber-300 bg-amber-50/80 px-3 py-1 text-xs font-extrabold text-amber-900">
                        {role.replaceAll('_', ' ')}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Default Campus User permissions active</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Multi-Role Separation Breakdown ── */}
            {profile?.role_profiles && Object.keys(profile.role_profiles).length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-amber-500" />
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Role-Specific Details & Permissions ({Object.keys(profile.role_profiles).length} Active Roles)
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Separate Role Attributes
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {/* Student Profile Card */}
                  {profile.role_profiles.student && (
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                      <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                        <span className="font-extrabold text-xs text-blue-900 flex items-center gap-1.5 uppercase tracking-wide">
                          <GraduationCap size={15} className="text-blue-600" /> Student Profile
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          ID: {profile.role_profiles.student.roll_number || profile.roll_number || 'N/A'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Course & Dept</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.student.course || profile.course || 'Course'} · {profile.role_profiles.student.department || profile.department}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Semester & Batch</span>
                          <span className="font-semibold text-slate-800">
                            Semester {profile.role_profiles.student.semester || profile.semester || '1'} {profile.role_profiles.student.batch ? `(${profile.role_profiles.student.batch})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Hostel & Room</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.student.hostel || profile.hostel || 'Day Scholar'}
                            {profile.role_profiles.student.room_number ? ` · ${profile.role_profiles.student.room_number}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Faculty Profile Card */}
                  {profile.role_profiles.faculty && (
                    <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/40 space-y-2">
                      <div className="flex items-center justify-between border-b border-violet-200/80 pb-2">
                        <span className="font-extrabold text-xs text-violet-900 flex items-center gap-1.5 uppercase tracking-wide">
                          <Award size={15} className="text-violet-600" /> Faculty Profile
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          Faculty ID: {profile.role_profiles.faculty.faculty_id || profile.employee_id || 'N/A'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Designation & Dept</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.faculty.designation || profile.designation || 'Faculty'} · {profile.role_profiles.faculty.department || profile.department}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Courses / Subjects</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.faculty.courses || profile.courses || 'Department Syllabus'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Assigned Students</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.faculty.assigned_students || profile.assigned_students || 'None assigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warden Profile Card */}
                  {profile.role_profiles.warden && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                      <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                        <span className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5 uppercase tracking-wide">
                          <Home size={15} className="text-amber-600" /> Hostel Warden Governance
                        </span>
                        <Link
                          to="/hostel"
                          className="text-[11px] font-extrabold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-100/80 hover:bg-amber-200 px-2 py-0.5 rounded-md transition"
                        >
                          <span>Hostel Console</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-amber-800 block font-bold uppercase">Assigned Hostel & Block</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.warden.hostel || 'Campus Hostel'}
                            {profile.role_profiles.warden.hostel_block ? ` (${profile.role_profiles.warden.hostel_block})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-800 block font-bold uppercase">Warden Responsibilities</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.warden.responsibilities || 'Hostel Caretaker & Gate Pass Approvals'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Worker Profile Card */}
                  {profile.role_profiles.worker && (
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                      <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                        <span className="font-extrabold text-xs text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                          <Wrench size={15} className="text-emerald-600" /> Campus Operations & Staff
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Worker ID: {profile.role_profiles.worker.worker_id || profile.employee_id || 'N/A'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Job Type</span>
                          <span className="font-semibold text-slate-800">{profile.role_profiles.worker.job_type || 'Operations'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Work Area & Shift</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.worker.work_area || 'General Area'} · {profile.role_profiles.worker.shift || 'General Shift'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Assigned Location</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.worker.assigned_location || 'Campus Facilities'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Visitor Profile Card */}
                  {profile.role_profiles.visitor && (
                    <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/40 space-y-2">
                      <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
                        <span className="font-extrabold text-xs text-orange-900 flex items-center gap-1.5 uppercase tracking-wide">
                          <UserCheck size={15} className="text-orange-600" /> Visitor Pass Credentials
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                          {profile.role_profiles.visitor.gov_id_type || 'Gov ID'}: {profile.role_profiles.visitor.gov_id_number || 'Verified'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Purpose of Visit</span>
                          <span className="font-semibold text-slate-800">{profile.role_profiles.visitor.visit_purpose}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Host Person & Contact</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.visitor.host_person || 'Campus Host'}
                            {profile.role_profiles.visitor.host_contact ? ` (${profile.role_profiles.visitor.host_contact})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Validity & Allowed Zones</span>
                          <span className="font-semibold text-slate-800">
                            {profile.role_profiles.visitor.allowed_locations || 'Designated Campus Zones'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-amber-500" />
                  <h3 className="font-extrabold text-sm text-slate-900">Authorized Campus Locations</h3>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {(profile?.locations || []).length} Granted Zones
                </span>
              </div>

              {(!profile?.locations || profile.locations.length === 0) ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
                  <MapPin size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">Standard Public Campus Access</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Your account has default access to public academic blocks. Special laboratory or residential permissions appear here when assigned.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex items-start justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                          <MapPin size={13} className="text-amber-500 shrink-0" />
                          <span>{loc.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 capitalize ml-4.5">
                          Zone type: {loc.type || 'building'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        loc.access_level === 'ADMIN'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : loc.access_level === 'MANAGE'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {loc.access_level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Cards & Live Status ── */}
          <div className="space-y-6">
            {/* RFID Card Badge */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Campus Smart Card</h3>
              </div>
              {profile?.rfid_card ? (
                <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">NFC / RFID Tag</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                  </div>
                  <p className="font-mono text-lg font-extrabold text-[#0a2342] tracking-widest">
                    {profile.rfid_card.uid}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-600" /> Verified for contactless turnstile gates
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-1">
                  <CreditCard size={24} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No Physical Card Linked</p>
                  <p className="text-[11px] text-slate-400">Visit campus security or administration to link an RFID card.</p>
                </div>
              )}
            </div>

            {/* Student Hostel & Movement Status (if student) */}
            {isStudent && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Home size={18} className="text-amber-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Hostel Attendance Status</h3>
                </div>
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Current Presence</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      profile?.student_hostel_status?.current_status === 'OUTSIDE'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {profile?.student_hostel_status?.current_status || 'INSIDE HOSTEL'}
                    </span>
                  </div>
                  {profile?.student_hostel_status?.active_permission ? (
                    <div className="pt-2 border-t border-amber-200/80 text-xs space-y-1">
                      <span className="font-bold text-amber-950 block">Approved Leave Pass Active</span>
                      <p className="text-[11px] text-slate-600">
                        Type: {profile.student_hostel_status.active_permission.permission_type}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Valid until: {new Date(profile.student_hostel_status.active_permission.end_time).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 pt-1 border-t border-amber-200/60">
                      Standard hostel curfew hours apply.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Security & Support Information */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3 text-xs">
              <h3 className="font-extrabold text-sm text-slate-900">Campus Helpdesk</h3>
              <div className="space-y-2 text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-amber-500 shrink-0" />
                  <span>Main Security Gate: +91 98765 43212</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-amber-500 shrink-0" />
                  <span>identity-support@ococ.campus.edu</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PersonalDashboard

