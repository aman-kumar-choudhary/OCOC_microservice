import React, { useState, useEffect, useCallback, useMemo } from "react";
import { auditService } from "@/services/miscService";
import Pagination from "@/components/common/Pagination";
import EmptyState from "@/components/common/EmptyState";
import {
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  CaretDown,
  CaretUp,
  Clock,
  Code,
  FileText,
  Funnel,
  Globe,
  MagnifyingGlass,
  ShieldCheck,
  SpinnerGap,
  User,
  UserCircleGear,
  X
} from "@phosphor-icons/react";

// Human-readable action mapping
const OPERATION_CONFIG = {
  CREATE_USER: { label: "Created New User", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  UPDATE_USER: { label: "Updated User Profile", color: "bg-blue-50 text-blue-800 border-blue-300" },
  SUSPEND_USER: { label: "Suspended User Account", color: "bg-amber-50 text-amber-800 border-amber-300" },
  ACTIVATE_USER: { label: "Activated User Account", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  DEACTIVATE_USER: { label: "Deactivated User Account", color: "bg-rose-50 text-rose-800 border-rose-300" },
  IMPORT_USERS: { label: "Bulk Imported Users", color: "bg-indigo-50 text-indigo-800 border-indigo-300" },
  ASSIGN_RFID: { label: "Assigned RFID Credential", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  REPLACE_RFID: { label: "Replaced RFID Credential", color: "bg-amber-50 text-amber-800 border-amber-300" },
  REVOKE_RFID: { label: "Revoked RFID Credential", color: "bg-rose-50 text-rose-800 border-rose-300" },
  FACE_AUTH_SUCCESS: { label: "Face Biometric Authenticated", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  FACE_AUTH_FAILED: { label: "Face Biometric Mismatch", color: "bg-rose-50 text-rose-800 border-rose-300" },
  FACE_AUTH_LIVENESS: { label: "Liveness Verification Failed", color: "bg-orange-50 text-orange-800 border-orange-300" },
  CREATE_LEAVE: { label: "Submitted Leave Application", color: "bg-blue-50 text-blue-800 border-blue-300" },
  APPROVE_LEAVE: { label: "Approved Leave Request", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  REJECT_LEAVE: { label: "Denied Leave Request", color: "bg-rose-50 text-rose-800 border-rose-300" },
  ASSIGN_ROLE: { label: "Assigned Institutional Role", color: "bg-purple-50 text-purple-800 border-purple-300" },
  REVOKE_ROLE: { label: "Revoked Institutional Role", color: "bg-rose-50 text-rose-800 border-rose-300" },
};

const FIELD_LABELS = {
  phone: "Phone Number",
  academic_batch: "Academic Batch",
  hostel_id: "Hostel",
  hostel_name: "Hostel Name",
  room_number: "Room Number",
  full_name: "Full Name",
  email: "Email Address",
  status: "Status",
  user_type: "Role/Type",
  department_id: "Department",
  emergency_contact: "Emergency Contact",
  guardian_contact: "Guardian Contact",
  photo_reference: "Passport Photo",
  card_uid: "RFID Card UID",
  card_type: "Card Type",
  is_active: "Active Status",
  course: "Course / Program",
  semester: "Semester",
  destination: "Leave Destination",
  leave_type: "Leave Category",
  reason: "Reason",
};

function formatFieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v) {
  if (v === null || v === undefined || v === "") return "None";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (s.startsWith("data:image")) return "[Photo Data Updated]";
  if (s.length > 40) return s.slice(0, 37) + "...";
  return s;
}

// Compute changed fields between before and after states
function getChangedFields(before, after) {
  if (!before && !after) return [];
  if (!before && after && typeof after === "object") {
    return Object.keys(after)
      .filter((k) => !["updated_at", "created_at", "salt", "hashed_password"].includes(k))
      .map((k) => ({
        key: k,
        label: formatFieldLabel(k),
        before: null,
        after: after[k],
      }));
  }
  if (before && !after) {
    return [{ key: "deleted", label: "Record Removed", before: "Active", after: "Deleted" }];
  }
  if (typeof before === "object" && typeof after === "object") {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const changes = [];
    const ignoreKeys = new Set(["updated_at", "created_at", "salt", "hashed_password"]);
    for (const k of keys) {
      if (ignoreKeys.has(k)) continue;
      const bVal = before?.[k];
      const aVal = after?.[k];
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        changes.push({
          key: k,
          label: formatFieldLabel(k),
          before: bVal,
          after: aVal,
        });
      }
    }
    return changes;
  }
  return [];
}

// Standard human date formatting: e.g. "2 Oct 2026, 10:42 AM"
function formatAuditTimestamp(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dateFormatted = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFormatted = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateFormatted}, ${timeFormatted}`;
}

const fmtJson = (v) => {
  if (!v) return "—";
  try {
    return JSON.stringify(typeof v === "string" ? JSON.parse(v) : v, null, 2);
  } catch {
    return String(v);
  }
};

export const AuditView = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [diffLog, setDiffLog] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    operation: "",
    entity_type: "",
    search: "",
    start_date: "",
    end_date: "",
  });

  const fetchLogs = useCallback(
    async (targetPage = page, targetLimit = limit) => {
      setIsLoading(true);
      try {
        const params = {
          page: targetPage,
          limit: targetLimit,
        };
        if (filters.operation) params.operation = filters.operation;
        if (filters.entity_type) params.entity_type = filters.entity_type;
        if (filters.search.trim()) params.search = filters.search.trim();
        if (filters.start_date) params.start_date = new Date(filters.start_date).toISOString();
        if (filters.end_date) {
          const endDate = new Date(filters.end_date);
          endDate.setHours(23, 59, 59, 999);
          params.end_date = endDate.toISOString();
        }

        const data = await auditService.list(params);
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } catch (e) {
        console.error("Failed to load audit logs:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit, filters],
  );

  useEffect(() => {
    fetchLogs(1, limit);
    setPage(1);
  }, [filters.operation, filters.entity_type, filters.search, filters.start_date, filters.end_date]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1, limit);
  };

  const handleResetFilters = () => {
    setFilters({
      operation: "",
      entity_type: "",
      search: "",
      start_date: "",
      end_date: "",
    });
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    filters.operation || filters.entity_type || filters.search || filters.start_date || filters.end_date
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0a2342]/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#0a2342]">
            <ShieldCheck size={14} weight="fill" /> Compliance &amp; Governance
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Institutional Audit Log
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Immutable chronicle of all user identity updates, permissions, biometric checks, and gate events.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(page, limit)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs self-start sm:self-auto transition"
        >
          <ArrowsClockwise size={14} className={isLoading ? "animate-spin" : ""} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1 w-full">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by actor name, entity ID, or keyword..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
            />
          </div>

          {/* Operation Selector */}
          <select
            value={filters.operation}
            onChange={(e) => setFilters({ ...filters, operation: e.target.value })}
            className="w-full md:w-52 py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 focus:outline-hidden focus:border-[#0a2342]"
          >
            <option value="">All Action Types</option>
            <optgroup label="User &amp; Profile">
              <option value="CREATE_USER">Create User</option>
              <option value="UPDATE_USER">Update Profile</option>
              <option value="SUSPEND_USER">Suspend User</option>
              <option value="ACTIVATE_USER">Activate User</option>
              <option value="DEACTIVATE_USER">Deactivate User</option>
              <option value="IMPORT_USERS">Bulk Import</option>
            </optgroup>
            <optgroup label="RFID Credentials">
              <option value="ASSIGN_RFID">Assign RFID</option>
              <option value="REPLACE_RFID">Replace RFID</option>
              <option value="REVOKE_RFID">Revoke RFID</option>
            </optgroup>
            <optgroup label="Face Biometrics">
              <option value="FACE_AUTH_SUCCESS">Face Auth Success</option>
              <option value="FACE_AUTH_FAILED">Face Auth Failed</option>
              <option value="FACE_AUTH_LIVENESS">Liveness Failed</option>
            </optgroup>
            <optgroup label="Leave Operations">
              <option value="CREATE_LEAVE">Leave Submitted</option>
              <option value="APPROVE_LEAVE">Leave Approved</option>
              <option value="REJECT_LEAVE">Leave Denied</option>
            </optgroup>
          </select>

          {/* Entity Type Selector */}
          <select
            value={filters.entity_type}
            onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
            className="w-full md:w-44 py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 focus:outline-hidden focus:border-[#0a2342]"
          >
            <option value="">All Entities</option>
            <option value="user">User</option>
            <option value="rfid_card">RFID Card</option>
            <option value="face_auth">Face Auth</option>
            <option value="leave_request">Leave Request</option>
            <option value="bulk_import">Bulk Import</option>
          </select>

          <button
            type="submit"
            className="w-full md:w-auto px-4 py-2 rounded-xl bg-[#0a2342] text-white hover:bg-[#12365f] text-xs font-bold shadow-2xs transition shrink-0"
          >
            Filter
          </button>
        </form>

        {/* Date Range & Reset Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <CalendarBlank size={13} /> Date Range:
            </span>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="py-1 px-2.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342]"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="py-1 px-2.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342]"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              <X size={12} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Entries List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <SpinnerGap size={32} className="animate-spin text-[#0a2342]" />
            <p className="text-xs font-semibold text-slate-600">Retrieving governance ledger entries...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={ShieldCheck}
              title="No Audit Records Found"
              description="No audit trail entries matched the specified criteria. Try clearing or expanding your date or action filters."
              actionLabel={hasActiveFilters ? "Reset Filters" : undefined}
              onAction={hasActiveFilters ? handleResetFilters : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const opCfg = OPERATION_CONFIG[log.operation] || {
                label: log.operation.replace(/_/g, " "),
                color: "bg-slate-100 text-slate-800 border-slate-300",
              };
              const changedFields = getChangedFields(log.before_state, log.after_state);
              const isExpanded = expandedLogId === log.id;

              return (
                <article
                  key={log.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors space-y-3"
                >
                  {/* Top Row: Timestamp, Actor, Action Badge, Target Entity */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 font-mono">
                        <Clock size={14} className="text-amber-600 shrink-0" />
                        <span>{formatAuditTimestamp(log.created_at)}</span>
                      </div>

                      <span className="text-slate-300 hidden sm:inline">•</span>

                      {/* Actor Information */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <UserCircleGear size={15} className="text-slate-500" />
                        <span className="font-extrabold text-slate-900">
                          {log.actor_name || "System Administrator"}
                        </span>
                        {log.actor_email && (
                          <span className="text-[11px] text-slate-400">
                            ({log.actor_email})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Badge & Target Badge */}
                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold border ${opCfg.color}`}
                      >
                        {opCfg.label}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600 border border-slate-200" title={`Entity ID: ${log.entity_id}`}>
                        {log.entity_type?.replace(/_/g, " ")}: {log.entity_id ? log.entity_id.slice(0, 8) + "..." : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Meaningful Human-Readable Changed Fields Section */}
                  {changedFields.length > 0 && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          Changed Fields ({changedFields.length}):
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {changedFields.map((ch) => (
                          <div
                            key={ch.key}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white border border-slate-200 shadow-2xs"
                          >
                            <span className="font-bold text-slate-800">{ch.label}:</span>
                            {ch.before !== null && ch.before !== undefined && (
                              <>
                                <span className="text-slate-400 line-through text-[11px]">
                                  {formatValue(ch.before)}
                                </span>
                                <ArrowRight size={11} className="text-amber-600" />
                              </>
                            )}
                            <span className="font-semibold text-slate-900">
                              {formatValue(ch.after)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Controls Row: IP/UserAgent & Technical Details Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-3">
                      {log.ip_address && (
                        <span className="flex items-center gap-1 font-mono">
                          <Globe size={12} className="text-slate-400" /> IP: {log.ip_address}
                        </span>
                      )}
                      <span className="font-mono text-slate-400">
                        Log ID: {log.id?.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 hover:underline transition"
                      >
                        <Code size={13} />
                        <span>{isExpanded ? "Hide Technical Details" : "Show Technical Details"}</span>
                        {isExpanded ? <CaretUp size={11} /> : <CaretDown size={11} />}
                      </button>

                      {(log.before_state || log.after_state) && (
                        <button
                          type="button"
                          onClick={() => setDiffLog(log)}
                          className="font-bold text-[#0a2342] hover:text-blue-800 hover:underline transition"
                        >
                          View Full Diff
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Technical Details Drawer */}
                  {isExpanded && (
                    <div className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-900 text-slate-200 font-mono text-xs space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px] text-slate-400">
                        <span>Raw Audit Snapshot</span>
                        <span>UUID: {log.id}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <span className="text-rose-400 font-bold block mb-1">State Before:</span>
                          <pre className="p-2.5 rounded-lg bg-black/40 overflow-x-auto max-h-48 text-rose-300">
                            {fmtJson(log.before_state)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-emerald-400 font-bold block mb-1">State After:</span>
                          <pre className="p-2.5 rounded-lg bg-black/40 overflow-x-auto max-h-48 text-emerald-300">
                            {fmtJson(log.after_state)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Accessible Pagination Component */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <Pagination
            currentPage={page}
            totalItems={total}
            pageSize={limit}
            onPageChange={(p) => {
              setPage(p);
              fetchLogs(p, limit);
            }}
            onPageSizeChange={(sz) => {
              setLimit(sz);
              setPage(1);
              fetchLogs(1, sz);
            }}
            pageSizeOptions={[10, 15, 25, 50]}
          />
        </div>
      </div>

      {/* Side-by-Side Detailed Diff Modal */}
      {diffLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDiffLog(null)}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Audit Snapshot Diff — {OPERATION_CONFIG[diffLog.operation]?.label || diffLog.operation}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Entity: {diffLog.entity_type} · ID: {diffLog.entity_id}
                </p>
              </div>
              <button
                onClick={() => setDiffLog(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Side-by-Side Diff */}
            <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Previous State (Before)
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap text-rose-800 leading-relaxed bg-rose-50/70 p-3 rounded-xl border border-rose-200/80 max-h-96 overflow-y-auto">
                  {fmtJson(diffLog.before_state)}
                </pre>
              </div>
              <div className="p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Resulting State (After)
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap text-emerald-800 leading-relaxed bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 max-h-96 overflow-y-auto">
                  {fmtJson(diffLog.after_state)}
                </pre>
              </div>
            </div>

            {/* Metadata Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 flex flex-wrap gap-x-6 gap-y-2 shrink-0">
              <span>
                <strong>Actor:</strong> {diffLog.actor_name || diffLog.actor_id || "System"}
              </span>
              <span>
                <strong>IP:</strong> {diffLog.ip_address || "—"}
              </span>
              <span>
                <strong>Timestamp:</strong> {formatAuditTimestamp(diffLog.created_at)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditView;
