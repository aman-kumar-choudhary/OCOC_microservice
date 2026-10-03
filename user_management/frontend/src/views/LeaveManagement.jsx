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
  ArrowSquareOut,
  CalendarCheck,
  CalendarDots,
  CaretRight,
  CheckCircle,
  Clock,
  FileText,
  Funnel,
  MagnifyingGlass,
  MapPin,
  QrCode,
  ShieldCheck,
  Stack,
  User,
  Warning,
  WarningCircle,
  XCircle
} from "@phosphor-icons/react";
const statusColor = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-300",
  WITHDRAWN: "bg-slate-100 text-slate-600 border-slate-300",
  EXPIRED: "bg-orange-100 text-orange-800 border-orange-300",
  COMPLETED: "bg-blue-100 text-blue-800 border-blue-300",
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
 * 5-Stage Campus Movement Process Flow Pipeline Component
 */
const ProcessFlowPipeline = () => {
  const steps = [
    { num: 1, title: "Application", desc: "Submit destination & dates" },
    { num: 2, title: "Warden Review", desc: "Authority approval" },
    { num: 3, title: "Gate Pass Active", desc: "Temporary gate access" },
    { num: 4, title: "Campus Exit", desc: "RFID/Face turnstile tap" },
    { num: 5, title: "Hostel Return", desc: "Curfew check-in verification" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a2342] flex items-center gap-1.5">
          <Stack size={14} className="text-amber-600" /> Standard Campus
          Movement Lifecycle
        </span>
        <span className="text-[10px] text-slate-400">
          Policy: OCOC-LEAVE-PROC-2026
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {steps.map((st, idx) => (
          <div
            key={st.num}
            className="relative flex flex-col items-center text-center p-2 rounded-xl bg-white border border-slate-100 shadow-2xs"
          >
            <div className="w-7 h-7 rounded-full bg-[#0a2342] text-[#f5bd19] flex items-center justify-center font-black text-xs mb-1.5 shadow-xs">
              {st.num}
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {st.title}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
              {st.desc}
            </span>
            {idx < 4 && (
              <CaretRight
                size={14}
                className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none z-10"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
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
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8 page-enter">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
            OCOC • Gate Operations Console
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">
            Approved Leave &amp; Pass Register
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Real-time validation roster for student gate clearance decisions.
            Data is read-only.
          </p>
        </div>
        <button
          onClick={fetchLeaves}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs self-start"
        >
          <ArrowCounterClockwise size={14} /> Refresh Roster
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {/* Funnel and MagnifyingGlass Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <MagnifyingGlass
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="MagnifyingGlass by student name, ID, or destination..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
          />
        </div>
        <select
          value={validFilter}
          onChange={(e) => setValidFilter(e.target.value)}
          className="w-full sm:w-48 py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 focus:outline-hidden"
        >
          <option value="all">All Validity Windows</option>
          <option value="active">Active Now (Gate Exit Permitted)</option>
          <option value="upcoming">Upcoming (Not Active)</option>
          <option value="expired">Expired (Overdue)</option>
        </select>
      </div>

      {/* Roster Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <h2 className="font-extrabold text-sm text-slate-900">
            Approved Students Roster ({filtered.length})
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Live 20s Polling
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="p-3">Student &amp; Pass ID</th>
                <th className="p-3">Category</th>
                <th className="p-3">Sanctioned Validity Window</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Gate Status</th>
                <th className="p-3 text-right">Pass Credential</th>
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
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 transition-colors ${isActive ? "bg-emerald-50/20" : ""}`}
                    >
                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-sm">
                          {r.student_name || "Student"}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {r.id.slice(0, 10)}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-700">
                          {r.leave_type}
                        </span>
                      </td>
                      <td className="p-3 leading-tight">
                        <span className="font-medium text-slate-800">
                          {start.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          until {end.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-700">
                          {r.destination}
                        </span>
                      </td>
                      <td className="p-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle size={12} /> ACTIVE NOW (PASS)
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                            <XCircle size={12} /> EXPIRED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                            <Clock size={12} /> UPCOMING
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedPass(r)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#0a2342] text-white hover:bg-[#12365f] text-xs font-bold transition shadow-2xs"
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
  const { user, roles } = useAuth();
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

  // Determine active view mode: Approvers default to approvals review console, students default to apply
  const [activeViewMode, setActiveViewMode] = useState(
    isApprover && !isStudentRole ? "approvals" : "apply",
  );

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

  // Guard-only view: redirect to GuardLeaveView
  if (isGuard && !isStudentRole && !isApprover && !isAdmin) {
    return <GuardLeaveView />;
  }

  const refresh = async () => {
    try {
      const [t, r, b, p] = await Promise.all([
        api.get("/leave/types"),
        api.get("/leave/requests"),
        api.get("/leave/balances/me"),
        isApprover
          ? api.get("/leave/approvals/pending")
          : Promise.resolve({ data: { data: [] } }),
      ]);
      setTypes(t.data.data || []);
      setRequests(r.data.data || []);
      setBalances(b.data.data || []);
      setPending(p.data.data || []);
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
        "You must acknowledge the terms and gate rules before submitting.",
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
        "Leave request successfully submitted! It has been routed to your Warden for review.",
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
      setNotice(
        "Leave draft saved successfully. You can complete and submit it later.",
      );
      await refresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || "Could not save draft");
    }
  };

  // Handle decisions with ConfirmActionModal (Approve, Keep Pending / Hold, Deny)
  const openDecisionModal = (id, action, studentName) => {
    if (action === "approve") {
      setConfirmModal({
        isOpen: true,
        id,
        action: "approve",
        title: `Approve Leave Request for ${studentName || "Student"}`,
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
        title: `Keep / Mark Request on Hold for ${studentName || "Student"}`,
        description:
          "Mark this application as pending further verification (such as guardian contact or academic review). The student will see your notes.",
        requireReason: true,
        reasonPlaceholder: "Reason or notes for keeping pending or holding...",
        isDanger: false,
      });
    } else {
      setConfirmModal({
        isOpen: true,
        id,
        action: "reject",
        title: `Reject Leave Request for ${studentName || "Student"}`,
        description:
          "Please specify the official institutional reason for denying this leave request. The student will be notified with this justification.",
        requireReason: true,
        reasonPlaceholder: "Please specify the official reason for denial...",
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
            ? "marked as pending review"
            : "denied";
      setNotice(
        `Request has been successfully ${actionText}. Audit record recorded.`,
      );
      setConfirmModal({ ...confirmModal, isOpen: false });
      await refresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || `Approval action failed`);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id) => {
    if (
      !window.confirm("Are you sure you want to withdraw this leave request?")
    )
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
      setNotice("Approval workflow stages updated successfully.");
      await refresh();
    } catch (e) {
      setError(e.response?.data?.error?.message || "Could not save workflow");
    }
  };

  // Funnel requests
  const filteredRequests = useMemo(() => {
    if (requestFilterTab === "all") return requests;
    if (requestFilterTab === "approved")
      return requests.filter((r) => r.status === "APPROVED");
    if (requestFilterTab === "pending")
      return requests.filter((r) => r.status === "PENDING_APPROVAL");
    if (requestFilterTab === "draft")
      return requests.filter((r) => r.status === "DRAFT");
    if (requestFilterTab === "completed")
      return requests.filter((r) =>
        ["COMPLETED", "EXPIRED", "REJECTED"].includes(r.status),
      );
    return requests;
  }, [requests, requestFilterTab]);

  // Active pass detection for student
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
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8 animate-fade-in">
      {/* Human Greeting & Sentiment Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#06182e] via-[#0a2342] to-[#12365f] text-white shadow-xl border border-white/10 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#f5bd19] border border-white/10">
              <ShieldCheck size={14} weight="fill" /> Dev Sanskriti Vishwavidyalaya · Gate Clearance Services
            </div>
            <h1 className="text-xl sm:text-3xl font-display font-black tracking-tight text-white">
              {getHumanGreeting(user?.name || user?.preferred_username || (isWarden ? "Hostel Warden" : "Student"), roles?.[0] || "").greeting}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isApprover && !isStudentRole
                ? "Review pending student leave applications, verify travel details, and issue digital gate passes with care."
                : getHumanGreeting(user?.name || user?.preferred_username, roles?.[0] || "").contextMessage}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setLegalModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white shadow-xs transition flex items-center gap-1.5"
            >
              <ShieldCheck size={14} className="text-amber-400" />
              <span>Gate Policies</span>
            </button>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {getHumanGreeting().dateDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* Role-Based Mode Selector (For Wardens, Approvers, Admins) */}
      {isApprover && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveViewMode("approvals")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeViewMode === "approvals"
                  ? "bg-[#0a2342] text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <CheckCircle size={15} className={activeViewMode === "approvals" ? "text-amber-400" : "text-slate-400"} />
              <span>Authority Approvals Console</span>
              {pending.length > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-900 ml-1">
                  {pending.length} Waiting
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode("ledger")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeViewMode === "ledger"
                  ? "bg-[#0a2342] text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <FileText size={15} className={activeViewMode === "ledger" ? "text-amber-400" : "text-slate-400"} />
              <span>Student Leaves Ledger ({requests.length})</span>
            </button>

            {(isStudentRole || !isWarden) && (
              <button
                type="button"
                onClick={() => setActiveViewMode("apply")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeViewMode === "apply"
                    ? "bg-[#0a2342] text-white shadow-xs font-black"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <CalendarCheck size={15} className={activeViewMode === "apply" ? "text-amber-400" : "text-slate-400"} />
                <span>Apply for Leave</span>
              </button>
            )}
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 pr-3">
            <Clock size={13} className="text-amber-600" /> Standard Campus Curfew: 21:00 hrs
          </span>
        </div>
      )}

      {/* Process Flow Pipeline - shown in student apply mode */}
      {(!isApprover || activeViewMode === "apply") && <ProcessFlowPipeline />}

      {/* Notifications and Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2 shadow-2xs animate-fade-in"
        >
          <WarningCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-start gap-2 shadow-2xs animate-fade-in">
          <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Active Pass Banner (If student has a pass currently valid right now) */}
      {activePass && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/90 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-scale-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <CheckCircle size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-200 text-emerald-900">
                  Active Now
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-emerald-950">
                  {activePass.leave_type} — Gate Exit Permitted
                </h3>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Valid until {new Date(activePass.end_at).toLocaleString()} ·
                Turnstiles ready for RFID/Face tap.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPass(activePass)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition"
          >
            <QrCode size={16} /> View Digital Gate Pass
          </button>
        </div>
      )}

      {/* Main Grid: Application Form & Leave Balances (Shown when applying for leave) */}
      {(!isApprover || activeViewMode === "apply") && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          {/* Leave Application Form */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Apply for Campus Leave
              </h2>
              <p className="text-xs text-slate-500">
                Provide truthful travel and destination details for hostel
                authorization.
              </p>
            </div>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              Step 1 of 5
            </span>
          </div>

          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 text-xs">
            {/* Leave Type */}
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700 block">
                Leave Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.leave_type_id}
                onChange={(e) =>
                  setForm({ ...form, leave_type_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 p-2.5 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
              >
                <option value="">Select an approved leave category...</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date & Time */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">
                Start Date &amp; Departure Time{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
              />
            </div>

            {/* End Date & Time */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">
                Expected Return Date &amp; Curfew Time{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
              />
            </div>

            {/* Destination */}
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700 block">
                Destination Address / City{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  required
                  maxLength={300}
                  value={form.destination}
                  onChange={(e) =>
                    setForm({ ...form, destination: e.target.value })
                  }
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 text-slate-800 focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
                  placeholder="e.g. Home (Dehradun) or All India Gayatri Teerth Shantikunj"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700 block">
                Detailed Purpose &amp; Justification{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                maxLength={4000}
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
                placeholder="Explain the academic, medical, or familial necessity for this departure..."
              />
            </div>

            {/* Terms & Conditions Acknowledgment Checkbox */}
            <div className="sm:col-span-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0a2342] focus:ring-[#f5bd19]"
                />
                <span className="text-[11px] text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                  I solemnly declare that all destination and contact details
                  provided are accurate. I understand that forged applications
                  or failure to return before the designated curfew will incur
                  immediate disciplinary action and notification to guardians. I
                  abide by the{" "}
                  <button
                    type="button"
                    onClick={() => setLegalModalOpen(true)}
                    className="underline text-blue-600 hover:text-blue-800 font-bold"
                  >
                    Campus Terms &amp; Conditions
                  </button>
                  .
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2.5 sm:col-span-2 pt-2">
              <button
                type="button"
                onClick={saveDraft}
                className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                disabled={busy || !termsAccepted}
                className="px-6 py-2.5 rounded-xl bg-[#0a2342] text-white font-extrabold hover:bg-[#12365f] disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
              >
                <span>{busy ? "Processing..." : "Submit Leave Request"}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        </section>

        {/* Leave Balances Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <CalendarCheck size={18} className="text-amber-600" /> My Leave
                Balances
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                Current Semester
              </span>
            </div>

            {balances.length ? (
              <div className="space-y-3">
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
                      className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-900">
                          {b.leave_type}
                        </span>
                        <span className="font-black text-amber-700">
                          {remaining} days left
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Period: {b.academic_period}</span>
                        <span>Total Quota: {b.allowed_days} days</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CalendarDots
                  size={32}
                  className="mx-auto text-slate-300 mb-2"
                />
                <p>
                  No quota limits or standard balances configured for this user
                  persona.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
            <Clock size={14} className="text-slate-400 shrink-0" />
            <span>
              Curfew resets daily at 21:00 hrs for all hostel occupants.
            </span>
          </div>
        </section>
      </div>
      )}

      {/* Pending Authority Approvals (For Wardens, Chancellors, Medical Officers, Admins) */}
      {isApprover && activeViewMode !== "apply" && (
        <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-amber-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Student Leave Applications Review Console
              </h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800 border border-amber-300">
                {pending.length} Pending Decision
              </span>
            </div>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Hostel Jurisdiction Review Console
            </span>
          </div>

          <div className="space-y-3">
            {pending.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="font-bold text-slate-700">All student leave requests are reviewed!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No pending student leave applications waiting for authority decision in your hostel jurisdiction.
                </p>
              </div>
            ) : (
              pending.map((r) => (
                <article
                  key={r.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 bg-slate-50/60 hover:bg-slate-50 transition"
                >
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-sm">
                        {r.student_name || "Student"}
                      </span>
                      {r.roll_number && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200/80 text-slate-800 border border-slate-300">
                          Roll: {r.roll_number}
                        </span>
                      )}
                      {r.hostel_name && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {r.hostel_name} {r.room_number ? `· Room ${r.room_number}` : ""}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0a2342] text-[#f5bd19]">
                        {r.leave_type}
                      </span>
                    </div>
                    <div className="text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                      <span><strong>Destination:</strong> {r.destination}</span>
                      <span>•</span>
                      <span>
                        <strong>Window:</strong>{" "}
                        {new Date(r.start_at).toLocaleString()} –{" "}
                        {new Date(r.end_at).toLocaleString()}
                      </span>
                      {r.student_phone && (
                        <>
                          <span>•</span>
                          <span><strong>Phone:</strong> {r.student_phone}</span>
                        </>
                      )}
                    </div>
                    <div className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 mt-1 italic">
                      "{r.reason}"
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        openDecisionModal(r.id, "approve", r.student_name)
                      }
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} /> Approve Pass
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openDecisionModal(r.id, "pending", r.student_name)
                      }
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
                    >
                      <Clock size={14} /> Keep Pending / Hold
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openDecisionModal(r.id, "reject", r.student_name)
                      }
                      className="px-3.5 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs transition flex items-center gap-1.5"
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

      {/* Admin Multi-Stage Workflow Config */}
      {isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-900">
              Configurable Approval Workflow Stages
            </h2>
            <p className="text-xs text-slate-500">
              Configure required administrative permissions per leave category.
            </p>
          </div>
          <form
            onSubmit={saveWorkflow}
            className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] text-xs"
          >
            <select
              required
              value={workflowType}
              onChange={(e) => {
                const selected = types.find((t) => t.id === e.target.value);
                setWorkflowType(e.target.value);
                setWorkflowText(
                  Array.isArray(selected?.workflow)
                    ? selected.workflow.join(", ")
                    : typeof selected?.workflow === "string"
                      ? JSON.parse(selected?.workflow).join(", ")
                      : "",
                );
              }}
              className="rounded-xl border border-slate-300 p-2.5 bg-white font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="">Select leave type to configure...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              required
              value={workflowText}
              onChange={(e) => setWorkflowText(e.target.value)}
              className="rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden"
              placeholder="e.g. leave.approve.warden, leave.approve.chancellor"
            />
            <button
              disabled={!workflowType}
              className="rounded-xl bg-[#0a2342] px-5 py-2.5 font-bold text-white hover:bg-[#12365f] disabled:opacity-50 transition shadow-2xs"
            >
              Save Stages
            </button>
          </form>
        </section>
      )}

      {/* Leave Requests Roster with Tabs */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {isApprover
                ? "Hostel Student Leave Requests Ledger"
                : "My Submitted Requests"}
            </h2>
            <p className="text-xs text-slate-500">
              {isApprover
                ? "Review and manage all student leaves under your hostel jurisdiction."
                : "Track real-time status and view generated gate credentials."}
            </p>
          </div>

          {/* Funnel Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
            {["all", "approved", "pending", "draft", "completed"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRequestFilterTab(tab)}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition shrink-0 ${
                  requestFilterTab === tab
                    ? "bg-[#0a2342] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
              <tr>
                {isApprover && <th className="p-3">Student &amp; Hostel</th>}
                <th className="p-3">Category / ID</th>
                <th className="p-3">Departure &amp; Return</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action / Pass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={isApprover ? 6 : 5} className="p-8 text-center text-slate-400">
                    No leave requests found in this view.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {isApprover && (
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900">
                          {r.student_name || "Student"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {r.roll_number ? `Roll: ${r.roll_number}` : ""} {r.hostel_name ? `· ${r.hostel_name}` : ""} {r.room_number ? `(Rm ${r.room_number})` : ""}
                        </div>
                      </td>
                    )}
                    <td className="p-3">
                      <div className="font-extrabold text-slate-900">
                        {r.leave_type}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {r.id.slice(0, 10)}
                      </div>
                    </td>
                    <td className="p-3 text-slate-700 leading-tight">
                      <div className="font-semibold">
                        {new Date(r.start_at).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        to {new Date(r.end_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-3 font-medium text-slate-800">
                      {r.destination}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${statusColor[r.status] || ""}`}
                      >
                        {r.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {r.status === "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => setSelectedPass(r)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold transition shadow-2xs"
                        >
                          <QrCode size={13} /> View Gate Pass
                        </button>
                      )}
                      {isApprover && r.status === "PENDING_APPROVAL" && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDecisionModal(r.id, "approve", r.student_name)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition shadow-2xs"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openDecisionModal(r.id, "pending", r.student_name)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition shadow-2xs"
                          >
                            Hold
                          </button>
                          <button
                            type="button"
                            onClick={() => openDecisionModal(r.id, "reject", r.student_name)}
                            className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-[11px] transition"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                      {!isApprover && ["DRAFT", "PENDING_APPROVAL"].includes(r.status) && (
                        <button
                          type="button"
                          onClick={() => withdraw(r.id)}
                          className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition"
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
      </section>

      {/* Decision Confirmation Modal (Replaces window.prompt) */}
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={handleExecuteDecision}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={
          confirmModal.action === "approve"
            ? "Approve & Issue Gate Pass"
            : "Deny Request"
        }
        requireReason={confirmModal.requireReason}
        reasonPlaceholder="Specify the official administrative reason for rejecting this leave..."
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
