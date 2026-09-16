import React, { useState, useEffect, useMemo, useCallback } from 'react'
import api from '@/services/api'
import { formatDateTime, timeAgo } from '@/utils/date'
import {
  ShieldCheck, ShieldX, Activity, RefreshCw, Search,
  ChevronLeft, ChevronRight, Loader2
} from 'lucide-react'

export const FaceAuthLog = () => {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const [filters, setFilters] = useState({ result: '', auth_type: '', from: '', to: '' })
  const [searchPerson, setSearchPerson] = useState('')

  const fetchLogs = useCallback(async (customPage) => {
    setIsLoading(true)
    try {
      const params = {
        page: customPage || page,
        limit,
        ...filters,
      }
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

  useEffect(() => {
    fetchLogs(1)
  }, [filters.result, filters.auth_type, filters.from, filters.to])

  useEffect(() => {
    let interval
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs()
      }, 10000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
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
    if (result === 'success') {
      return { pill: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25', isSuccess: true }
    }
    if (result === 'liveness_failed') {
      return { pill: 'bg-orange-500/10 text-orange-600 border-orange-500/25', isSuccess: false }
    }
    return { pill: 'bg-red-500/10 text-red-600 border-red-500/25', isSuccess: false }
  }

  const resultLabel = (r) => {
    if (r === 'success') return 'AUTHENTICATED'
    if (r === 'liveness_failed') return 'LIVENESS FAIL'
    if (r === 'unknown') return 'UNKNOWN'
    return 'REJECTED'
  }

  const confColor = (score) => {
    if (!score) return 'bg-gray-600'
    if (score >= 0.75) return 'bg-emerald-500'
    if (score >= 0.55) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Auth Monitor</h1>
          <p className="text-muted text-sm mt-1">Real-time face authentication event log</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                : 'border-[var(--border-light)] text-muted'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`}
            ></span>
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={() => fetchLogs()} className="btn btn-outline py-1.5 px-3" id="refresh-auth-log-btn">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-xs text-muted font-semibold uppercase tracking-wide">Total Events</span>
          <span className="text-3xl font-extrabold">{total.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-xs text-muted font-semibold uppercase tracking-wide">Pass Rate</span>
          <div className="flex items-end gap-1">
            <span className={`text-3xl font-extrabold ${todayStats.passRate >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
              {todayStats.passRate}
            </span>
            <span className="text-muted pb-1">%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--border-light)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${todayStats.passRate >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${todayStats.passRate}%` }}
            />
          </div>
        </div>
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-xs text-muted font-semibold uppercase tracking-wide">Authenticated</span>
          <span className="text-3xl font-extrabold text-emerald-600">{todayStats.success}</span>
        </div>
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-xs text-muted font-semibold uppercase tracking-wide">Rejected</span>
          <span className="text-3xl font-extrabold text-red-500">{todayStats.failed}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchPerson}
            onChange={(e) => setSearchPerson(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchLogs(1)
            }}
            placeholder="Person ID or name…"
            className="form-input pl-8 text-sm"
          />
        </div>
        <select
          value={filters.result}
          onChange={(e) => setFilters({ ...filters, result: e.target.value })}
          className="form-input form-select min-w-[145px] text-sm"
        >
          <option value="">All Results</option>
          <option value="success">Authenticated</option>
          <option value="failed">Rejected</option>
          <option value="liveness_failed">Liveness Failed</option>
          <option value="unknown">Unknown</option>
        </select>
        <select
          value={filters.auth_type}
          onChange={(e) => setFilters({ ...filters, auth_type: e.target.value })}
          className="form-input form-select min-w-[130px] text-sm"
        >
          <option value="">All Types</option>
          <option value="single">Single</option>
          <option value="mass">Mass</option>
        </select>
        <input
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          type="date"
          className="form-input text-sm"
          title="From date"
        />
        <input
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          type="date"
          className="form-input text-sm"
          title="To date"
        />
      </div>

      {/* Log Table */}
      <div className="glass-panel overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-card)]/60 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#f5bd19]" size={32} />
          </div>
        )}

        {logs.length === 0 && !isLoading ? (
          <div className="py-20 text-center">
            <Activity size={48} className="mx-auto text-muted opacity-30 mb-4" />
            <p className="font-semibold text-muted">No authentication events found.</p>
            <p className="text-xs text-muted mt-1">Run a face match from Face Lab to see events here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {logs.map((log) => {
              const style = resultStyle(log.result)
              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-[rgba(148,163,184,0.04)] transition-colors group"
                >
                  {/* Result Pill */}
                  <div className="flex items-center gap-2 w-44 shrink-0">
                    {style.isSuccess ? (
                      <ShieldCheck size={20} className="text-emerald-500" />
                    ) : (
                      <ShieldX size={20} className="text-red-500" />
                    )}
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border tracking-wider ${style.pill}`}>
                      {resultLabel(log.result)}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="w-36 shrink-0">
                    <div className="text-sm font-semibold font-mono">{formatDateTime(log.created_at)}</div>
                    <div className="text-xs text-muted">{timeAgo(log.created_at)}</div>
                  </div>

                  {/* Person */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{log.person_name || 'Unknown Person'}</div>
                    <div className="text-xs text-muted font-mono truncate">{log.person_external_id || '—'}</div>
                  </div>

                  {/* Type badge */}
                  <div className="shrink-0">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        log.auth_type === 'mass'
                          ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                      }`}
                    >
                      {log.auth_type === 'mass' ? '👥 Mass' : '👤 Single'}
                    </span>
                  </div>

                  {/* Confidence bar */}
                  {log.similarity_score != null && (
                    <div className="w-28 shrink-0">
                      <div className="text-xs text-muted mb-1">Confidence</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--border-light)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${confColor(log.similarity_score)}`}
                            style={{ width: `${Math.round(log.similarity_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-8 text-right">
                          {Math.round((log.similarity_score ?? 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="shrink-0 text-xs text-muted w-36 truncate" title={log.reason}>
                    {log.reason || '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm">
            <span className="text-muted">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-[#f5bd19] disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => {
                  const prev = page - 1
                  setPage(prev)
                  fetchLogs(prev)
                }}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-[#f5bd19] disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  fetchLogs(next)
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FaceAuthLog
