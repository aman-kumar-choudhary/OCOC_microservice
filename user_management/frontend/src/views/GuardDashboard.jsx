import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  CalendarCheck,
  Camera,
  CheckCircle,
  Clock,
  CreditCard,
  Door,
  FileText,
  IdentificationBadge,
  MagnifyingGlass,
  Plus,
  Printer,
  QrCode,
  Shield,
  ShieldCheck,
  SignIn,
  SignOut,
  SpinnerGap,
  User,
  UserCheck,
  UserCircle,
  UserFocus,
  UserPlus,
  Users,
  Warning,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react";
import api from "../services/api";
import accessService from "../services/accessService";
import { useLiveFaceInference } from "../hooks/useLiveFaceInference";
import { useAuth } from "../context/AuthContext";
import {
  formatDateTimeIST,
  formatDateIST,
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
        action: action, // 'EXIT' or 'ENTRY'
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

  // Visitor Onboarding Submit
  const handleRegisterVisitor = async (e) => {
    e.preventDefault();
    if (!visitorForm.full_name || !visitorForm.phone) {
      alert("Please provide visitor name and contact number.");
      return;
    }
    setSubmittingVisitor(true);
    try {
      const payload = {
        ...visitorForm,
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

      // Status filter
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

      // Movement filter
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

  const overdueCount = hostelLeaves.filter((s) => {
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
    <div className="space-y-4 page-enter pb-8 max-w-7xl mx-auto">
      {/* ── Compact Header & Security Alert Strip ── */}
      <div className="rounded-2xl bg-gradient-to-r from-[#06182e] via-[#0a2342] to-[#12365f] text-white p-4 shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#f5bd19] text-[#0a2342] flex items-center justify-center font-black text-xl shadow-md shrink-0">
            <ShieldCheck size={28} weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#f5bd19] bg-white/10 px-2 py-0.5 rounded">
                Guard Console · Gate Operations
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-emerald-300 font-bold">Main Gate Turnstile Armed</span>
            </div>
            <h1 className="text-lg sm:text-xl font-display font-black text-white tracking-tight">
              DSVV Campus Security Desk
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Live IST Clock */}
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
            <Clock size={16} className="text-[#f5bd19]" />
            <span>{currentISTTime || "IST Clock Active"}</span>
          </div>

          {/* Quick New Visitor Button */}
          <button
            type="button"
            onClick={() => setVisitorModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#f5bd19] hover:bg-[#e6b014] text-[#0a2342] font-black text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
          >
            <UserPlus size={16} weight="bold" />
            <span>Onboard Visitor</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in ${
            actionMessage.type === "error"
              ? "bg-red-50 text-red-800 border-red-200"
              : actionMessage.type === "loading"
                ? "bg-blue-50 text-blue-800 border-blue-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Compact Top Metric Counter Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Approved Passes
            </span>
            <p className="text-xl font-black text-[#0a2342]">{activeLeaveCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <CalendarCheck size={20} weight="bold" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Currently Outside
            </span>
            <p className="text-xl font-black text-amber-700">{outsideCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <SignOut size={20} weight="bold" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Late / Overdue
            </span>
            <p className={`text-xl font-black ${overdueCount > 0 ? "text-red-600 animate-pulse" : "text-slate-700"}`}>
              {overdueCount}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${overdueCount > 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"}`}>
            <Warning size={20} weight="bold" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Visitors on Campus
            </span>
            <p className="text-xl font-black text-indigo-700">{activeVisitorsInside}</p>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Users size={20} weight="bold" />
          </div>
        </div>
      </div>

      {/* ── Modern Tabs Navigation (No vertical scrolling needed!) ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "students"
              ? "bg-white text-[#0a2342] shadow-xs font-black border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Door size={16} weight={activeTab === "students" ? "fill" : "bold"} className="text-amber-500" />
          <span>Student Gate Passes &amp; Movements</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] text-slate-700 font-extrabold">
            {hostelLeaves.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("visitors")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "visitors"
              ? "bg-white text-[#0a2342] shadow-xs font-black border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <IdentificationBadge size={16} weight={activeTab === "visitors" ? "fill" : "bold"} className="text-indigo-600" />
          <span>Visitor Onboarding &amp; Day Passes</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] text-slate-700 font-extrabold">
            {visitors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("freco")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "freco"
              ? "bg-white text-[#0a2342] shadow-xs font-black border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Camera size={16} weight={activeTab === "freco" ? "fill" : "bold"} className="text-rose-600" />
          <span>FRECO Biometrics &amp; Scanners</span>
          {pendingVerifications.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
              {pendingVerifications.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "alerts"
              ? "bg-white text-[#0a2342] shadow-xs font-black border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Warning size={16} weight={activeTab === "alerts" ? "fill" : "bold"} className="text-amber-600" />
          <span>Gate Alarms</span>
          {alerts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 text-[10px] font-black">
              {alerts.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: STUDENT GATE PASSES & MOVEMENTS                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "students" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student name, roll no, hostel..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342]"
                />
              </div>

              <select
                value={studentStatusFilter}
                onChange={(e) => setStudentStatusFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="OUTSIDE">Outside / On Leave</option>
                <option value="INSIDE">Inside Campus</option>
                <option value="LATE">Late / Overdue</option>
              </select>

              <select
                value={movementFilter}
                onChange={(e) => setMovementFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Movements</option>
                <option value="EXIT">Exited</option>
                <option value="ENTRY">Entered</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto text-xs text-slate-500 font-semibold">
              <span>Showing {filteredStudents.length} of {hostelLeaves.length} students</span>
              <button
                type="button"
                onClick={fetchLeaves}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                title="Refresh leave list"
              >
                <SpinnerGap size={14} className={loadingLeaves ? "animate-spin text-amber-500" : ""} />
              </button>
            </div>
          </div>

          {/* Compact Responsive Table with Direct Gate In/Out Actions */}
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student &amp; Hostel</th>
                  <th className="px-4 py-3">Current Location</th>
                  <th className="px-4 py-3">Approved Leave Window (IST)</th>
                  <th className="px-4 py-3">Timeliness Status</th>
                  <th className="px-4 py-3">Last Gate In / Out</th>
                  <th className="px-4 py-3 text-right">Gate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      No students found matching current filters.
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
                      <tr key={s.student_id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Student details */}
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-slate-900 text-sm">{s.student_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Roll: {s.student_roll || s.student_id.slice(0, 8)} · {s.hostel_name || "Campus Hostel"}
                          </div>
                          {s.student_phone && (
                            <div className="text-[10px] text-slate-400">{s.student_phone}</div>
                          )}
                        </td>

                        {/* Current Location Badge */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border ${
                              isOutside
                                ? "bg-orange-50 text-orange-800 border-orange-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {isOutside ? <SignOut size={13} weight="bold" /> : <SignIn size={13} weight="bold" />}
                            {s.current_status?.replace("_", " ") || "INSIDE"}
                          </span>
                        </td>

                        {/* Approved Leave Window (IST formatted) */}
                        <td className="px-4 py-3">
                          {s.permission_type ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-100">
                                {s.permission_type?.replace("_", " ")}
                              </span>
                              <div className="text-[11px] font-mono text-slate-700 mt-1">
                                {formatDateTimeIST(s.permission_start_time)}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                to {formatDateTimeIST(s.permission_end_time)}
                              </div>
                              {s.destination && (
                                <div className="text-[10px] text-slate-500 italic truncate max-w-xs">
                                  Dest: {s.destination}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No active leave pass</span>
                          )}
                        </td>

                        {/* Timeliness calculation (Early / Late / Overdue) */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black border ${timeInfo.colorClass}`}
                          >
                            {timeInfo.isLate && <Warning size={13} weight="bold" />}
                            {timeInfo.badge}
                          </span>
                        </td>

                        {/* Last Gate in/out */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">
                            {s.last_movement_type === "EXIT"
                              ? "Gate Exit (OUT)"
                              : s.last_movement_type === "ENTRY"
                                ? "Gate Entry (IN)"
                                : "No movement recorded"}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {s.last_event_time ? formatDateTimeIST(s.last_event_time) : "—"}
                          </div>
                          <div className="text-[10px] text-slate-400">{s.last_gate_name || "Main Gate"}</div>
                        </td>

                        {/* Quick Action Button for Guard: 1-click Gate Out / Gate In */}
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {isOutside ? (
                              <button
                                type="button"
                                onClick={() => handleRecordMovement(s, "ENTRY")}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-2xs transition flex items-center gap-1"
                              >
                                <SignIn size={14} weight="bold" />
                                <span>Gate In (Entry)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRecordMovement(s, "EXIT")}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-2xs transition flex items-center gap-1"
                              >
                                <SignOut size={14} weight="bold" />
                                <span>Gate Out (Exit)</span>
                              </button>
                            )}
                          </div>
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
      {/* TAB 2: VISITOR DESK (CAMPUS DAY PASS & EVENT CARDS)             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "visitors" && (
        <div className="space-y-4">
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0a2342] flex items-center gap-2">
                <IdentificationBadge size={20} className="text-indigo-600" />
                <span>Visitor Registration &amp; Pass Desk</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Onboard day visitors (5:00 AM – 5:00 PM IST) or issue long-term / special function event ID cards with printable receipts.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setVisitorModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <UserPlus size={16} weight="bold" className="text-[#f5bd19]" />
              <span>Register New Visitor</span>
            </button>
          </div>

          {/* Visitors Register Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                Active &amp; Recent Campus Visitors ({visitors.length})
              </h3>
              <button
                type="button"
                onClick={fetchVisitors}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <SpinnerGap size={14} className={loadingVisitors ? "animate-spin text-amber-500" : ""} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">Visitor Name &amp; Contact</th>
                    <th className="px-4 py-2.5">Purpose &amp; Host</th>
                    <th className="px-4 py-2.5">ID Proof</th>
                    <th className="px-4 py-2.5">Card / Pass UID</th>
                    <th className="px-4 py-2.5">Validity (IST)</th>
                    <th className="px-4 py-2.5">Campus Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-slate-400">
                        No visitors registered on campus today. Click "Register New Visitor" above.
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={v.visitor_id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="font-extrabold text-slate-900">{v.full_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{v.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-800">{v.visit_purpose}</span>
                          <p className="text-[11px] text-slate-500">Host: {v.host_person}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold text-slate-700">{v.gov_id_type}</span>
                          <p className="text-[10px] text-slate-400 font-mono">{v.gov_id_number || "Verified"}</p>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {v.card_uid ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                              {v.card_uid}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Day Pass</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-600">
                          {v.valid_until_ist || "5:00 PM IST Today"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              v.is_inside
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {v.is_inside ? "INSIDE CAMPUS" : "CHECKED OUT"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {v.is_inside && (
                            <button
                              type="button"
                              onClick={() => handleVisitorCheckout(v)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs"
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
          {/* Camera Feed */}
          <div className="app-panel overflow-hidden border-slate-200">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-[#0a2342]" />
                <h3 className="font-extrabold text-sm text-slate-900">FRECO Face Recognition Feed</h3>
              </div>
              <button
                type="button"
                onClick={isStreaming ? stopStream : startStream}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                  isStreaming
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-[#0a2342] hover:bg-[#12365f] text-white"
                }`}
              >
                {isStreaming ? "Stop Stream" : "Start Camera"}
              </button>
            </div>
            <div className="relative bg-slate-950 aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                  <UserFocus size={36} className="text-slate-600 animate-pulse" />
                  <span>Camera Standby · Click Start Camera</span>
                </div>
              )}
            </div>
            <div className="p-3 bg-slate-50 text-xs font-semibold text-slate-600 flex items-center justify-between border-t border-slate-200">
              <span>{faces.length} face(s) in view</span>
              {isStreaming && (
                <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> LIVE RECOGNITION
                </span>
              )}
            </div>
          </div>

          {/* Turnstile Live Events Table */}
          <div className="lg:col-span-2 app-panel border-slate-200 overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                Live Turnstile Scan Register ({events.length})
              </h3>
              <span className="text-[10px] font-bold text-slate-400">Auto-streaming via WebSocket</span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600">
                  <tr>
                    <th className="px-3.5 py-2">Time (IST)</th>
                    <th className="px-3.5 py-2">Identity</th>
                    <th className="px-3.5 py-2">Action</th>
                    <th className="px-3.5 py-2">Gate Location</th>
                    <th className="px-3.5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {events.slice(0, 30).map((ev, idx) => (
                    <tr key={ev.id || idx} className="hover:bg-slate-50/80">
                      <td className="px-3.5 py-2 font-mono text-slate-500 text-[11px]">
                        {formatTimeIST(ev.event_time)}
                      </td>
                      <td className="px-3.5 py-2 font-bold text-slate-900">
                        {ev.user_name || ev.user_identifier}
                      </td>
                      <td className="px-3.5 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            ev.action === "ENTRY" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {ev.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-slate-600">{ev.location_name || "Main Gate"}</td>
                      <td className="px-3.5 py-2 font-bold">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            ev.status === "GRANTED" ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {ev.status === "GRANTED" ? <CheckCircle size={14} /> : <XCircle size={14} />}
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
      {/* TAB 4: GATE ALARMS & SECURITY NOTIFICATIONS                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "alerts" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Warning size={18} className="text-amber-500" />
              <span>Campus Gate Security Exceptions</span>
            </h3>
            <span className="text-xs text-slate-500">{alerts.length} active alerts</span>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="font-bold text-slate-700">No active security alerts.</p>
                <p className="text-slate-400 mt-0.5">All gate turnstiles and hostel movements are operating normally.</p>
              </div>
            ) : (
              alerts.map((al, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-red-200 bg-red-50/60 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="font-extrabold text-red-900">{al.alert_type || "Security Exception"}</div>
                    <p className="text-red-700 mt-0.5">{al.message}</p>
                    <span className="text-[10px] text-red-500 font-mono mt-1 block">
                      {al.created_at ? formatDateTimeIST(al.created_at) : "Just now"}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-900 text-[10px] font-black uppercase shrink-0">
                    Warning
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* VISITOR ONBOARDING MODAL (DAY PASS 5 AM-5 PM OR LONG-TERM CARD)  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {visitorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0a2342] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#f5bd19] text-[#0a2342]">
                  <UserPlus size={18} weight="bold" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Visitor Onboarding &amp; Pass Issuance</h3>
                  <p className="text-[11px] text-slate-300">Issue official DSVV campus entry authorization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisitorModalOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pass Type Selector Toggle */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setVisitorPassType("TEMPORARY_DAY")}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition ${
                    visitorPassType === "TEMPORARY_DAY"
                      ? "bg-white text-[#0a2342] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Day Pass (5:00 AM – 5:00 PM)
                </button>
                <button
                  type="button"
                  onClick={() => setVisitorPassType("SPECIAL_FUNCTION")}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition ${
                    visitorPassType === "SPECIAL_FUNCTION"
                      ? "bg-white text-[#0a2342] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Special Function / ID Card Pass
                </button>
              </div>

              <p className="text-[11px] text-slate-500 mt-2 px-1">
                {visitorPassType === "TEMPORARY_DAY"
                  ? "Standard day visit pass. Automatically authorized today between 05:00 AM and 05:00 PM IST with quick short details."
                  : "For multi-day events, conferences, contractors, or VIPs requiring proper identity verification and an assigned physical/RFID ID card."}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterVisitor} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 block mb-1">
                    Visitor Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={visitorForm.full_name}
                    onChange={(e) => setVisitorForm({ ...visitorForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 block mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={visitorForm.phone}
                    onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 block mb-1">
                    Purpose of Visit *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Official Meeting / Admissions / Guest"
                    value={visitorForm.visit_purpose}
                    onChange={(e) => setVisitorForm({ ...visitorForm, visit_purpose: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 block mb-1">
                    Host Person / Department *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dean Office / Registrar / Dr. Sharma"
                    value={visitorForm.host_person}
                    onChange={(e) => setVisitorForm({ ...visitorForm, host_person: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 block mb-1">
                    Govt ID Type
                  </label>
                  <select
                    value={visitorForm.gov_id_type}
                    onChange={(e) => setVisitorForm({ ...visitorForm, gov_id_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342]"
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Govt Office ID">Govt Office ID</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 block mb-1">
                    ID Number (Last 4 digits or Full)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5432 or DL14201100"
                    value={visitorForm.gov_id_number}
                    onChange={(e) => setVisitorForm({ ...visitorForm, gov_id_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
                  />
                </div>
              </div>

              {/* Special Function / Long Term Specific Fields */}
              {visitorPassType === "SPECIAL_FUNCTION" && (
                <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-extrabold text-xs">
                    <IdentificationBadge size={16} />
                    <span>Special Function Card Assignment Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-black uppercase text-indigo-800 block mb-1">
                        Assign Physical ID Card UID *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Scan RFID or enter Card UID"
                        value={visitorForm.assigned_card_uid}
                        onChange={(e) => setVisitorForm({ ...visitorForm, assigned_card_uid: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:border-indigo-600 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-black uppercase text-indigo-800 block mb-1">
                        Event / Function Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Annual Convocation / Seminar"
                        value={visitorForm.event_name}
                        onChange={(e) => setVisitorForm({ ...visitorForm, event_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-black uppercase text-indigo-800 block mb-1">
                        Valid Until Date
                      </label>
                      <input
                        type="date"
                        value={visitorForm.valid_until}
                        onChange={(e) => setVisitorForm({ ...visitorForm, valid_until: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-black uppercase text-indigo-800 block mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="visitor@example.com"
                        value={visitorForm.email}
                        onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:border-indigo-600"
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
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVisitor}
                  className="px-5 py-2 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white text-xs font-black shadow-md transition flex items-center gap-1.5"
                >
                  {submittingVisitor ? (
                    <SpinnerGap size={14} className="animate-spin text-amber-400" />
                  ) : (
                    <Printer size={14} className="text-[#f5bd19]" />
                  )}
                  <span>
                    {visitorPassType === "TEMPORARY_DAY"
                      ? "Issue 5 AM–5 PM Day Pass"
                      : "Assign Card & Generate Receipt"}
                  </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="px-5 py-3.5 bg-[#0a2342] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#f5bd19]" />
                <h3 className="font-black text-sm">Official Visitor Pass Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setIssuedPassReceipt(null)}
                className="text-slate-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pass Printable Body */}
            <div className="p-6 space-y-4" id="visitor-receipt-card">
              <div className="text-center border-b border-slate-200 pb-3">
                <p className="font-black text-sm text-[#0a2342]">DEV SANSKRITI VISHWAVIDYALAYA</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  Campus Security Desk · Gate Pass
                </p>
                <div className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-mono font-black text-xs">
                  {issuedPassReceipt.pass_number}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-400">Visitor:</span>
                  <span className="font-extrabold text-slate-900">{issuedPassReceipt.full_name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-400">Contact:</span>
                  <span className="font-mono text-slate-800">{issuedPassReceipt.phone}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-400">Purpose:</span>
                  <span className="font-semibold text-slate-800">{issuedPassReceipt.visit_purpose}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-400">Host to Visit:</span>
                  <span className="font-semibold text-slate-800">{issuedPassReceipt.host_person}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-400">Validity Window:</span>
                  <span className="font-bold text-emerald-700 font-mono text-[11px]">
                    {issuedPassReceipt.valid_from_ist} to {issuedPassReceipt.valid_until_ist}
                  </span>
                </div>
                {issuedPassReceipt.assigned_card_uid && (
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-400">Assigned ID Card UID:</span>
                    <span className="font-mono font-black text-blue-700">{issuedPassReceipt.assigned_card_uid}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-400">Issued At:</span>
                  <span className="text-slate-600 font-mono text-[11px]">{issuedPassReceipt.issued_at_ist}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-[10px] text-slate-500">
                Please return this card at the gate turnstile upon campus exit. Pass expires at 5:00 PM IST unless granted special extension.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Printer size={15} />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIssuedPassReceipt(null)}
                  className="py-2 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
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
