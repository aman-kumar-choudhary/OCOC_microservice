import React, { useEffect, useState, useMemo } from "react";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import LegalModal from "@/components/LegalModal";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import DigitalGatePassModal from "@/components/DigitalGatePassModal";
import { getHumanGreeting } from "@/utils/greetings";
import {
  ArrowCounterClockwise,
  ArrowRight,
  CalendarCheck,
  CalendarDots,
  CheckCircle,
  Clock,
  FileText,
  MagnifyingGlass,
  MapPin,
  QrCode,
  ShieldCheck,
  WarningCircle,
  X,
  XCircle,
  Check,
} from "@phosphor-icons/react";
import Pagination from "@/components/common/Pagination";

const statusColor = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  WITHDRAWN: "bg-slate-100 text-slate-600 border-slate-200",
  EXPIRED: "bg-slate-100 text-slate-700 border-slate-200",
  COMPLETED: "bg-blue-50 text-blue-800 border-blue-200",
};

const emptyForm = {
  leave_type_id: "",
  start_at: "",
  end_at: "",
  destination: "",
  reason: "",
  custom_reason: "",
};

/**
 * Guard Read-Only View — shows only approved leave requests for gate security
 */
function GuardLeaveView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [validFilter, setValidFilter] = useState("all");
  const [selectedPass, setSelectedPass] = useState(null);

  const fetchLeaves = async () => {
    try {
      const res = await api.get("/leave/requests?status=APPROVED");
      setRequests(res.data.data || []);
    } catch (e) {
      setError(
        e.response?.data?.error?.message ||
          "Unable to load approved leave data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    const interval = setInterval(fetchLeaves, 20000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (r.student_name && r.student_name.toLowerCase().includes(q)) ||
        (r.destination && r.destination.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q));

      const now = new Date();
      const start = new Date(r.start_at);
      const end = new Date(r.end_at);
      const isActive = now >= start && now <= end;
      const isExpired = now > end;
      const isUpcoming = now < start;

      let matchFilter = true;
      if (validFilter === "active") matchFilter = isActive;
      if (validFilter === "upcoming") matchFilter = isUpcoming;
      if (validFilter === "expired") matchFilter = isExpired;

      return matchSearch && matchFilter;
    });
  }, [requests, search, validFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 page-enter">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Gate Operations Console
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Approved Leave &amp; Pass Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time validation roster for student gate clearance decisions
          </p>
        </div>
        <button
          onClick={fetchLeaves}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs self-start"
        >
          <ArrowCounterClockwise size={13} /> Refresh Roster
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="relative flex-1 w-full">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name, ID, or destination..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-800"
          />
        </div>
        <select
          value={validFilter}
          onChange={(e) => setValidFilter(e.target.value)}
          className="w-full sm:w-48 py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-hidden"
        >
          <option value="all">All Validity Windows</option>
          <option value="active">Active Now (Gate Exit Permitted)</option>
          <option value="upcoming">Upcoming (Not Active)</option>
          <option value="expired">Expired (Overdue)</option>
        </select>
      </div>

      {/* Roster Table */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
            Approved Students Roster ({filtered.length})
          </h2>
          <span className="text-[10px] font-mono text-slate-400">
            20s Polling
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Student &amp; Pass ID</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Sanctioned Validity Window</th>
                <th className="px-4 py-2.5">Destination</th>
                <th className="px-4 py-2.5">Gate Status</th>
                <th className="px-4 py-2.5 text-right">Pass Credential</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    Loading approved gate roster...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    No approved leave passes found matching current criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const now = new Date();
                  const start = new Date(r.start_at);
                  const end = new Date(r.end_at);
                  const isActive = now >= start && now <= end;
                  const isExpired = now > end;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {r.student_name || "Student"}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          ID: {r.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        {r.leave_type}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                        {new Date(r.start_at).toLocaleString()} → {new Date(r.end_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800">
                        {r.destination}
                      </td>
                      <td className="px-4 py-2.5">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle size={11} /> EXIT PERMITTED
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <Clock size={11} /> OVERDUE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock size={11} /> UPCOMING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedPass(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition"
                        >
                          <QrCode size={13} /> View Pass
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Digital Gate Pass Modal */}
      <DigitalGatePassModal
        isOpen={!!selectedPass}
        onClose={() => setSelectedPass(null)}
        passData={selectedPass}
      />
    </div>
  );
}

export default function LeaveManagement() {
  const { user, roles, fullName } = useAuth();
  const roleSet = new Set((roles || []).map((r) => String(r).toUpperCase()));
  const isApprover = [
    "SUPER_ADMIN",
    "ADMIN",
    "WARDEN",
    "CHANCELLOR",
    "MEDICAL_OFFICER",
  ].some((r) => roleSet.has(r));
  const isAdmin = roleSet.has("SUPER_ADMIN") || roleSet.has("ADMIN");
  const isWarden = roleSet.has("WARDEN");
  const isStudentRole = roleSet.has("STUDENT");
  const isGuard = ["GUARD", "SECURITY_GUARD"].some((r) => roleSet.has(r));

  // If guard only, show GuardLeaveView directly
  if (isGuard && !isApprover && !isAdmin) {
    return <GuardLeaveView />;
  }

  // Mode selector: Students default to "apply", Approvers default to "approvals", Others to "ledger"
  const defaultMode = isStudentRole ? "apply" : (isApprover ? "approvals" : "ledger");
  const [activeViewMode, setActiveViewMode] = useState(defaultMode);

  const [types, setTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [pending, setPending] = useState([]);
  const [balances, setBalances] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [workflowType, setWorkflowType] = useState("");
  const [workflowText, setWorkflowText] = useState("");
  const [requestFilterTab, setRequestFilterTab] = useState("all");

  // Advanced criteria filters for ledger
  const [filterSearch, setFilterSearch] = useState("");
  const [filterLeaveType, setFilterLeaveType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);

  // Modals state
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    id: null,
    action: "",
    title: "",
    description: "",
    requireReason: false,
    reasonPlaceholder: "",
    isDanger: false,
  });

  const refresh = async () => {
    try {
      const [tRes, rRes, bRes, pRes] = await Promise.allSettled([
        api.get("/leave/types"),
        api.get("/leave/requests"),
        api.get("/leave/balances/me"),
        isApprover
          ? api.get("/leave/approvals/pending")
          : Promise.resolve({ data: { data: [] } }),
      ]);
      if (tRes.status === "fulfilled") setTypes(tRes.value?.data?.data || []);
      if (rRes.status === "fulfilled") setRequests(rRes.value?.data?.data || []);
      if (bRes.status === "fulfilled") setBalances(bRes.value?.data?.data || []);
      if (pRes.status === "fulfilled") setPending(pRes.value?.data?.data || []);

      const rejections = [tRes, rRes, bRes, pRes].filter((res) => res.status === "rejected");
      if (rejections.length === 4) {
        setError(rejections[0].reason?.response?.data?.error?.message || "Unable to load leave data");
      }
    } catch (e) {
      setError(e.response?.data?.error?.message || "Unable to load leave data");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    if (!termsAccepted) {
      setError(
        "Please acknowledge the institutional leave and curfew rules before submitting.",
      );
      setBusy(false);
      return;
    }

    try {
      const payload = {
        ...form,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
      };
      await api.post("/leave/requests?draft=false", payload);
      setForm(emptyForm);
      setTermsAccepted(false);
      setNotice(
        "Leave request submitted successfully. It has been routed to your Warden.",
      );
      await refresh();
    } catch (e) {
      setError(
        e.response?.data?.error?.message ||
          e.response?.data?.detail ||
          "Could not submit leave request",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    setError("");
    setNotice("");
    if (
      !form.leave_type_id ||
      !form.start_at ||
      !form.end_at ||
      !form.destination.trim() ||
      !form.reason.trim()
    ) {
      setError("Please complete the required fields before saving a draft.");
      return;
    }
    try {
      const payload = {
        ...form,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
      };
      await api.post("/leave/requests?draft=true", payload);
      setForm(emptyForm);
      setNotice("Leave draft saved.");
      await refresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || "Could not save draft");
    }
  };

  // Handle decisions with ConfirmActionModal
  const openDecisionModal = (id, action, studentName) => {
    if (action === "approve") {
      setConfirmModal({
        isOpen: true,
        id,
        action: "approve",
        title: `Approve Leave for ${studentName || "Student"}`,
        description:
          "Approving this request will immediately generate an active Digital Gate Pass and provision turnstile exit clearance during the sanctioned window.",
        requireReason: false,
        reasonPlaceholder: "",
        isDanger: false,
      });
    } else if (action === "pending") {
      setConfirmModal({
        isOpen: true,
        id,
        action: "pending",
        title: `Hold Request for ${studentName || "Student"}`,
        description:
          "Mark this application as pending further verification (guardian confirmation or department review). The student will see your notes.",
        requireReason: true,
        reasonPlaceholder: "Notes or requirements for holding...",
        isDanger: false,
      });
    } else {
      setConfirmModal({
        isOpen: true,
        id,
        action: "reject",
        title: `Deny Leave for ${studentName || "Student"}`,
        description:
          "Specify the official reason for denying this leave request. The student will be notified with this reason.",
        requireReason: true,
        reasonPlaceholder: "Official institutional reason for denial...",
        isDanger: true,
      });
    }
  };

  const handleExecuteDecision = async (comment) => {
    const { id, action } = confirmModal;
    setBusy(true);
    setError("");
    try {
      await api.post(`/leave/requests/${id}/${action}`, {
        comment: comment || "",
      });
      const actionText =
        action === "approve"
          ? "approved and Digital Gate Pass issued"
          : action === "pending"
            ? "marked on hold"
            : "denied";
      setNotice(`Request has been ${actionText}.`);
      setConfirmModal({ ...confirmModal, isOpen: false });
      await refresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || `Approval action failed`);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id) => {
    if (!window.confirm("Are you sure you want to withdraw this leave request?"))
      return;
    try {
      await api.post(`/leave/requests/${id}/withdraw`, { comment: "" });
      setNotice("Request withdrawn.");
      await refresh();
    } catch (e) {
      setError(
        e.response?.data?.error?.message || "Could not withdraw request",
      );
    }
  };

  const saveWorkflow = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api.put(`/leave/types/${workflowType}/workflow`, {
        workflow: workflowText
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      });
      setNotice("Approval workflow stages updated.");
      await refresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || "Could not save workflow");
    }
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (requestFilterTab === "approved" && r.status !== "APPROVED") return false;
      if (requestFilterTab === "pending" && r.status !== "PENDING_APPROVAL") return false;
      if (requestFilterTab === "draft" && r.status !== "DRAFT") return false;
      if (requestFilterTab === "completed" && !["COMPLETED", "EXPIRED", "REJECTED"].includes(r.status)) return false;

      if (filterLeaveType) {
        const matchesType = (r.leave_type && r.leave_type.toLowerCase() === filterLeaveType.toLowerCase()) ||
                            (r.leave_type_id && r.leave_type_id === filterLeaveType);
        if (!matchesType) return false;
      }

      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim();
        const matchName = (r.student_name || "").toLowerCase().includes(q);
        const matchRoll = (r.roll_number || "").toLowerCase().includes(q);
        const matchDest = (r.destination || "").toLowerCase().includes(q);
        const matchHostel = (r.hostel_name || "").toLowerCase().includes(q);
        const matchId = (r.id || "").toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchDest && !matchHostel && !matchId) return false;
      }

      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        const reqStart = new Date(r.start_at);
        if (reqStart < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        const reqEnd = new Date(r.end_at);
        if (reqEnd > toDate) return false;
      }

      return true;
    });
  }, [requests, requestFilterTab, filterLeaveType, filterSearch, filterDateFrom, filterDateTo]);

  useEffect(() => {
    setLedgerPage(1);
  }, [requestFilterTab, filterLeaveType, filterSearch, filterDateFrom, filterDateTo]);

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filteredRequests.length / ledgerPageSize));
    setLedgerPage((currentPage) => Math.min(Math.max(1, currentPage), lastPage));
  }, [filteredRequests.length, ledgerPageSize]);

  const paginatedRequests = useMemo(() => {
    const startIdx = (ledgerPage - 1) * ledgerPageSize;
    return filteredRequests.slice(startIdx, startIdx + ledgerPageSize);
  }, [filteredRequests, ledgerPage, ledgerPageSize]);

  const activePass = useMemo(() => {
    const now = new Date();
    return requests.find((r) => {
      if (r.status !== "APPROVED") return false;
      const start = new Date(r.start_at);
      const end = new Date(r.end_at);
      return now >= start && now <= end;
    });
  }, [requests]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 page-enter">
      {/* Enterprise Desk Header */}
      <div className="rounded-xl bg-[#0b1528] text-white p-4 shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/80 text-amber-400 flex items-center justify-center font-bold text-lg shrink-0">
            <ShieldCheck size={22} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase font-semibold text-slate-400">
                CAMPUS MOVEMENT REGISTRY
              </span>
              <span className="text-[11px] text-slate-300">· Curfew: 21:00 hrs</span>
            </div>
            <h1 className="text-base sm:text-lg font-semibold text-slate-100 tracking-tight">
              Hostel Leave &amp; Movement Authorizations
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLegalModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition flex items-center gap-1.5"
          >
            <ShieldCheck size={14} className="text-amber-400" />
            <span>Gate Policies</span>
          </button>
        </div>
      </div>

      {/* Role-Based Mode Navigation Bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 overflow-x-auto text-xs">
        {isApprover && (
          <button
            type="button"
            onClick={() => setActiveViewMode("approvals")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeViewMode === "approvals"
                ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle size={15} />
            <span>Approvals Queue</span>
            {pending.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500 text-slate-950">
                {pending.length}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveViewMode("ledger")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            activeViewMode === "ledger"
              ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText size={15} />
          <span>
            {isStudentRole
              ? `My Requests (${requests.length})`
              : `Leave Ledger (${requests.length})`}
          </span>
        </button>

        {isStudentRole && (
          <button
            type="button"
            onClick={() => setActiveViewMode("apply")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeViewMode === "apply"
                ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarCheck size={15} />
            <span>Apply for Leave</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2"
        >
          <WarningCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Active Pass Card (If student has a current pass) */}
      {activePass && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0">
              <CheckCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-200 text-emerald-900">
                  ACTIVE GATE PASS
                </span>
                <h3 className="font-semibold text-sm text-emerald-950">
                  {activePass.leave_type} — Turnstile Exit Permitted
                </h3>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Valid until {new Date(activePass.end_at).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPass(activePass)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs shadow-xs flex items-center justify-center gap-1.5 transition"
          >
            <QrCode size={15} /> View Gate Pass
          </button>
        </div>
      )}

      {/* ── Student Application Mode ── */}
      {isStudentRole && activeViewMode === "apply" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
          {/* Leave Application Form */}
          <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Submit Campus Leave Application
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Details will be routed directly to your hostel warden for clearance
              </p>
            </div>

            <form onSubmit={submit} className="grid gap-3.5 sm:grid-cols-2 text-xs">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Leave Category *
                </label>
                <select
                  required
                  value={form.leave_type_id}
                  onChange={(e) =>
                    setForm({ ...form, leave_type_id: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 bg-white text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
                >
                  <option value="">Select leave category...</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Departure Date &amp; Time *
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Return Date &amp; Curfew Time *
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Destination Address *
                </label>
                <div className="relative">
                  <MapPin
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    required
                    maxLength={300}
                    value={form.destination}
                    onChange={(e) =>
                      setForm({ ...form, destination: e.target.value })
                    }
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-hidden focus:border-slate-800"
                    placeholder="e.g. Home (Dehradun) / Shantikunj Ashram"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Purpose of Travel *
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
                  placeholder="Explain purpose of visit..."
                />
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-100 flex items-start gap-2">
                <input
                  type="checkbox"
                  id="termsCheckbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <label htmlFor="termsCheckbox" className="text-[11px] text-slate-600 cursor-pointer leading-tight">
                  I certify the destination provided is accurate and agree to adhere to campus curfew regulations upon return.
                </label>
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <span>{busy ? "Submitting..." : "Submit Application"}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </form>
          </section>

          {/* Leave Balances Card */}
          <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarCheck size={16} /> My Leave Quota
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">Current Semester</span>
              </div>

              {balances.length ? (
                <div className="space-y-2.5">
                  {balances.map((b) => {
                    const remaining = Math.max(
                      0,
                      Number(b.allowed_days) - Number(b.consumed_days),
                    );
                    const percent = Math.min(
                      100,
                      Math.round(
                        (remaining / (Number(b.allowed_days) || 1)) * 100,
                      ),
                    );

                    return (
                      <div
                        key={b.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-1.5"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-800">
                            {b.leave_type}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {remaining} days left
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>{b.academic_period}</span>
                          <span>Total: {b.allowed_days} days</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CalendarDots size={28} className="mx-auto text-slate-300 mb-2" />
                  <p>Standard quota rules apply.</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Clock size={13} className="shrink-0" />
              <span>Campus curfew: 21:00 hrs daily</span>
            </div>
          </section>
        </div>
      )}

      {/* ── Warden / Authority Approvals Queue ── */}
      {isApprover && activeViewMode === "approvals" && (
        <section className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Pending Leave Clearance Applications
              </h2>
              <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                {pending.length} Waiting
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Hostel Authority Review</span>
          </div>

          <div className="divide-y divide-slate-100">
            {pending.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <CheckCircle size={28} className="mx-auto text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-700">No pending leave requests</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  All student applications in your jurisdiction have been reviewed.
                </p>
              </div>
            ) : (
              pending.map((r) => (
                <article
                  key={r.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                >
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">
                        {r.student_name || "Student"}
                      </span>
                      {r.roll_number && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {r.roll_number}
                        </span>
                      )}
                      {r.hostel_name && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {r.hostel_name} {r.room_number ? `· Rm ${r.room_number}` : ""}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-100">
                        {r.leave_type}
                      </span>
                    </div>
                    <div className="text-slate-600 flex flex-wrap gap-x-2.5 text-xs">
                      <span>Destination: <strong>{r.destination}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>
                        Window: {new Date(r.start_at).toLocaleString()} → {new Date(r.end_at).toLocaleString()}
                      </span>
                      {r.student_phone && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>Ph: {r.student_phone}</span>
                        </>
                      )}
                    </div>
                    <div className="text-slate-600 text-xs bg-slate-50 p-2 rounded border border-slate-200/80 italic">
                      "{r.reason}"
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openDecisionModal(r.id, "approve", r.student_name)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs transition flex items-center gap-1 shadow-2xs"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => openDecisionModal(r.id, "pending", r.student_name)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs border border-slate-200 transition flex items-center gap-1"
                    >
                      <Clock size={14} /> Hold
                    </button>
                    <button
                      type="button"
                      onClick={() => openDecisionModal(r.id, "reject", r.student_name)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium text-xs transition flex items-center gap-1"
                    >
                      <XCircle size={14} /> Deny
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {/* ── Leave Ledger Table ── */}
      {activeViewMode === "ledger" && (
        <section className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {isApprover || isGuard || isAdmin
                  ? "Student Leave History Ledger"
                  : "My Leave Records"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit and inspect pass validity, statuses, and digital credentials
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              {["all", "approved", "pending", "draft", "completed"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRequestFilterTab(tab)}
                  className={`px-2.5 py-1 rounded-md font-medium capitalize transition shrink-0 ${
                    requestFilterTab === tab
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/80 text-xs">
            <div className="relative flex-1 min-w-[180px]">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search student, roll, hostel, destination..."
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-hidden focus:border-slate-800"
              />
            </div>

            <div className="w-full sm:w-40">
              <select
                value={filterLeaveType}
                onChange={(e) => setFilterLeaveType(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="">All Categories</option>
                {types.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="py-1 px-2 text-xs rounded border border-slate-300 bg-white focus:outline-hidden"
              />
              <span>→</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="py-1 px-2 text-xs rounded border border-slate-300 bg-white focus:outline-hidden"
              />
            </div>

            {(filterSearch || filterLeaveType || filterDateFrom || filterDateTo || requestFilterTab !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setFilterSearch("");
                  setFilterLeaveType("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                  setRequestFilterTab("all");
                }}
                className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
              >
                Reset
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  {(isApprover || isGuard || isAdmin) && <th className="px-3.5 py-2">Student &amp; Hostel</th>}
                  <th className="px-3.5 py-2">Category</th>
                  <th className="px-3.5 py-2">Departure &amp; Return</th>
                  <th className="px-3.5 py-2">Destination</th>
                  <th className="px-3.5 py-2">Status</th>
                  <th className="px-3.5 py-2 text-right">Action / Pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={(isApprover || isGuard || isAdmin) ? 6 : 5} className="p-8 text-center text-slate-400">
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      {(isApprover || isGuard || isAdmin) && (
                        <td className="px-3.5 py-2">
                          <div className="font-semibold text-slate-900">
                            {r.student_name || "Student"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {r.roll_number ? `${r.roll_number}` : ""} {r.hostel_name ? `· ${r.hostel_name}` : ""}
                          </div>
                        </td>
                      )}
                      <td className="px-3.5 py-2 font-medium text-slate-800">
                        {r.leave_type}
                      </td>
                      <td className="px-3.5 py-2 text-slate-700">
                        <div className="font-mono text-[11px]">
                          {new Date(r.start_at).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          to {new Date(r.end_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3.5 py-2 text-slate-800">
                        {r.destination}
                      </td>
                      <td className="px-3.5 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border ${statusColor[r.status] || ""}`}
                        >
                          {r.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right space-x-1.5">
                        {r.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => setSelectedPass(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition"
                          >
                            <QrCode size={13} /> View Pass
                          </button>
                        )}
                        {isApprover && r.status === "PENDING_APPROVAL" && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openDecisionModal(r.id, "approve", r.student_name)}
                              className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-[11px] transition"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openDecisionModal(r.id, "pending", r.student_name)}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-[11px] border border-slate-200 transition"
                            >
                              Hold
                            </button>
                            <button
                              type="button"
                              onClick={() => openDecisionModal(r.id, "reject", r.student_name)}
                              className="px-2 py-0.5 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium text-[11px] transition"
                            >
                              Deny
                            </button>
                          </div>
                        )}
                        {!isApprover && ["DRAFT", "PENDING_APPROVAL"].includes(r.status) && (
                          <button
                            type="button"
                            onClick={() => withdraw(r.id)}
                            className="px-2 py-0.5 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition"
                          >
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={ledgerPage}
            totalItems={filteredRequests.length}
            pageSize={ledgerPageSize}
            onPageChange={(p) => setLedgerPage(p)}
            onPageSizeChange={(sz) => {
              setLedgerPageSize(sz);
              setLedgerPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </section>
      )}

      {/* Decision Confirmation Modal */}
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={handleExecuteDecision}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={
          confirmModal.action === "approve"
            ? "Approve Pass"
            : confirmModal.action === "pending"
              ? "Hold"
              : "Deny"
        }
        requireReason={confirmModal.requireReason}
        reasonPlaceholder={confirmModal.reasonPlaceholder}
        isDanger={confirmModal.isDanger}
        isLoading={busy}
      />

      {/* Digital Gate Pass Modal */}
      <DigitalGatePassModal
        isOpen={!!selectedPass}
        onClose={() => setSelectedPass(null)}
        passData={selectedPass}
      />

      {/* Legal & Governance Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab="terms"
      />
    </div>
  );
}
