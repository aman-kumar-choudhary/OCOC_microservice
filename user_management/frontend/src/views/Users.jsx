import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import userService from '@/services/userService'
import { formatDate } from '@/utils/date'
import {
  Search, Download, Upload, Loader2, CreditCard, Camera,
  ChevronLeft, ChevronRight, X, Filter, Edit2,
  ShieldOff, ShieldCheck, UserX, MoreVertical, ChevronDown, ChevronUp
} from 'lucide-react'
import EditUserModal from '@/components/EditUserModal'
import UserStatusModal from '@/components/UserStatusModal'

const courses = [
  'B.Sc. IT', 'BCA', 'M.Sc. Data Science', 'MCA', 'BBA Tourism', 'MBA Tourism',
  'B.A. Mass Comm', 'M.A. Mass Comm', 'B.Sc. Animation', 'M.Sc. Animation',
  'BBA Rural Management', 'MBA Rural Management', 'B.Sc. Environmental Science',
  'M.Sc. Environmental Science', 'B.Ed.', 'M.Ed.', 'B.A. Psychology',
  'M.A. Clinical Psychology', 'B.A. English (Honors)', 'M.A. English',
  'B.A. Sanskrit (Honors)', 'M.A. Sanskrit', 'B.A. Hindi (Honors)',
  'M.A. History and Indian Culture', 'B.A. History (Honors)', 'B.A. Music (Vocal) (Honors)',
  'M.A. Music (Vocal)', 'B.A. Music Instrumental Mridang/Tabla (Honors)',
  'M.A. Music (Tabla, Pakhaawaj)', 'M.A. Hindu Studies', 'M.A. Philosophy',
  'B.Sc. Yogic Science (Honors)', 'M.Sc. Yoga Therapy',
  'M.A. Human Consciousness & Yogic Science', 'M.Sc. Human Consciousness & Yogic Science',
  'P. G. Diploma Human Consciousness, Yoga & Alternative Therapy',
  'Certificate In Yoga And Alternative Therapy'
]
const semesters = ['1', '2', '3', '4', '5', '6', '7', '8']

/* ─── Reusable mini-components ─────────────────────────────────────── */

const Sel = ({ value, onChange, children, id, className = '' }) => (
  <select
    id={id}
    value={value}
    onChange={onChange}
    className={`h-9 rounded-lg border border-[var(--border-light)] bg-white px-3 text-sm text-[var(--text-main)] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition appearance-auto ${className}`}
  >
    {children}
  </select>
)

const Input = ({ className = '', ...props }) => (
  <input
    className={`h-9 rounded-lg border border-[var(--border-light)] bg-white px-3 text-sm text-[var(--text-main)] placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition ${className}`}
    {...props}
  />
)

/* ─── Main view ─────────────────────────────────────────────────────── */

