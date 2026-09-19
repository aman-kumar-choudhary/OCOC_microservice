import React, { useState, useEffect, useMemo, useCallback } from 'react'
import api from '@/services/api'
import { formatDateTime, timeAgo } from '@/utils/date'
import {
  ShieldCheck, ShieldX, Activity, RefreshCw, Search,
  ChevronLeft, ChevronRight, Loader2, Calendar, X
} from 'lucide-react'

export const FaceAuthLog = () => {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showDateRange, setShowDateRange] = useState(false)

  const [filters, setFilters] = useState({ result: '', auth_type: '', from: '', to: '' })
  const [searchPerson, setSearchPerson] = useState('')

  const fetchLogs = useCallback(async (customPage) => {
    setIsLoading(true)
    try {
      const params = { page: customPage || page, limit, ...filters }
      if (searchPerson) params.person_id = searchPerson
      const { data } = await api.get('/face-auth/logs', { params })
      setLogs(data.data?.logs || [])
      setTotal(data.data?.total || 0)
      setTotalPages(data.data?.total_pages || 1)
    } catch {
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, filters, searchPerson])

  useEffect(() => { fetchLogs(1) }, [filters.result, filters.auth_type, filters.from, filters.to])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => fetchLogs(), 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const todayStats = useMemo(() => {
    const success = logs.filter((l) => l.result === 'success').length
    const failed = logs.filter((l) => l.result !== 'success').length
    const tot = logs.length
    const passRate = tot > 0 ? Math.round((success / tot) * 100) : 0
    const scoredLogs = logs.filter((l) => l.similarity_score != null)
    const avgSim = scoredLogs.reduce((a, l) => a + (l.similarity_score ?? 0), 0) / (scoredLogs.length || 1)
    return { success, failed, total: tot, passRate, avgSim: Math.round(avgSim * 100) }
  }, [logs])

  const resultStyle = (result) => {
    if (result === 'success') return { pill: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25', isSuccess: true }
    if (result === 'liveness_failed') return { pill: 'bg-orange-500/10 text-orange-600 border-orange-500/25', isSuccess: false }
    return { pill: 'bg-red-500/10 text-red-600 border-red-500/25', isSuccess: false }
  }

  const resultLabel = (r) => {
    if (r === 'success') return 'AUTHENTICATED'
    if (r === 'liveness_failed') return 'LIVENESS FAIL'
    if (r === 'unknown') return 'UNKNOWN'
    return 'REJECTED'
  }

  const confColor = (score) => {
    if (!score) return 'bg-slate-400'
    if (score >= 0.75) return 'bg-emerald-500'
    if (score >= 0.55) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const hasDateFilter = filters.from || filters.to
  const clearDates = () => setFilters((f) => ({ ...f, from: '', to: '' }))

  /* ── Result filter buttons ── */
  const resultOptions = [
    { value: '', label: 'All' },
    { value: 'success', label: '✓ Auth' },
    { value: 'failed', label: '✗ Rejected' },
    { value: 'liveness_failed', label: 'Liveness' },
  ]
  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'single', label: '👤 Single' },
    { value: 'mass', label: '👥 Mass' },
  ]

  const chipBtn = (active) =>
    `h-8 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${active
      ? 'bg-[#0a2342] text-[#f5bd19] border-[#0a2342]'
      : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-slate-300 hover:text-[var(--text-main)] bg-white'}`

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Auth Monitor</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Real-time face authentication event log</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${autoRefresh
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
              : 'border-[var(--border-light)] text-[var(--text-muted)] bg-white'}`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={() => fetchLogs()}
            id="refresh-auth-log-btn"
            className="h-8 w-8 grid place-items-center rounded-lg border border-[var(--border-light)] bg-white hover:bg-slate-50 transition text-[var(--text-muted)]"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: total.toLocaleString(), color: '' },
          { label: 'Authenticated', value: todayStats.success, color: 'text-emerald-600' },
          { label: 'Rejected', value: todayStats.failed, color: 'text-red-500' },
          { label: 'Pass Rate', value: `${todayStats.passRate}%`, color: todayStats.passRate >= 80 ? 'text-emerald-600' : 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-[var(--border-light)] rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
            <span className={`text-2xl font-extrabold ${color}`}>{value}</span>
            {label === 'Pass Rate' && (
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                <div className={`h-full rounded-full transition-all ${todayStats.passRate >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${todayStats.passRate}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Compact Filter Bar ── */}
      <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm px-4 py-3 space-y-2">

        {/* Row 1 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Person search */}
          <div className="relative w-44">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={searchPerson}
              onChange={(e) => setSearchPerson(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchLogs(1) }}
              placeholder="Person ID…"
              className="h-8 w-full rounded-lg border border-[var(--border-light)] bg-white pl-7 pr-3 text-xs text-[var(--text-main)] placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
            />
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-[var(--border-light)]" />

          {/* Result chips */}
          <div className="flex items-center gap-1">
            {resultOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilters((f) => ({ ...f, result: value }))}
                className={chipBtn(filters.result === value)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-[var(--border-light)]" />

          {/* Auth type chips */}
          <div className="flex items-center gap-1">
            {typeOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilters((f) => ({ ...f, auth_type: value }))}
                className={chipBtn(filters.auth_type === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Date range toggle */}
          <button
            onClick={() => setShowDateRange(!showDateRange)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition ${showDateRange || hasDateFilter
              ? 'bg-[#0a2342] text-[#f5bd19] border-[#0a2342]'
              : 'border-[var(--border-light)] text-[var(--text-muted)] bg-white hover:border-slate-300'}`}
          >
            <Calendar size={12} />
            {hasDateFilter ? 'Dates set' : 'Date range'}
          </button>
        </div>

        {/* Row 2 — Date range (collapsible) */}
        {showDateRange && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-light)] animate-fade-in">
            <label className="text-xs font-semibold text-[var(--text-muted)] w-8">From</label>
            <input
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              type="date"
              className="h-8 rounded-lg border border-[var(--border-light)] bg-white px-2.5 text-xs text-[var(--text-main)] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
            />
            <label className="text-xs font-semibold text-[var(--text-muted)]">To</label>
            <input
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              type="date"
              className="h-8 rounded-lg border border-[var(--border-light)] bg-white px-2.5 text-xs text-[var(--text-main)] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
            />
            {hasDateFilter && (
              <button onClick={clearDates} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-red-200 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                <X size={11} /> Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Log Table ── */}
      <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#f5bd19]" size={28} />
          </div>
        )}

        {logs.length === 0 && !isLoading ? (
          <div className="py-20 text-center">
            <Activity size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-[var(--text-muted)]">No authentication events found.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Run a face match from Face Lab to see events here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {logs.map((log) => {
              const style = resultStyle(log.result)
              return (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors group">

                  {/* Result */}
                  <div className="flex items-center gap-2 w-44 shrink-0">
                    {style.isSuccess
                      ? <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
                      : <ShieldX size={18} className="text-red-500 shrink-0" />}
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border tracking-wider ${style.pill}`}>
                      {resultLabel(log.result)}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="w-36 shrink-0">
                    <div className="text-sm font-semibold font-mono">{formatDateTime(log.created_at)}</div>
                    <div className="text-xs text-[var(--text-muted)]">{timeAgo(log.created_at)}</div>
                  </div>

                  {/* Person */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{log.person_name || 'Unknown Person'}</div>
                    <div className="text-xs text-[var(--text-muted)] font-mono truncate">{log.person_external_id || '—'}</div>
                  </div>

                  {/* Auth type */}
                  <div className="shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${log.auth_type === 'mass'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {log.auth_type === 'mass' ? '👥 Mass' : '👤 Single'}
                    </span>
                  </div>

                  {/* Confidence */}
                  {log.similarity_score != null && (
                    <div className="w-24 shrink-0">
                      <div className="text-[10px] text-[var(--text-muted)] mb-1">Confidence</div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${confColor(log.similarity_score)}`} style={{ width: `${Math.round(log.similarity_score * 100)}%` }} />
                        </div>
                        <span className="text-xs font-bold w-8 text-right">{Math.round((log.similarity_score ?? 0) * 100)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="shrink-0 text-xs text-[var(--text-muted)] w-32 truncate" title={log.reason}>{log.reason || '—'}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border-light)] flex justify-between items-center text-sm bg-slate-50/60">
            <span className="text-[var(--text-muted)]">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-[var(--text-muted)] hover:border-amber-400 disabled:opacity-40 transition"
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); fetchLogs(p) }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-[var(--text-muted)] hover:border-amber-400 disabled:opacity-40 transition"
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); fetchLogs(p) }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FaceAuthLog
