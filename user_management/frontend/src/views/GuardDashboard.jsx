import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  CalendarCheck,
  Camera,
  CheckCircle,
  Clock,
  Door,
  IdentificationBadge,
  MagnifyingGlass,
  Printer,
  ShieldCheck,
  SignIn,
  SignOut,
  SpinnerGap,
  UserFocus,
  UserPlus,
  Users,
  Warning,
  X,
  XCircle,
  ArrowClockwise,
} from "@phosphor-icons/react";
import api from "../services/api";
import accessService from "../services/accessService";
import { useLiveFaceInference } from "../hooks/useLiveFaceInference";
import { useAuth } from "../context/AuthContext";
import {
  formatDateTimeIST,
  formatTimeIST,
  calculateStudentTimeliness,
} from "../utils/date";

export const GuardDashboard = () => {
  const { user, roles, fullName } = useAuth();
  const [activeTab, setActiveTab] = useState("students"); // 'students' | 'visitors' | 'freco' | 'alerts'
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [hostelLeaves, setHostelLeaves] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Student filters
  const [studentSearch, setStudentSearch] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");
  const [movementFilter, setMovementFilter] = useState("all");

  // Visitor Form State
  const [visitorModalOpen, setVisitorModalOpen] = useState(false);
  const [visitorPassType, setVisitorPassType] = useState("TEMPORARY_DAY"); // 'TEMPORARY_DAY' | 'SPECIAL_FUNCTION'
  const [visitorForm, setVisitorForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    visit_purpose: "Campus Visit",
    host_person: "",
    host_contact: "",
    gov_id_type: "Aadhaar Card",
    gov_id_number: "",
    assigned_card_uid: "",
    event_name: "",
    notes: "",
    valid_from: "",
    valid_until: "",
    accompanying_count: 0,
    accompanying_details: "",
    accompanying_persons: [],
  });
  const [issuedPassReceipt, setIssuedPassReceipt] = useState(null);
  const [submittingVisitor, setSubmittingVisitor] = useState(false);

  // Live IST Clock
  const [currentISTTime, setCurrentISTTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentISTTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }) + " IST"
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebRTC / FRECO Live Camera Stream
  const videoRef = useRef(null);
  const {
    isStreaming,
    error: cameraError,
    wsError,
    faces,
    startStream,
    stopStream,
  } = useLiveFaceInference(videoRef, "single_recognition");
  const ws = useRef(null);

  // Fetch initial data
  const fetchLeaves = async () => {
    try {
      setLoadingLeaves(true);
      const data = await accessService.getGuardHostelLeaves();
      setHostelLeaves(data || []);
    } catch (err) {
      console.error("Error loading guard leaves:", err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const fetchVisitors = async () => {
    try {
      setLoadingVisitors(true);
      const vList = await accessService.getGuardVisitors(50);
      setVisitors(vList || []);
    } catch (err) {
      console.error("Error loading visitors:", err);
    } finally {
      setLoadingVisitors(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchVisitors();

    api
      .get("/access/events?limit=25")
      .then((res) => setEvents(res.data.data || []))
      .catch(console.error);

    const interval = setInterval(() => {
      fetchLeaves();
    }, 15000);

    // WebSocket real-time connection
    let isMounted = true;
    let reconnectTimeout = null;

    const connectWs = () => {
      if (!isMounted) return;
      const token = sessionStorage.getItem("access_token");
      ws.current = new WebSocket(
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/v1/ws/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`
      );

      ws.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ACCESS_EVENT") {
            setEvents((prev) => [msg.data, ...prev].slice(0, 50));
            if (msg.data.status === "PENDING" && msg.data.verification_id) {
              setPendingVerifications((prev) => [
                msg.data,
                ...prev.filter(
                  (item) => item.verification_id !== msg.data.verification_id
                ),
              ]);
            }
          } else if (
            msg.type === "HOSTEL_STATUS_UPDATED" ||
            msg.type === "HOSTEL_MOVEMENT"
          ) {
            fetchLeaves();
          } else if (
            msg.type === "SYSTEM_ALERT" ||
            msg.type === "HOSTEL_CURFEW_ALERT" ||
            msg.type === "SECURITY_COMMAND"
          ) {
            setAlerts((prev) => [msg.data, ...prev].slice(0, 20));
          }
        } catch (e) {
          console.error("WS message parse error:", e);
        }
      };

      ws.current.onclose = () => {
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWs, 5000);
        }
      };
    };

    connectWs();
    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
      clearInterval(interval);
    };
  }, []);

  // Quick Gate Action (Exit / Entry) for Student
  const handleRecordMovement = async (student, action) => {
    try {
      setActionMessage({ type: "loading", text: `Recording ${action} for ${student.student_name}...` });
      const res = await accessService.recordGuardMovement({
        student_id: student.student_id,
        action: action,
        gate_name: "Main Campus Gate",
        reason: action === "EXIT" ? "Student Exit at Main Gate" : "Student Return at Main Gate",
      });

      setActionMessage({
        type: "success",
        text: res.message || `${action} recorded for ${student.student_name}`,
      });
      setTimeout(() => setActionMessage(null), 4000);
      fetchLeaves();
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err.response?.data?.detail || err.message || `Failed to record ${action}`,
      });
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  // Accompanying persons handlers
  const handleAccompanyingCountChange = (val) => {
    const num = Math.max(0, Math.min(20, parseInt(val, 10) || 0));
    setVisitorForm((prev) => {
      const currentList = prev.accompanying_persons || [];
      let nextList;
      if (num > currentList.length) {
        nextList = [...currentList, ...Array(num - currentList.length).fill("")];
      } else {
        nextList = currentList.slice(0, num);
      }
      return {
        ...prev,
        accompanying_count: num,
        accompanying_persons: nextList,
        accompanying_details: nextList.filter(Boolean).join(", "),
      };
    });
  };

  const handlePersonNameChange = (index, name) => {
    setVisitorForm((prev) => {
      const updated = [...(prev.accompanying_persons || [])];
      updated[index] = name;
      return {
        ...prev,
        accompanying_persons: updated,
        accompanying_details: updated.filter(Boolean).join(", "),
      };
    });
  };

  const handleRemovePerson = (index) => {
    setVisitorForm((prev) => {
      const updated = (prev.accompanying_persons || []).filter((_, i) => i !== index);
      return {
        ...prev,
        accompanying_count: updated.length,
        accompanying_persons: updated,
        accompanying_details: updated.filter(Boolean).join(", "),
      };
    });
  };

  // Visitor Onboarding Submit
  const handleRegisterVisitor = async (e) => {
    e.preventDefault();
    if (!visitorForm.full_name || !visitorForm.phone) {
      alert("Please provide visitor name and contact number.");
      return;
    }

    const accCount = Number(visitorForm.accompanying_count) || 0;
    if (accCount > 0) {
      const persons = visitorForm.accompanying_persons || [];
      for (let i = 0; i < accCount; i++) {
        if (!persons[i] || !persons[i].trim()) {
          alert(`Please enter Person ${i + 1} name.`);
          return;
        }
      }
    }

    setSubmittingVisitor(true);
    try {
      const details = (visitorForm.accompanying_persons || []).filter(Boolean).join(", ");
      const payload = {
        ...visitorForm,
        accompanying_count: accCount,
        accompanying_details: details,
        pass_type: visitorPassType,
      };
      if (visitorPassType === "TEMPORARY_DAY") {
        delete payload.valid_from;
        delete payload.valid_until;
        delete payload.assigned_card_uid;
      }

      const res = await accessService.registerGuardVisitor(payload);
      setIssuedPassReceipt(res.data);
      setVisitorModalOpen(false);
      setVisitorForm({
        full_name: "",
        phone: "",
        email: "",
        visit_purpose: "Campus Visit",
        host_person: "",
        host_contact: "",
        gov_id_type: "Aadhaar Card",
        gov_id_number: "",
        assigned_card_uid: "",
        event_name: "",
        notes: "",
        valid_from: "",
        valid_until: "",
        accompanying_count: 0,
        accompanying_details: "",
        accompanying_persons: [],
      });
      fetchVisitors();
      setActionMessage({
        type: "success",
        text: `Visitor Pass ${res.data.pass_number} generated successfully!`,
      });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || "Failed to register visitor.");
    } finally {
      setSubmittingVisitor(false);
    }
  };

  // Visitor Checkout
  const handleVisitorCheckout = async (visitor) => {
    try {
      await accessService.checkoutGuardVisitor(visitor.visitor_id);
      fetchVisitors();
      setActionMessage({
        type: "success",
        text: `Visitor ${visitor.full_name} marked as checked out.`,
      });
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      alert("Failed to check out visitor.");
    }
  };

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return hostelLeaves.filter((student) => {
      const q = studentSearch.trim().toLowerCase();
      const searchable = [
        student.student_name,
        student.student_roll,
        student.student_phone,
        student.hostel_name,
        student.permission_type,
        student.destination,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = !q || searchable.includes(q);

      let statusMatch = true;
      if (studentStatusFilter === "OUTSIDE") {
        statusMatch = ["OUTSIDE", "ON_LEAVE", "LATE_RETURN"].includes(student.current_status);
      } else if (studentStatusFilter === "INSIDE") {
        statusMatch = student.current_status === "INSIDE";
      } else if (studentStatusFilter === "LATE") {
        const timeInfo = calculateStudentTimeliness({
          startAt: student.permission_start_time,
          endAt: student.permission_end_time,
          eventTime: student.last_event_time,
          movementType: student.last_movement_type,
          currentStatus: student.current_status,
        });
        statusMatch = timeInfo.isLate;
      } else if (studentStatusFilter !== "all") {
        statusMatch = student.current_status === studentStatusFilter;
      }

      let movementMatch = true;
      if (movementFilter !== "all") {
        const mov = (student.last_movement_type || "").toUpperCase();
        movementMatch = mov === movementFilter || (movementFilter === "EXIT" && mov === "OUT") || (movementFilter === "ENTRY" && mov === "IN");
      }

      return searchMatch && statusMatch && movementMatch;
    });
  }, [hostelLeaves, studentSearch, studentStatusFilter, movementFilter]);

  // Metric counts
  const outsideCount = hostelLeaves.filter((s) =>
    ["OUTSIDE", "ON_LEAVE", "LATE_RETURN"].includes(s.current_status)
  ).length;

  const overdueCount = hostelLeaves.filter((student) => {
    const timeInfo = calculateStudentTimeliness({
      startAt: student.permission_start_time,
      endAt: student.permission_end_time,
      eventTime: student.last_event_time,
      movementType: student.last_movement_type,
      currentStatus: student.current_status,
    });
    return timeInfo.isLate;
  }).length;

  const activeLeaveCount = hostelLeaves.filter((s) => !!s.permission_id).length;
  const activeVisitorsInside = visitors.filter((v) => v.is_inside).length;

  return (
    <div className="space-y-4 page-enter pb-12 max-w-7xl mx-auto">
      {/* ── Security Operations Command Bar ── */}
      <div className="rounded-xl bg-[#0b1528] text-white p-4 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/80 text-amber-400 flex items-center justify-center font-bold text-lg shrink-0">
            <ShieldCheck size={24} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase font-semibold text-slate-400">
                GATE-01 · MAIN ACCESS DESK
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] text-emerald-400 font-medium">Armed &amp; Syncing</span>
            </div>
            <h1 className="text-base sm:text-lg font-semibold text-slate-100 tracking-tight">
              Campus Gate Security Operations
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live IST Clock */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2 text-xs font-mono font-medium text-slate-300">
            <Clock size={15} className="text-amber-400" />
            <span>{currentISTTime || "IST Clock Sync"}</span>
          </div>

          {/* Quick New Visitor Button */}
          <button
            type="button"
            onClick={() => setVisitorModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <UserPlus size={15} weight="bold" />
            <span>Issue Visitor Pass</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {actionMessage && (
        <div
          className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-all ${actionMessage.type === "error"
            ? "bg-rose-50 text-rose-800 border-rose-200"
            : actionMessage.type === "loading"
              ? "bg-slate-50 text-slate-800 border-slate-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-3"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Operational Telemetry Bar (Clean Enterprise Connected Strip) ── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-100 grid grid-cols-2 sm:grid-cols-4">
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Approved Passes
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {activeLeaveCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center">
            <CalendarCheck size={18} />
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Currently Outside
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {outsideCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50/80 border border-amber-100 text-amber-700 flex items-center justify-center">
            <SignOut size={18} />
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Overdue / Delayed
            </span>
            <div className={`text-2xl font-bold mt-1 tabular-nums ${overdueCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {overdueCount}
            </div>
          </div>
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${overdueCount > 0
            ? "bg-rose-50 border-rose-200 text-rose-600"
            : "bg-slate-50 border-slate-100 text-slate-400"
            }`}>
            <Warning size={18} />
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Visitors On Campus
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {activeVisitorsInside}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center">
            <Users size={18} />
          </div>
        </div>
      </div>

      {/* ── Refined Segmented Tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "students"
            ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60"
            : "text-slate-600 hover:text-slate-900"
            }`}
        >
          <Door size={15} />
          <span>Student Gate Passes</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 font-semibold">
            {hostelLeaves.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("visitors")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "visitors"
            ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60"
            : "text-slate-600 hover:text-slate-900"
            }`}
        >
          <IdentificationBadge size={15} />
          <span>Visitor Onboarding &amp; Day Passes</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 font-semibold">
            {visitors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("freco")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "freco"
            ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60"
            : "text-slate-600 hover:text-slate-900"
            }`}
        >
          <Camera size={15} />
          <span>Turnstile Camera &amp; Live Events</span>
          {pendingVerifications.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-600 text-white font-semibold">
              {pendingVerifications.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "alerts"
            ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/60"
            : "text-slate-600 hover:text-slate-900"
            }`}
        >
          <Warning size={15} />
          <span>Security Alarms</span>
          {alerts.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-100 text-rose-700 font-semibold">
              {alerts.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: STUDENT GATE PASSES & MOVEMENTS                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "students" && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter name, roll, hostel..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800"
                />
              </div>

              <select
                value={studentStatusFilter}
                onChange={(e) => setStudentStatusFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 font-medium focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="OUTSIDE">Outside / On Leave</option>
                <option value="INSIDE">Inside Campus</option>
                <option value="LATE">Overdue / Late</option>
              </select>

              <select
                value={movementFilter}
                onChange={(e) => setMovementFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 font-medium focus:outline-hidden"
              >
                <option value="all">All Movements</option>
                <option value="EXIT">Exited (Out)</option>
                <option value="ENTRY">Entered (In)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto text-xs text-slate-500 font-medium">
              <span>{filteredStudents.length} of {hostelLeaves.length} students</span>
              <button
                type="button"
                onClick={fetchLeaves}
                className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                title="Refresh student gate records"
              >
                <ArrowClockwise size={13} className={loadingLeaves ? "animate-spin text-slate-800" : ""} />
              </button>
            </div>
          </div>

          {/* High-Legibility Data Table */}
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Campus Status</th>
                  <th className="px-4 py-2.5">Approved Leave Window</th>
                  <th className="px-4 py-2.5">Timeliness</th>
                  <th className="px-4 py-2.5">Last Gate Event</th>
                  <th className="px-4 py-2.5 text-right">Gate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      No matching student movement records.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const isOutside = ["OUTSIDE", "ON_LEAVE", "LATE_RETURN"].includes(s.current_status);
                    const timeInfo = calculateStudentTimeliness({
                      startAt: s.permission_start_time,
                      endAt: s.permission_end_time,
                      eventTime: s.last_event_time,
                      movementType: s.last_movement_type,
                      currentStatus: s.current_status,
                    });

                    return (
                      <tr key={s.student_id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Student Details */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                              {(s.student_name || "S").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{s.student_name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {s.student_roll || s.student_id?.slice(0, 8)} · {s.hostel_name || "Campus Hostel"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Current Location */}
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${isOutside
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              }`}
                          >
                            {isOutside ? <SignOut size={12} /> : <SignIn size={12} />}
                            {s.current_status?.replace("_", " ") || "INSIDE"}
                          </span>
                        </td>

                        {/* Leave Window */}
                        <td className="px-4 py-2.5">
                          {s.permission_type ? (
                            <div className="space-y-0.5">
                              <span className="font-medium text-slate-700 text-[11px]">
                                {s.permission_type?.replace("_", " ")}
                              </span>
                              <div className="text-[11px] font-mono text-slate-600">
                                {formatDateTimeIST(s.permission_start_time)} → {formatDateTimeIST(s.permission_end_time)}
                              </div>
                              {s.destination && (
                                <div className="text-[10px] text-slate-400 italic truncate max-w-xs">
                                  {s.destination}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No active leave pass</span>
                          )}
                        </td>

                        {/* Timeliness */}
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${timeInfo.colorClass}`}
                          >
                            {timeInfo.isLate && <Warning size={12} />}
                            {timeInfo.badge}
                          </span>
                        </td>

                        {/* Last Gate Event */}
                        <td className="px-4 py-2.5">
                          <div className="text-slate-700 font-medium">
                            {s.last_movement_type === "EXIT"
                              ? "Gate Exit (OUT)"
                              : s.last_movement_type === "ENTRY"
                                ? "Gate Entry (IN)"
                                : "—"}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {s.last_event_time ? formatDateTimeIST(s.last_event_time) : "No log"}
                          </div>
                        </td>

                        {/* Gate Action */}
                        <td className="px-4 py-2.5 text-right">
                          {isOutside ? (
                            <button
                              type="button"
                              onClick={() => handleRecordMovement(s, "ENTRY")}
                              className="px-3 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs transition inline-flex items-center gap-1 shadow-2xs"
                            >
                              <SignIn size={13} />
                              <span>Gate In</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRecordMovement(s, "EXIT")}
                              className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition inline-flex items-center gap-1 shadow-2xs"
                            >
                              <SignOut size={13} />
                              <span>Gate Out</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: VISITOR DESK                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "visitors" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <IdentificationBadge size={18} className="text-slate-700" />
                <span>Visitor Registration &amp; Pass Desk</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Issue daily visitor passes (05:00 AM – 05:00 PM IST) or event passes with official entry receipts.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setVisitorModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition flex items-center gap-1.5 shrink-0"
            >
              <UserPlus size={14} className="text-amber-400" />
              <span>Register Visitor</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
                Campus Visitors ({visitors.length})
              </h3>
              <button
                type="button"
                onClick={fetchVisitors}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <ArrowClockwise size={13} className={loadingVisitors ? "animate-spin text-slate-800" : ""} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Visitor</th>
                    <th className="px-4 py-2.5">Purpose &amp; Host</th>
                    <th className="px-4 py-2.5">Government ID</th>
                    <th className="px-4 py-2.5">Pass UID</th>
                    <th className="px-4 py-2.5">Validity (IST)</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-slate-400">
                        No visitors registered on campus today.
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={v.visitor_id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-900">{v.full_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{v.phone}</p>
                          {Number(v.accompanying_count || 0) > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                                title={v.accompanying_details ? `With: ${v.accompanying_details}` : `+${v.accompanying_count} accompanying`}
                              >
                                <Users size={11} /> +{v.accompanying_count} sath ({v.total_persons || Number(v.accompanying_count) + 1} total)
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-slate-800">{v.visit_purpose}</span>
                          <p className="text-[11px] text-slate-500">Host: {v.host_person}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] text-slate-700">{v.gov_id_type}</span>
                          <p className="text-[10px] text-slate-400 font-mono">{v.gov_id_number || "Verified"}</p>
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {v.card_uid ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                              {v.card_uid}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Day Pass</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] font-mono text-slate-600">
                          {v.valid_until_ist || "5:00 PM IST Today"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${v.is_inside
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                              }`}
                          >
                            {v.is_inside ? "INSIDE CAMPUS" : "CHECKED OUT"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {v.is_inside && (
                            <button
                              type="button"
                              onClick={() => handleVisitorCheckout(v)}
                              className="px-2.5 py-1 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs transition"
                            >
                              Check Out
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: FRECO BIOMETRICS & LIVE STREAM                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "freco" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Camera Feed styled as CCTV viewport */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-amber-400" />
                <h3 className="font-semibold text-xs text-slate-200">Main Gate Camera Stream</h3>
              </div>
              <button
                type="button"
                onClick={isStreaming ? stopStream : startStream}
                className={`text-xs font-semibold px-2.5 py-1 rounded transition ${isStreaming
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  }`}
              >
                {isStreaming ? "Stop Feed" : "Start Camera"}
              </button>
            </div>
            <div className="relative bg-slate-950 aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                  <UserFocus size={32} className="text-slate-600" />
                  <span>Camera Standby · Click Start Camera</span>
                </div>
              )}
            </div>
            <div className="p-2.5 bg-slate-50 text-xs text-slate-600 flex items-center justify-between border-t border-slate-200/80">
              <span className="font-mono text-[11px]">{faces.length} face(s) in frame</span>
              {isStreaming && (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE INFERENCE ACTIVE
                </span>
              )}
            </div>
          </div>

          {/* Turnstile Live Events Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-slate-50/70 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
              <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
                Turnstile Event Log ({events.length})
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">WebSocket Sync</span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3.5 py-2">Time (IST)</th>
                    <th className="px-3.5 py-2">Identity</th>
                    <th className="px-3.5 py-2">Direction</th>
                    <th className="px-3.5 py-2">Gate</th>
                    <th className="px-3.5 py-2">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {events.slice(0, 30).map((ev, idx) => (
                    <tr key={ev.id || idx} className="hover:bg-slate-50/60">
                      <td className="px-3.5 py-2 font-mono text-slate-500 text-[11px]">
                        {formatTimeIST(ev.event_time)}
                      </td>
                      <td className="px-3.5 py-2 font-medium text-slate-900">
                        {ev.user_name || ev.user_identifier}
                      </td>
                      <td className="px-3.5 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${ev.action === "ENTRY"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                        >
                          {ev.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-slate-600">{ev.location_name || "Main Gate"}</td>
                      <td className="px-3.5 py-2 font-semibold">
                        <span
                          className={`inline-flex items-center gap-1 ${ev.status === "GRANTED" ? "text-emerald-700" : "text-rose-700"
                            }`}
                        >
                          {ev.status === "GRANTED" ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: SECURITY ALARMS                                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "alerts" && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Warning size={17} className="text-amber-500" />
              <span>Campus Security Exceptions &amp; Alarms</span>
            </h3>
            <span className="text-xs text-slate-500">{alerts.length} active alerts</span>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <CheckCircle size={28} className="mx-auto text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-700">No active security alerts.</p>
                <p className="text-slate-400 mt-0.5">Turnstiles and gate checkpoints are operating normally.</p>
              </div>
            ) : (
              alerts.map((al, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-rose-900">{al.alert_type || "Security Exception"}</div>
                    <p className="text-rose-700 mt-0.5">{al.message}</p>
                    <span className="text-[10px] text-rose-400 font-mono mt-1 block">
                      {al.created_at ? formatDateTimeIST(al.created_at) : "Just now"}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-semibold uppercase shrink-0">
                    Warning
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* VISITOR ONBOARDING MODAL                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {visitorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Visitor Pass Issuance</h3>
                  <p className="text-[11px] text-slate-400">Campus Entry Authorization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisitorModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pass Type Selector Toggle */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200/80">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setVisitorPassType("TEMPORARY_DAY")}
                  className={`py-1.5 px-3 rounded-md transition ${visitorPassType === "TEMPORARY_DAY"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Day Pass (05:00 AM – 05:00 PM)
                </button>
                <button
                  type="button"
                  onClick={() => setVisitorPassType("SPECIAL_FUNCTION")}
                  className={`py-1.5 px-3 rounded-md transition ${visitorPassType === "SPECIAL_FUNCTION"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Special Event / ID Card
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterVisitor} className="p-5 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Visitor Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="name"
                    value={visitorForm.full_name}
                    onChange={(e) => setVisitorForm({ ...visitorForm, full_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91"
                    value={visitorForm.phone}
                    onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Purpose of Visit *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Admissions / Official / Guest"
                    value={visitorForm.visit_purpose}
                    onChange={(e) => setVisitorForm({ ...visitorForm, visit_purpose: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Host Person / Dept *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="text"
                    value={visitorForm.host_person}
                    onChange={(e) => setVisitorForm({ ...visitorForm, host_person: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Govt ID Type
                  </label>
                  <select
                    value={visitorForm.gov_id_type}
                    onChange={(e) => setVisitorForm({ ...visitorForm, gov_id_type: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden"
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Govt Office ID">Govt Office ID</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    ID Number
                  </label>
                  <input
                    type="text"
                    value={visitorForm.gov_id_number}
                    onChange={(e) => setVisitorForm({ ...visitorForm, gov_id_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    No. of People
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    placeholder="0"
                    value={visitorForm.accompanying_count === 0 ? "" : visitorForm.accompanying_count}
                    onChange={(e) => handleAccompanyingCountChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-800"
                  />
                </div>

                {/* If count is 0, show a clean placeholder in column 2 */}
                {(Number(visitorForm.accompanying_count) || 0) === 0 && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Person Name(s)
                    </label>
                    <input
                      type="text"
                      disabled
                      placeholder="Solo visitor (Enter No. of People to add names)"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                )}

                {/* If count >= 1, dynamically render input for each person */}
                {(visitorForm.accompanying_persons || []).map((name, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Person {idx + 1} Name *
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemovePerson(idx)}
                        className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                        title="Remove person"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder={`Enter Person ${idx + 1} Full Name`}
                      value={name}
                      onChange={(e) => handlePersonNameChange(idx, e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-800"
                    />
                  </div>
                ))}
              </div>

              {visitorPassType === "SPECIAL_FUNCTION" && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-1 text-slate-800 font-semibold text-xs">
                    <IdentificationBadge size={15} />
                    <span>Special Function Card Assignment</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                        Assign Physical ID Card UID *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Scan RFID or enter UID"
                        value={visitorForm.assigned_card_uid}
                        onChange={(e) => setVisitorForm({ ...visitorForm, assigned_card_uid: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                        Event / Function Name
                      </label>
                      <input
                        type="text"
                        placeholder="Annual Convocation"
                        value={visitorForm.event_name}
                        onChange={(e) => setVisitorForm({ ...visitorForm, event_name: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setVisitorModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVisitor}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  {submittingVisitor ? (
                    <SpinnerGap size={13} className="animate-spin text-amber-400" />
                  ) : (
                    <Printer size={13} className="text-amber-400" />
                  )}
                  <span>Issue Pass &amp; Print Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ISSUED VISITOR PASS RECEIPT MODAL                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {issuedPassReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-amber-400" />
                <h3 className="font-semibold text-xs">Official Visitor Pass Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setIssuedPassReceipt(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="text-center border-b border-slate-100 pb-3">
                <p className="font-bold text-xs text-slate-900">DEV SANSKRITI VISHWAVIDYALAYA</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                  Campus Security Desk · Gate Pass
                </p>
                <div className="mt-2 inline-block px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono font-semibold text-xs">
                  {issuedPassReceipt.pass_number}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Visitor:</span>
                  <span className="font-semibold text-slate-900">{issuedPassReceipt.full_name}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Contact:</span>
                  <span className="font-mono text-slate-700">{issuedPassReceipt.phone}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Purpose:</span>
                  <span className="text-slate-800">{issuedPassReceipt.visit_purpose}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Host:</span>
                  <span className="text-slate-800">{issuedPassReceipt.host_person}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Total Admitted:</span>
                  <span className="font-bold text-slate-900">
                    {issuedPassReceipt.total_persons || (Number(issuedPassReceipt.accompanying_count || 0) + 1)} Person(s)
                    {Number(issuedPassReceipt.accompanying_count || 0) > 0 && (
                      <span className="text-amber-700 font-medium text-[11px] ml-1">
                        (1 + {issuedPassReceipt.accompanying_count} sath)
                      </span>
                    )}
                  </span>
                </div>
                {issuedPassReceipt.accompanying_details && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Accompanying Info:</span>
                    <span className="text-slate-700 text-right max-w-[180px] truncate" title={issuedPassReceipt.accompanying_details}>
                      {issuedPassReceipt.accompanying_details}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Validity:</span>
                  <span className="font-medium text-emerald-700 font-mono text-[11px]">
                    {issuedPassReceipt.valid_from_ist} → {issuedPassReceipt.valid_until_ist}
                  </span>
                </div>
                {issuedPassReceipt.assigned_card_uid && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Assigned Card:</span>
                    <span className="font-mono font-semibold text-slate-900">{issuedPassReceipt.assigned_card_uid}</span>
                  </div>
                )}
              </div>

              <div className="p-2 rounded bg-slate-50 border border-slate-100 text-center text-[10px] text-slate-500">
                Please return this pass at the gate turnstile upon campus exit. Pass expires at 5:00 PM IST today.
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-1.5"
                >
                  <Printer size={14} />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIssuedPassReceipt(null)}
                  className="py-1.5 px-3 rounded-lg border border-slate-300 text-slate-700 text-xs hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardDashboard;
