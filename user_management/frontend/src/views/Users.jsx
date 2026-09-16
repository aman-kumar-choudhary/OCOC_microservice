import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import userService from '@/services/userService'
import { formatDate } from '@/utils/date'
import {
  Search, Download, Upload, Loader2, CreditCard, Camera,
  ChevronLeft, ChevronRight, X, Filter, Edit2,
  ShieldOff, ShieldCheck, UserX, MoreVertical
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

  // Modal / Drawer state
  const [viewTarget, setViewTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [statusAction, setStatusAction] = useState('suspend')
  const [showActionsId, setShowActionsId] = useState(null)

  const [filters, setFilters] = useState({
    search: '',
    user_type: 'student',
    status: '',
    school: '',
    department: '',
    course: '',
    semester: '',
    hostel_id: '',
    hostel_status: ''
  })

  const schools = useMemo(
    () => [...new Set(dbDepartments.map((d) => d.school).filter(Boolean))],
    [dbDepartments]
  )
  const filteredDepartments = useMemo(
    () => dbDepartments.filter((d) => !filters.school || d.school === filters.school),
    [dbDepartments, filters.school]
  )

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
    const timer = setTimeout(() => {
      setPage(1)
      fetchUsers(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.search])

  useEffect(() => {
    userService.getDepartments().then(setDbDepartments).catch(console.error)
    userService.getHostels().then(setDbHostels).catch(console.error)
    fetchUsers(1)
  }, [])

  const handleFilterChange = (updates) => {
    setFilters((prev) => ({ ...prev, ...updates }))
    setPage(1)
  }

  // Re-fetch on filter change
  useEffect(() => {
    fetchUsers(1)
  }, [filters.user_type, filters.status, filters.school, filters.department, filters.course, filters.semester, filters.hostel_id, filters.hostel_status])

  const clearFilters = () => {
    setFilters({
      search: '',
      user_type: 'student',
      status: '',
      school: '',
      department: '',
      course: '',
      semester: '',
      hostel_id: '',
      hostel_status: ''
    })
    setPage(1)
  }

  const hasActiveFilters =
    filters.search ||
    filters.user_type !== 'student' ||
    filters.status ||
    filters.school ||
    filters.department ||
    filters.course ||
    filters.semester ||
    filters.hostel_id ||
    filters.hostel_status

  const getStatusClass = (status) => {
    if (status === 'active') return 'badge-active'
    if (status === 'suspended') return 'badge-suspended'
    return 'badge-deactivated'
  }

  const getRoleColor = (type) => {
    const map = {
      student: 'bg-blue-50 text-blue-700 border-blue-200',
      faculty: 'bg-purple-50 text-purple-700 border-purple-200',
      worker: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      visitor: 'bg-orange-50 text-orange-700 border-orange-200',
    }
    return map[type] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const getIdentifier = (user) => {
    const p = user.profile
    return p?.roll_number || p?.employee_id || p?.gov_id_number || '—'
  }

  const getUserName = (user) => {
    return user.profile?.full_name || 'Unnamed User'
  }

  const openAction = (user, action) => {
    setStatusTarget(user)
    setStatusAction(action)
    setShowActionsId(null)
  }

  const exportToCSV = async () => {
    setExportLoading(true)
    try {
      const data = await userService.list({ page: 1, limit: 10000, ...filters })
      const rows = data.users || []
      const headers = ['Name', 'Email', 'Phone', 'Type', 'Identifier', 'Department', 'Status', 'RFID Tag', 'Joined']
      const csvContent = [
        headers.join(','),
        ...rows.map((u) => [
          `"${getUserName(u)}"`,
          `"${u.email}"`,
          `"${u.phone || ''}"`,
          u.user_type,
          `"${getIdentifier(u)}"`,
          `"${u.profile?.department || ''}"`,
          u.status,
          u.active_rfid || '',
          formatDate(u.created_at),
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `ococ-users-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
    } catch (e) {
      console.error(e)
    } finally {
      setExportLoading(false)
    }
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
      setImportMessage(
        `Import complete: ${created} user${created === 1 ? '' : 's'} added${
          invalid || failed ? `, ${invalid + failed} row${invalid + failed === 1 ? '' : 's'} skipped` : ''
        }.`
      )
      await fetchUsers()
    } catch (e) {
      console.error(e)
      setImportError(
        e.response?.data?.error?.message || 'Failed to import CSV. Please check the file and try again.'
      )
    } finally {
      setImportLoading(false)
      if (event.target) event.target.value = ''
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold">User Directory</h1>
          <p className="text-muted text-sm mt-1">
            {!isLoading ? `${total.toLocaleString()} campus identities` : 'Loading directory…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={importFromCSV}
          />
          <button
            className="btn btn-outline"
            onClick={() => importInputRef.current?.click()}
            disabled={importLoading}
            id="import-csv-btn"
          >
            {importLoading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            Import CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={exportToCSV}
            disabled={exportLoading}
            id="export-csv-btn"
          >
            {exportLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Export CSV
          </button>
        </div>
      </div>

      {importMessage && <p className="mb-4 text-sm font-semibold text-emerald-700">{importMessage}</p>}
      {importError && <p className="mb-4 text-sm font-semibold text-red-600">{importError}</p>}

      {/* Filters */}
      <div className="glass-panel p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-bold">Find a campus identity</p>
            <p className="text-xs text-muted mt-0.5">Use the filters below to narrow the directory.</p>
          </div>
          {hasActiveFilters && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              Filters applied
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1.4fr)_repeat(3,minmax(150px,1fr))]">
          <div className="relative min-w-0 xl:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              type="text"
              placeholder="Search name, email, roll number…"
              className="form-input pl-9 pr-8"
              id="user-search-input"
            />
            {filters.search && (
              <button
                onClick={() => setFilters({ ...filters, search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-red-500 transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="relative min-w-0">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <select
              value={filters.user_type}
              onChange={(e) => handleFilterChange({ user_type: e.target.value })}
              className="form-input form-select pl-8 text-sm"
              id="user-type-filter"
            >
              <option value="">All Registration Types</option>
              <option value="student">🎓 Student</option>
              <option value="faculty">👨‍🏫 Faculty</option>
              <option value="worker">🔧 Worker</option>
              <option value="visitor">👤 Visitor</option>
            </select>
          </div>

          {/* Student specific filters */}
          {filters.user_type === 'student' && (
            <>
              <select
                value={filters.school}
                onChange={(e) => handleFilterChange({ school: e.target.value, department: '', course: '' })}
                className="form-input form-select text-sm"
                id="school-filter"
              >
                <option value="">All Schools</option>
                {schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>

              <select
                value={filters.course}
                onChange={(e) => handleFilterChange({ course: e.target.value })}
                className="form-input form-select text-sm"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filters.semester}
                onChange={(e) => handleFilterChange({ semester: e.target.value })}
                className="form-input form-select text-sm"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s} value={s}>
                    Sem {s}
                  </option>
                ))}
              </select>

              <select
                value={filters.department}
                onChange={(e) => handleFilterChange({ department: e.target.value })}
                className="form-input form-select text-sm"
              >
                <option value="">All Departments</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.hostel_id}
                onChange={(e) => handleFilterChange({ hostel_id: e.target.value, hostel_status: '' })}
                className="form-input form-select text-sm"
              >
                <option value="">All Hostels</option>
                {dbHostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.hostel_status}
                onChange={(e) => handleFilterChange({ hostel_status: e.target.value, hostel_id: '' })}
                className="form-input form-select text-sm"
                id="hostel-status-filter"
              >
                <option value="">All Residence Types</option>
                <option value="resident">Hostel Resident</option>
                <option value="day_scholar">Day Scholar</option>
              </select>
            </>
          )}

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange({ status: e.target.value })}
            className="form-input form-select text-sm"
            id="status-filter"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn btn-outline text-red-500 border-red-200 hover:bg-red-50 text-sm xl:col-span-1"
              id="clear-filters-btn"
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-container animate-fade-in relative overflow-x-auto">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-card)]/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
            <Loader2 className="animate-spin text-[#f5bd19]" size={32} />
          </div>
        )}

        <table className="table min-w-[1080px]">
          <thead>
            <tr>
              <th>User</th>
              <th>Role & ID</th>
              {filters.user_type === 'student' && <th>Course & Sem</th>}
              <th>Department / School</th>
              {filters.user_type === 'student' && <th>Hostel</th>}
              <th>Status</th>
              <th className="text-center">
                <span className="flex items-center justify-center gap-1">
                  <CreditCard size={13} /> RFID Tag
                </span>
              </th>
              <th className="text-center">
                <span className="flex items-center justify-center gap-1">
                  <Camera size={13} /> Photo
                </span>
              </th>
              <th>Joined</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiError && !isLoading ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-red-500">
                  <div className="flex flex-col items-center gap-3">
                    <ShieldOff size={32} className="opacity-50" />
                    <p className="text-sm font-semibold">{apiError}</p>
                    <button onClick={() => fetchUsers()} className="text-xs font-bold hover:underline">
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-muted">
                  <div className="flex flex-col items-center gap-3">
                    <Search size={32} className="opacity-30" />
                    <p className="text-sm font-semibold">No users match your filters.</p>
                    <button onClick={clearFilters} className="text-xs text-[#0a2342] font-bold hover:underline">
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="group cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setViewTarget(user)}
                >
                  {/* User Name & Email */}
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#0a2342]/8 flex items-center justify-center text-sm font-bold text-[#0a2342] shrink-0">
                        {getUserName(user).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate max-w-[150px] text-[var(--text-main)]">
                          {getUserName(user)}
                        </span>
                        <span className="text-xs text-muted truncate max-w-[150px]">{user.email}</span>
                      </div>
                    </div>
                  </td>

                  {/* Role & Identifier */}
                  <td>
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`badge border text-[10px] uppercase font-bold tracking-wider ${getRoleColor(user.user_type)}`}>
                        {user.user_type}
                      </span>
                      <span className="text-xs font-mono font-medium text-muted" title="Identifier">
                        {getIdentifier(user)}
                      </span>
                    </div>
                  </td>

                  {/* Course & Sem (Students only) */}
                  {filters.user_type === 'student' && (
                    <td>
                      <div className="flex flex-col">
                        <span className="text-sm">{user.profile?.course || '—'}</span>
                        {user.profile?.semester && (
                          <span className="text-xs text-muted">Sem {user.profile?.semester}</span>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Dept / School */}
                  <td>
                    <span className="text-sm text-muted">
                      {user.profile?.department || user.profile?.school || '—'}
                    </span>
                  </td>

                  {/* Hostel (Students only) */}
                  {filters.user_type === 'student' && (
                    <td>
                      {user.profile?.hostel_flag ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                          Hostel
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  )}

                  {/* Status */}
                  <td>
                    <span className={`badge ${getStatusClass(user.status)}`}>{user.status}</span>
                  </td>

                  {/* RFID Tag */}
                  <td className="text-center">
                    {user.active_rfid ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 font-mono"
                        title={user.active_rfid}
                      >
                        <CreditCard size={12} /> {user.active_rfid.slice(0, 8)}…
                      </span>
                    ) : (
                      <span className="text-xs text-muted">— None</span>
                    )}
                  </td>

                  {/* Photo */}
                  <td className="text-center">
                    {user.has_face_auth ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                        <Camera size={12} /> Enrolled
                      </span>
                    ) : (
                      <span className="text-xs text-muted">— None</span>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="text-sm text-muted whitespace-nowrap">{formatDate(user.created_at)}</td>

                  {/* Actions */}
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <button
                        className="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted transition-colors"
                        onClick={() => setShowActionsId(showActionsId === user.id ? null : user.id)}
                      >
                        <MoreVertical size={17} />
                      </button>
                      {showActionsId === user.id && (
                        <div className="absolute right-0 top-9 z-20 min-w-[170px] rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-1 shadow-xl">
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors"
                            onClick={() => {
                              setEditTarget(user)
                              setShowActionsId(null)
                            }}
                          >
                            <Edit2 size={14} /> Edit Profile
                          </button>
                          {user.status !== 'active' ? (
                            <button
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-emerald-700"
                              onClick={() => openAction(user, 'activate')}
                            >
                              <ShieldCheck size={14} /> Activate
                            </button>
                          ) : (
                            <button
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-amber-700"
                              onClick={() => openAction(user, 'suspend')}
                            >
                              <ShieldOff size={14} /> Suspend
                            </button>
                          )}
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-red-600"
                            onClick={() => openAction(user, 'deactivate')}
                          >
                            <UserX size={14} /> Deactivate
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-red-50 rounded-lg transition-colors text-red-700"
                            onClick={() => openAction(user, 'delete')}
                          >
                            <UserX size={14} /> Delete permanently
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm bg-[var(--bg-card)] rounded-b-2xl">
          <div className="text-muted">
            Showing <span className="font-semibold text-[var(--text-main)]">{users.length ? (page - 1) * limit + 1 : 0}</span>–
            <span className="font-semibold text-[var(--text-main)]">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-semibold text-[var(--text-main)]">{total.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-[#f5bd19] hover:text-[#0a2342] disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page <= 1}
              onClick={() => {
                const prev = page - 1
                setPage(prev)
                fetchUsers(prev)
              }}
              id="prev-page-btn"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPage(p)
                  fetchUsers(p)
                }}
                className={`h-8 min-w-[2rem] px-2 rounded-lg border text-xs font-bold transition ${
                  p === page
                    ? 'bg-[#0a2342] text-[#f5bd19] border-[#0a2342]'
                    : 'border-[var(--border-light)] text-muted hover:border-[#f5bd19] hover:text-[#0a2342]'
                }`}
              >
                {p}
              </button>
            ))}
            {totalPages > 7 && <span className="text-muted px-1">…</span>}
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-[#f5bd19] hover:text-[#0a2342] disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page >= totalPages}
              onClick={() => {
                const next = page + 1
                setPage(next)
                fetchUsers(next)
              }}
              id="next-page-btn"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Drawer: User Details ─── */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewTarget(null)} />
          <div className="relative z-10 w-full max-w-lg h-full bg-[var(--bg-main)] shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-[var(--bg-card)] border-b border-[var(--border-light)] shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#0a2342]/8 flex items-center justify-center text-lg font-bold text-[#0a2342] shrink-0">
                  {getUserName(viewTarget).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[var(--text-main)] leading-tight">
                    {getUserName(viewTarget)}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge border text-[10px] uppercase font-bold tracking-wider ${getRoleColor(viewTarget.user_type)}`}>
                      {viewTarget.user_type}
                    </span>
                    <span className="text-xs text-muted">{viewTarget.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditTarget(viewTarget)
                    setViewTarget(null)
                  }}
                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-slate-700"
                  title="Edit User"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => setViewTarget(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-muted shrink-0"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#0a2342] mb-4 border-b border-[var(--border-light)] pb-2">
                  Status & Identity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted mb-1 font-semibold">Account Status</p>
                    <span className={`badge ${getStatusClass(viewTarget.status)}`}>{viewTarget.status}</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 font-semibold">Primary Identifier</p>
                    <p className="text-sm font-mono font-medium">{getIdentifier(viewTarget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 font-semibold">RFID Tag</p>
                    {viewTarget.active_rfid ? (
                      <span className="text-sm font-mono font-medium text-emerald-700">
                        {viewTarget.active_rfid.slice(0, 8)}…
                      </span>
                    ) : (
                      <span className="text-sm text-muted">None</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 font-semibold">Face Enrollment</p>
                    {viewTarget.has_face_auth ? (
                      <span className="text-sm font-semibold text-blue-700">Enrolled</span>
                    ) : (
                      <span className="text-sm text-muted">Not enrolled</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#0a2342] mb-4 border-b border-[var(--border-light)] pb-2">
                  Profile Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-xs text-muted mb-1 font-semibold">Phone Number</p>
                    <p className="text-sm">{viewTarget.phone || '—'}</p>
                  </div>

                  {viewTarget.user_type === 'student' && (
                    <>
                      <div className="col-span-2">
                        <p className="text-xs text-muted mb-1 font-semibold">School & Department</p>
                        <p className="text-sm">{viewTarget.profile?.school || '—'}</p>
                        <p className="text-sm text-muted mt-0.5">{viewTarget.profile?.department || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted mb-1 font-semibold">Course</p>
                        <p className="text-sm">{viewTarget.profile?.course || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted mb-1 font-semibold">Semester</p>
                        <p className="text-sm">{viewTarget.profile?.semester || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted mb-1 font-semibold">Guardian Contact</p>
                        <p className="text-sm">{viewTarget.profile?.guardian_contact || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted mb-1 font-semibold">Hostel Resident</p>
                        <p className="text-sm">
                          {viewTarget.profile?.hostel_flag ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                              Yes (Hostel ID: {viewTarget.profile?.hostel_id})
                            </span>
                          ) : (
                            <span>No (Day Scholar)</span>
                          )}
                        </p>
                      </div>
                    </>
                  )}

                  {(viewTarget.user_type === 'faculty' || viewTarget.user_type === 'worker') && (
                    <>
                      <div className="col-span-2">
                        <p className="text-xs text-muted mb-1 font-semibold">Designation</p>
                        <p className="text-sm">{viewTarget.profile?.designation || '—'}</p>
                      </div>
                      {viewTarget.user_type === 'faculty' && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted mb-1 font-semibold">Department</p>
                          <p className="text-sm">{viewTarget.profile?.department || '—'}</p>
                        </div>
                      )}
                    </>
                  )}

                  {viewTarget.user_type === 'visitor' && (
                    <>
                      <div className="col-span-2">
                        <p className="text-xs text-muted mb-1 font-semibold">Visit Purpose</p>
                        <p className="text-sm">{viewTarget.profile?.visit_purpose || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted mb-1 font-semibold">Host Contact</p>
                        <p className="text-sm">{viewTarget.profile?.host_contact || '—'}</p>
                      </div>
                    </>
                  )}
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
          onSaved={() => {
            setEditTarget(null)
            fetchUsers()
          }}
        />
      )}

      {statusTarget && (
        <UserStatusModal
          user={statusTarget}
          action={statusAction}
          onClose={() => setStatusTarget(null)}
          onDone={() => {
            setStatusTarget(null)
            fetchUsers()
          }}
        />
      )}
    </div>
  )
}

export default UsersView