export const UsersView = () => {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)

  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [importError, setImportError] = useState('')
  const importInputRef = useRef(null)

  const [dbDepartments, setDbDepartments] = useState([])
  const [dbHostels, setDbHostels] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [viewTarget, setViewTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [statusAction, setStatusAction] = useState('suspend')
  const [showActionsId, setShowActionsId] = useState(null)

  const [filters, setFilters] = useState({
    search: '',
    user_type: '',
    status: '',
    school: '',
    department: '',
    course: '',
    semester: '',
    hostel_id: '',
    hostel_status: ''
  })

  /* ── Derived data ── */
  const schools = useMemo(
    () => [...new Set(dbDepartments.map((d) => d.school).filter(Boolean))],
    [dbDepartments]
  )
  const filteredDepartments = useMemo(
    () => dbDepartments.filter((d) => !filters.school || d.school === filters.school),
    [dbDepartments, filters.school]
  )

  const hostelMap = useMemo(() => {
    const m = {}
    dbHostels.forEach((h) => { m[h.id] = h.name })
    return m
  }, [dbHostels])

  /* ── Fetching ── */
  const fetchUsers = useCallback(async (customPage) => {
    setIsLoading(true)
    setApiError('')
    try {
      const data = await userService.list({
        page: customPage || page,
        limit,
        ...filters
      })
      setUsers(data.users || [])
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (e) {
      console.error(e)
      setApiError(e.response?.data?.error?.message || 'Failed to load users. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, filters])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchUsers(1) }, 350)
    return () => clearTimeout(timer)
  }, [filters.search])

  useEffect(() => {
    userService.getDepartments().then(setDbDepartments).catch(console.error)
    userService.getHostels().then(setDbHostels).catch(console.error)
    fetchUsers(1)
  }, [])

  useEffect(() => { fetchUsers(1) }, [
    filters.user_type, filters.status, filters.school, filters.department,
    filters.course, filters.semester, filters.hostel_id, filters.hostel_status
  ])

  const handleFilterChange = (updates) => {
    setFilters((prev) => ({ ...prev, ...updates }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ search: '', user_type: '', status: '', school: '', department: '', course: '', semester: '', hostel_id: '', hostel_status: '' })
    setPage(1)
  }

  const hasActiveFilters =
    filters.search || filters.user_type || filters.status ||
    filters.school || filters.department || filters.course || filters.semester ||
    filters.hostel_id || filters.hostel_status

  /* ── Helpers ── */
  const getStatusBadge = (s) => {
    if (s === 'active') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    if (s === 'suspended') return 'bg-amber-50 text-amber-700 border border-amber-200'
    return 'bg-red-50 text-red-600 border border-red-200'
  }

  const getRoleColor = (type) => ({
    student: 'bg-blue-50 text-blue-700 border-blue-200',
    faculty: 'bg-purple-50 text-purple-700 border-purple-200',
    worker: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    visitor: 'bg-orange-50 text-orange-700 border-orange-200',
  }[type] || 'bg-slate-50 text-slate-700 border-slate-200')

  const getIdentifier = (u) => u.profile?.roll_number || u.profile?.employee_id || u.profile?.gov_id_number || '—'
  const getUserName = (u) => u.profile?.full_name || 'Unnamed User'

  const openAction = (user, action) => {
    setStatusTarget(user)
    setStatusAction(action)
    setShowActionsId(null)
  }

  const getHostelName = (u) => {
    if (!u.profile?.hostel_flag) return null
    const id = u.profile?.hostel_id
    return (id && hostelMap[id]) ? hostelMap[id] : 'Hostel'
  }

  /* ── Export / Import ── */
  const exportToCSV = async () => {
    setExportLoading(true)
    try {
      const data = await userService.list({ page: 1, limit: 10000, ...filters })
      const rows = data.users || []
      const headers = ['Name', 'Email', 'Phone', 'Type', 'Identifier', 'Department', 'Status', 'RFID Tag', 'Joined']
      const csvContent = [
        headers.join(','),
        ...rows.map((u) => [
          `"${getUserName(u)}"`, `"${u.email}"`, `"${u.phone || ''}"`,
          u.user_type, `"${getIdentifier(u)}"`, `"${u.profile?.department || ''}"`,
          u.status, u.active_rfid || '', formatDate(u.created_at),
        ].join(','))
      ].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `ococ-users-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
    } catch (e) { console.error(e) }
    finally { setExportLoading(false) }
  }

  const importFromCSV = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    setImportMessage('')
    setImportError('')
    try {
      const result = await userService.importCsv(file)
      const created = result?.created_rows ?? 0
      const invalid = result?.invalid_rows ?? 0
      const failed = result?.failed_rows ?? 0
      setImportMessage(`Import complete: ${created} user${created === 1 ? '' : 's'} added${invalid || failed ? `, ${invalid + failed} row${invalid + failed === 1 ? '' : 's'} skipped` : ''}.`)
      await fetchUsers()
    } catch (e) {
      setImportError(e.response?.data?.error?.message || 'Failed to import CSV. Please check the file and try again.')
    } finally {
      setImportLoading(false)
      if (event.target) event.target.value = ''
    }
  }

  /* ─────────────────────────── JSX ─────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">User Directory</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {!isLoading ? `${total.toLocaleString()} campus identities` : 'Loading directory…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importFromCSV} />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importLoading}
            id="import-csv-btn"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-light)] bg-white text-sm font-semibold text-[var(--text-main)] hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-50"
          >
            {importLoading ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
            Import CSV
          </button>
          <button
            onClick={exportToCSV}
            disabled={exportLoading}
            id="export-csv-btn"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0a2342] text-sm font-semibold text-[#f5bd19] hover:bg-[#12365f] transition disabled:opacity-50 shadow-sm"
          >
            {exportLoading ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
            Export CSV
          </button>
        </div>
      </div>

      {importMessage && <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">{importMessage}</p>}
      {importError && <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{importError}</p>}

      {/* ── Filter Panel ── */}
      <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm p-4">

        {/* Row 1 — Always visible */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              type="text"
              placeholder="Search name, email, roll number…"
              className="w-full pl-9 pr-8"
              id="user-search-input"
            />
            {filters.search && (
              <button onClick={() => setFilters({ ...filters, search: '' })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Type */}
          <Sel
            id="user-type-filter"
            value={filters.user_type}
            onChange={(e) => handleFilterChange({ user_type: e.target.value, school: '', department: '', course: '', semester: '', hostel_id: '', hostel_status: '' })}
            className="w-36"
          >
            <option value="">All Types</option>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="worker">Worker</option>
            <option value="visitor">Visitor</option>
          </Sel>

          {/* Status */}
          <Sel
            id="status-filter"
            value={filters.status}
            onChange={(e) => handleFilterChange({ status: e.target.value })}
            className="w-36"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </Sel>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Advanced toggle — shown only for students */}
          {filters.user_type === 'student' && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-sm font-semibold transition ${showAdvanced ? 'bg-[#0a2342] text-[#f5bd19] border-[#0a2342]' : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-slate-300 hover:text-[var(--text-main)]'}`}
            >
              <Filter size={14} />
              Filters
              {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              id="clear-filters-btn"
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Row 2 — Advanced (student-only, collapsible) */}
        {filters.user_type === 'student' && showAdvanced && (
          <div className="mt-3 pt-3 border-t border-[var(--border-light)] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 animate-fade-in">
            <Sel
              id="school-filter"
              value={filters.school}
              onChange={(e) => handleFilterChange({ school: e.target.value, department: '', course: '' })}
              className="w-full"
            >
              <option value="">All Schools</option>
              {schools.map((s) => <option key={s} value={s}>{s}</option>)}
            </Sel>

            <Sel
              value={filters.department}
              onChange={(e) => handleFilterChange({ department: e.target.value })}
              className="w-full"
            >
              <option value="">All Departments</option>
              {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Sel>

            <Sel
              value={filters.course}
              onChange={(e) => handleFilterChange({ course: e.target.value })}
              className="w-full"
            >
              <option value="">All Courses</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </Sel>

            <Sel
              value={filters.semester}
              onChange={(e) => handleFilterChange({ semester: e.target.value })}
              className="w-full"
            >
              <option value="">All Sems</option>
              {semesters.map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </Sel>

            <Sel
              value={filters.hostel_id}
              onChange={(e) => handleFilterChange({ hostel_id: e.target.value, hostel_status: '' })}
              className="w-full"
            >
              <option value="">All Hostels</option>
              {dbHostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Sel>

            <Sel
              id="hostel-status-filter"
              value={filters.hostel_status}
              onChange={(e) => handleFilterChange({ hostel_status: e.target.value, hostel_id: '' })}
              className="w-full"
            >
              <option value="">All Residence</option>
              <option value="hosteller">🏠 Hosteller</option>
              <option value="day_scholar">🏃 Day Scholar</option>
            </Sel>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden relative animate-fade-in">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="animate-spin text-[#f5bd19]" size={30} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="border-b border-[var(--border-light)] bg-slate-50">
                {['User', 'Role & ID', ...(filters.user_type === 'student' ? ['Course & Sem'] : []), 'Department', ...(filters.user_type === 'student' ? ['Hostel'] : []), 'Status', 'RFID', 'Photo', 'Joined', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)] whitespace-nowrap">
                    {h === 'RFID' ? <span className="flex items-center gap-1"><CreditCard size={11} /> RFID</span>
                      : h === 'Photo' ? <span className="flex items-center gap-1"><Camera size={11} /> Photo</span>
                        : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {apiError && !isLoading ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <ShieldOff size={30} className="text-red-400 opacity-60" />
                    <p className="text-sm font-semibold text-red-500">{apiError}</p>
                    <button onClick={() => fetchUsers()} className="text-xs font-bold text-[#0a2342] hover:underline">Retry</button>
                  </div>
                </td></tr>
              ) : users.length === 0 && !isLoading ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Search size={30} className="text-slate-300" />
                    <p className="text-sm font-semibold text-[var(--text-muted)]">No users match your filters.</p>
                    <button onClick={clearFilters} className="text-xs font-bold text-[#0a2342] hover:underline">Clear filters</button>
                  </div>
                </td></tr>
              ) : (
                users.map((user) => {
                  const hostelName = getHostelName(user)
                  return (
                    <tr
                      key={user.id}
                      className="group hover:bg-amber-50/50 transition-colors cursor-pointer"
                      onClick={() => setViewTarget(user)}
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0a2342]/10 flex items-center justify-center text-sm font-bold text-[#0a2342] shrink-0 select-none overflow-hidden">
                            {user.profile?.photo_reference
                              ? <img src={user.profile.photo_reference} alt="" className="h-full w-full object-cover" />
                              : getUserName(user).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate max-w-[140px] text-[var(--text-main)]">{getUserName(user)}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate max-w-[140px]">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role & ID */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRoleColor(user.user_type)}`}>
                            {user.user_type}
                          </span>
                          <span className="text-xs font-mono text-[var(--text-muted)]">{getIdentifier(user)}</span>
                        </div>
                      </td>

                      {/* Course & Sem */}
                      {filters.user_type === 'student' && (
                        <td className="px-4 py-3">
                          <p className="text-sm text-[var(--text-main)] truncate max-w-[130px]">{user.profile?.course || '—'}</p>
                          {user.profile?.semester && <p className="text-xs text-[var(--text-muted)]">Sem {user.profile.semester}</p>}
                        </td>
                      )}

                      {/* Dept */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--text-muted)]">{user.profile?.department || user.profile?.school || '—'}</span>
                      </td>

                      {/* Hostel — shows actual hostel name */}
                      {filters.user_type === 'student' && (
                        <td className="px-4 py-3">
                          {hostelName ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-semibold text-purple-700 max-w-[110px] truncate" title={hostelName}>
                              🏠 {hostelName}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">Day Scholar</span>
                          )}
                        </td>
                      )}

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${getStatusBadge(user.status)}`}>
                          {user.status}
                        </span>
                      </td>

                      {/* RFID */}
                      <td className="px-4 py-3 text-center">
                        {user.active_rfid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700 font-mono" title={user.active_rfid}>
                            <CreditCard size={11} /> {user.active_rfid.slice(0, 8)}…
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Photo */}
                      <td className="px-4 py-3 text-center">
                        {user.profile?.photo_reference ? (
                          <img src={user.profile.photo_reference} alt={`${getUserName(user)} passport photo`} className="h-9 w-7 mx-auto rounded border border-slate-200 object-cover" />
                        ) : <span className="text-xs text-[var(--text-muted)]">—</span>}
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">{formatDate(user.created_at)}</td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <button
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-[var(--text-muted)] transition-colors"
                            onClick={() => setShowActionsId(showActionsId === user.id ? null : user.id)}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {showActionsId === user.id && (
                            <div className="absolute right-0 top-9 z-20 min-w-[170px] rounded-xl border border-[var(--border-light)] bg-white p-1 shadow-xl">
                              <button className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 rounded-lg transition" onClick={() => { setEditTarget(user); setShowActionsId(null) }}>
                                <Edit2 size={13} /> Edit Profile
                              </button>
                              {user.status !== 'active' ? (
                                <button className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition" onClick={() => openAction(user, 'activate')}>
                                  <ShieldCheck size={13} /> Activate
                                </button>
                              ) : (
                                <button className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 rounded-lg transition" onClick={() => openAction(user, 'suspend')}>
                                  <ShieldOff size={13} /> Suspend
                                </button>
                              )}
                              <button className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition" onClick={() => openAction(user, 'deactivate')}>
                                <UserX size={13} /> Deactivate
                              </button>
                              <div className="my-1 border-t border-[var(--border-light)]" />
                              <button className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 rounded-lg transition" onClick={() => openAction(user, 'delete')}>
                                <UserX size={13} /> Delete permanently
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-[var(--border-light)] flex justify-between items-center text-sm bg-slate-50/60">
          <span className="text-[var(--text-muted)]">
            Showing <strong className="text-[var(--text-main)]">{users.length ? (page - 1) * limit + 1 : 0}</strong>–
            <strong className="text-[var(--text-main)]">{Math.min(page * limit, total)}</strong> of{' '}
            <strong className="text-[var(--text-main)]">{total.toLocaleString()}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-[var(--text-muted)] hover:border-amber-400 hover:text-[#0a2342] disabled:opacity-40 disabled:cursor-not-allowed transition"
              disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); fetchUsers(p) }}
              id="prev-page-btn"
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => { setPage(p); fetchUsers(p) }}
                className={`h-8 min-w-[2rem] px-2 rounded-lg border text-xs font-bold transition ${p === page ? 'bg-[#0a2342] text-[#f5bd19] border-[#0a2342]' : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-amber-400 hover:text-[#0a2342]'}`}
              >
                {p}
              </button>
            ))}
            {totalPages > 7 && <span className="text-[var(--text-muted)] px-1">…</span>}
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-[var(--text-muted)] hover:border-amber-400 hover:text-[#0a2342] disabled:opacity-40 disabled:cursor-not-allowed transition"
              disabled={page >= totalPages}
              onClick={() => { const p = page + 1; setPage(p); fetchUsers(p) }}
              id="next-page-btn"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Drawer: User Details ── */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewTarget(null)} />
          <div className="relative z-10 w-full max-w-lg h-full bg-[var(--bg-main)] shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">

            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[var(--border-light)] shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#0a2342]/10 flex items-center justify-center text-base font-bold text-[#0a2342] shrink-0 overflow-hidden">
                  {viewTarget.profile?.photo_reference
                    ? <img src={viewTarget.profile.photo_reference} alt={`${getUserName(viewTarget)} passport photo`} className="h-full w-full object-cover" />
                    : getUserName(viewTarget).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-main)] leading-tight">{getUserName(viewTarget)}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getRoleColor(viewTarget.user_type)}`}>{viewTarget.user_type}</span>
                    <span className="text-xs text-[var(--text-muted)]">{viewTarget.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditTarget(viewTarget); setViewTarget(null) }} className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition" title="Edit User">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => setViewTarget(null)} className="p-2 rounded-lg hover:bg-slate-100 text-[var(--text-muted)] transition" title="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Status & Identity */}
              <div className="rounded-xl border border-[var(--border-light)] p-4 bg-white">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#0a2342] mb-3 pb-2 border-b border-[var(--border-light)]">Status & Identity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Account Status</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${getStatusBadge(viewTarget.status)}`}>{viewTarget.status}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Primary ID</p>
                    <p className="text-sm font-mono font-medium">{getIdentifier(viewTarget)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">RFID Tag</p>
                    {viewTarget.active_rfid
                      ? <span className="text-sm font-mono text-emerald-700">{viewTarget.active_rfid.slice(0, 8)}…</span>
                      : <span className="text-sm text-[var(--text-muted)]">None</span>}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Face Enrollment</p>
                    {viewTarget.has_face_auth
                      ? <span className="text-sm font-semibold text-blue-700">Enrolled</span>
                      : <span className="text-sm text-[var(--text-muted)]">Not enrolled</span>}
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="rounded-xl border border-[var(--border-light)] p-4 bg-white">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#0a2342] mb-3 pb-2 border-b border-[var(--border-light)]">Profile Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Phone Number</p>
                    <p className="text-sm">{viewTarget.phone || '—'}</p>
                  </div>

                  {viewTarget.user_type === 'student' && (<>
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">School & Department</p>
                      <p className="text-sm">{viewTarget.profile?.school || '—'}</p>
                      <p className="text-sm text-[var(--text-muted)] mt-0.5">{viewTarget.profile?.department || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Course</p>
                      <p className="text-sm">{viewTarget.profile?.course || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Semester</p>
                      <p className="text-sm">{viewTarget.profile?.semester || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Guardian Contact</p>
                      <p className="text-sm">{viewTarget.profile?.guardian_contact || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Nationality</p>
                      <p className="text-sm capitalize">{viewTarget.profile?.nationality || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Government ID</p>
                      <p className="text-sm">{viewTarget.profile?.gov_id_type || '—'}</p>
                      <p className="text-xs text-[var(--text-muted)] font-mono">{viewTarget.profile?.gov_id_number || ''}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Hostel</p>
                      {viewTarget.profile?.hostel_flag ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-sm font-semibold text-purple-700">
                          🏠 {viewTarget.profile?.hostel_id && hostelMap[viewTarget.profile.hostel_id]
                            ? hostelMap[viewTarget.profile.hostel_id]
                            : 'Hostel Resident'}
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">Day Scholar</span>
                      )}
                    </div>
                  </>)}

                  {(viewTarget.user_type === 'faculty' || viewTarget.user_type === 'worker') && (<>
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Designation</p>
                      <p className="text-sm">{viewTarget.profile?.designation || '—'}</p>
                    </div>
                    {viewTarget.user_type === 'faculty' && (
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Department</p>
                        <p className="text-sm">{viewTarget.profile?.department || '—'}</p>
                      </div>
                    )}
                  </>)}

                  {viewTarget.user_type === 'visitor' && (<>
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Visit Purpose</p>
                      <p className="text-sm">{viewTarget.profile?.visit_purpose || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">Host Contact</p>
                      <p className="text-sm">{viewTarget.profile?.host_contact || '—'}</p>
                    </div>
                  </>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchUsers() }}
        />
      )}

      {statusTarget && (
        <UserStatusModal
          user={statusTarget}
          action={statusAction}
          onClose={() => setStatusTarget(null)}
          onDone={() => { setStatusTarget(null); fetchUsers() }}
        />
      )}
    </div>
  )
}

export default UsersView
