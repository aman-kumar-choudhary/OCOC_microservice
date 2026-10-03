import React, { useState, useEffect, useCallback } from "react";
import { auditService } from "@/services/miscService";
import { formatDateTime } from "@/utils/date";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  SpinnerGap,
  UserCircleGear,
  X
} from "@phosphor-icons/react";

export const AuditView = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [diffLog, setDiffLog] = useState(null);
  const [filters, setFilters] = useState({ operation: "", entity_type: "" });

  const fetchLogs = useCallback(
    async (customPage) => {
      setIsLoading(true);
      try {
        const data = await auditService.list({
          page: customPage || page,
          limit,
          ...filters,
        });
        setLogs(data.logs || []);
        setTotal(data.total);
        setTotalPages(data.total_pages || 1);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit, filters],
  );

  useEffect(() => {
    fetchLogs(1);
  }, [filters.operation, filters.entity_type]);

  const formatOperation = (op) => op.split("_").join(" ");

  const getOperationColor = (op) => {
    if (
      op.includes("CREATE") ||
      op.includes("ISSUE") ||
      op.includes("AUTH_SUCCESS")
    ) {
      return "text-emerald-700 bg-emerald-50 border border-emerald-200";
    }
    if (op.includes("UPDATE")) {
      return "text-blue-700 bg-blue-50 border border-blue-200";
    }
    if (
      op.includes("DELETE") ||
      op.includes("REVOKE") ||
      op.includes("DEACTIVATE") ||
      op.includes("AUTH_FAILED")
    ) {
      return "text-red-700 bg-red-50 border border-red-200";
    }
    if (op.includes("SUSPEND") || op.includes("LIVENESS")) {
      return "text-amber-700 bg-amber-50 border border-amber-200";
    }
    return "text-muted bg-[var(--border-light)] border border-transparent";
  };

  const fmtJson = (v) => {
    if (!v) return "—";
    try {
      return JSON.stringify(
        JSON.parse(typeof v === "string" ? v : JSON.stringify(v)),
        null,
        2,
      );
    } catch {
      return String(v);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted text-sm mt-1">
          Immutable ledger of all administrative and authentication actions.
        </p>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 mb-6 flex flex-col md:flex-row gap-3">
        <select
          value={filters.operation}
          onChange={(e) => {
            setFilters({ ...filters, operation: e.target.value });
            setPage(1);
          }}
          className="form-input form-select flex-1"
          id="op-filter"
        >
          <option value="">All Operations</option>
          <optgroup label="User">
            <option value="CREATE_USER">Create User</option>
            <option value="UPDATE_USER">Update User</option>
            <option value="SUSPEND_USER">Suspend User</option>
            <option value="ACTIVATE_USER">Activate User</option>
            <option value="DEACTIVATE_USER">Deactivate User</option>
            <option value="IMPORT_USERS">Bulk Import</option>
          </optgroup>
          <optgroup label="RFID">
            <option value="ASSIGN_RFID">Assign RFID</option>
            <option value="REPLACE_RFID">Replace RFID</option>
            <option value="REVOKE_RFID">Revoke RFID</option>
          </optgroup>
          <optgroup label="Face Auth">
            <option value="FACE_AUTH_SUCCESS">Face Auth Success</option>
            <option value="FACE_AUTH_FAILED">Face Auth Failed</option>
            <option value="FACE_AUTH_LIVENESS">Liveness Failed</option>
          </optgroup>
        </select>
        <select
          value={filters.entity_type}
          onChange={(e) => {
            setFilters({ ...filters, entity_type: e.target.value });
            setPage(1);
          }}
          className="form-input form-select flex-1"
          id="entity-filter"
        >
          <option value="">All Entities</option>
          <option value="user">User</option>
          <option value="rfid_card">RFID Card</option>
          <option value="bulk_import">Bulk Import</option>
          <option value="face_auth">Face Auth</option>
        </select>
      </div>

      {/* Log List */}
      <div className="glass-panel overflow-hidden relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-card)]/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <SpinnerGap className="animate-spin text-[#f5bd19]" size={32} />
          </div>
        )}

        <div className="divide-y divide-[var(--border-light)]">
          {logs.length === 0 && !isLoading && (
            <div className="p-12 text-center text-muted flex flex-col items-center">
              <ChartLineUp size={48} className="mb-4 opacity-30" />
              <p>No audit events found.</p>
            </div>
          )}

          {logs.map((log) => (
            <div
              key={log.id}
              className="p-4 hover:bg-[rgba(148,163,184,0.05)] transition-colors flex flex-col sm:flex-row gap-4 sm:items-center"
            >
              {/* Time */}
              <div className="w-36 flex-shrink-0 text-sm text-muted">
                <div className="font-bold text-[var(--text-main)] font-mono text-xs leading-tight">
                  {formatDateTime(log.created_at)}
                </div>
              </div>

              {/* Operation */}
              <div className="w-44 flex-shrink-0">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-md tracking-wide ${getOperationColor(log.operation)}`}
                >
                  {formatOperation(log.operation)}
                </span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold capitalize">
                    {log.entity_type?.replace("_", " ")}
                  </span>
                  <ArrowRight className="text-muted" size={14} />
                  <span className="text-sm font-mono text-muted truncate">
                    {log.entity_id}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1" title="Actor ID">
                    <UserCircleGear size={14} />
                    {log.actor_id || "System"}
                  </span>
                  {log.ip_address && (
                    <span className="border-l border-[var(--border-light)] pl-4">
                      IP: {log.ip_address}
                    </span>
                  )}
                </div>
              </div>

              {/* Diff button */}
              <div className="sm:pl-4 sm:border-l border-[var(--border-light)] flex-shrink-0">
                <button
                  onClick={() => setDiffLog(log)}
                  className="text-sm text-[#d99e00] hover:underline font-semibold flex items-center gap-1"
                >
                  View Diff
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm">
          <span className="text-muted">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-[#f5bd19] disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => {
                const prev = page - 1;
                setPage(prev);
                fetchLogs(prev);
              }}
            >
              <CaretLeft size={15} />
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-[#f5bd19] disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                fetchLogs(next);
              }}
            >
              <CaretRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Diff Modal */}
      {diffLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDiffLog(null)}
          />
          <div className="relative z-10 glass-panel w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl bg-[var(--bg-card)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] shrink-0">
              <div>
                <h3 className="font-extrabold text-lg">
                  Audit Diff — {formatOperation(diffLog.operation)}
                </h3>
                <p className="text-xs text-muted font-mono">
                  {diffLog.entity_type} / {diffLog.entity_id}
                </p>
              </div>
              <button
                onClick={() => setDiffLog(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted"
              >
                <X size={20} />
              </button>
            </div>

            {/* Side-by-side diff */}
            <div className="flex-1 overflow-auto grid grid-cols-2 divide-x divide-[var(--border-light)]">
              <div className="p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>{" "}
                  Before
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap text-red-500 leading-relaxed bg-red-50/50 p-3 rounded-lg">
                  {fmtJson(diffLog.before_state)}
                </pre>
              </div>
              <div className="p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>{" "}
                  After
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap text-emerald-600 leading-relaxed bg-emerald-50/50 p-3 rounded-lg">
                  {fmtJson(diffLog.after_state)}
                </pre>
              </div>
            </div>

            {/* Meta row */}
            <div className="px-6 py-3 border-t border-[var(--border-light)] text-xs text-muted flex gap-6 shrink-0">
              <span>
                Actor:{" "}
                <span className="font-mono text-[var(--text-main)]">
                  {diffLog.actor_id || "System"}
                </span>
              </span>
              <span>
                IP:{" "}
                <span className="font-mono">{diffLog.ip_address || "—"}</span>
              </span>
              <span>
                Time:{" "}
                <span className="font-mono">
                  {formatDateTime(diffLog.created_at)}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditView;
