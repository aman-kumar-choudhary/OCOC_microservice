import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  Clock,
  CreditCard,
  Door,
  Gear,
  HardDrives,
  Lock,
  LockKey,
  LockSimple,
  MagnifyingGlass,
  MapPin,
  Phone,
  Radio,
  Shield,
  ShieldCheck,
  ShieldWarning,
  SignIn,
  SignOut,
  Sliders,
  SpinnerGap,
  User,
  UserCheck,
  UserPlus,
  Users,
  Warning,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react";
import api from "@/services/api";
import accessService from "@/services/accessService";
import GuardDetailModal from "@/components/guard/GuardDetailModal";
import { formatDateTimeIST, formatDateIST } from "@/utils/date";

export const SecurityAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("roster"); // 'roster' | 'duty' | 'conditions' | 'incidents'
  const [guards, setGuards] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedGuardId, setSelectedGuardId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Duty Assignment Form State
  const [assignForm, setAssignForm] = useState({
    guard_id: "",
    post_location: "Main Campus Gate (North)",
    shift: "Morning Shift (06:00 - 14:00)",
    duty_status: "ON_DUTY",
    instructions: "Monitor student leave passes and visitor day passes.",
  });
  const [submittingDuty, setSubmittingDuty] = useState(false);

  // Security Conditions
  const [curfewActive, setCurfewActive] = useState(true);
  const [lockdownMode, setLockdownMode] = useState(false);
  const [twoFactorEnforced, setTwoFactorEnforced] = useState(true);
  const [visitorCutoffActive, setVisitorCutoffActive] = useState(true);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [guardsRes, overviewData] = await Promise.all([
        api.get("/users?role=SECURITY_GUARD&limit=100").catch(() => ({ data: { data: { users: [] } } })),
        accessService.getSecurityAdminOverview().catch(() => null),
      ]);

      const gList = guardsRes.data?.data?.users || [];
      setGuards(gList);
      if (overviewData) {
        setOverview(overviewData);
        setCurfewActive(overviewData.curfew_active);
      }
    } catch (err) {
      console.error("Failed to load security admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleAssignDuty = async (e) => {
    e.preventDefault();
    if (!assignForm.guard_id) {
      alert("Please select a security guard from the roster.");
      return;
    }
    setSubmittingDuty(true);
    try {
      await accessService.assignGuardDuty(assignForm);
      setNotification({
        type: "success",
        text: `Guard successfully assigned to ${assignForm.post_location} (${assignForm.shift}).`,
      });
      setTimeout(() => setNotification(null), 4000);
      fetchSecurityData();
      setActiveTab("roster");
    } catch (err) {
      alert(err.response?.data?.detail || err.message || "Failed to assign guard duty.");
    } finally {
      setSubmittingDuty(false);
    }
  };

  const handleToggleCommand = async (commandType, currentState, setter) => {
    const newState = !currentState;
    setter(newState);
    try {
      const res = await accessService.executeSecurityCommand({
        command: commandType,
        enabled: newState,
        action: newState ? "ENABLE" : "DISABLE",
      });
      setNotification({
        type: "success",
        text: res.message || `${commandType} security command successfully executed & broadcasted.`,
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      setter(currentState); // rollback state
      alert(err.response?.data?.detail || err.message || `Failed to execute ${commandType} command.`);
    }
  };

  const handleTriggerAlarm = async () => {
    if (!window.confirm("CONFIRMATION: Broadcast campus-wide emergency perimeter security alarm to all gates?")) {
      return;
    }
    try {
      const res = await accessService.executeSecurityCommand({
        command: "EMERGENCY_ALARM",
        action: "TRIGGER",
        reason: "Manual emergency perimeter security alarm triggered from Command Center",
      });
      setNotification({
        type: "success",
        text: res.message || "EMERGENCY ALARM broadcasted to all gate turnstiles and guard consoles!",
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || "Failed to trigger emergency alarm.");
    }
  };

  const filteredGuards = guards.filter((g) => {
    const q = search.toLowerCase();
    const name = (g.profile?.full_name || g.full_name || "").toLowerCase();
    const email = (g.email || "").toLowerCase();
    const empId = (g.profile?.employee_id || g.employee_id || "").toLowerCase();
    const matchSearch = !q || name.includes(q) || email.includes(q) || empId.includes(q);
    const matchStatus = statusFilter === "all" || g.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5 page-enter max-w-7xl mx-auto pb-10">
      {/* ── Security Command Banner ── */}
      <div className="rounded-3xl bg-gradient-to-r from-[#06182e] via-[#0a2342] to-[#163a66] text-white p-6 shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-[#f5bd19] text-[#0a2342] flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
            <ShieldCheck size={32} weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#f5bd19] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                Security Administration Command Center
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-300">All Campus Gates Active</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight mt-0.5">
              DSVV Campus Security Operations &amp; Roster Control
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl mt-0.5 leading-relaxed">
              Supervise all campus security guards, duty assignments, gate access conditions, and student curfew policies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleTriggerAlarm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 animate-pulse"
            title="Broadcast emergency security alarm to all gates"
          >
            <ShieldWarning size={16} weight="bold" />
            <span>Emergency Perimeter Alarm</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("duty")}
            className="px-4 py-2 rounded-xl bg-[#f5bd19] hover:bg-[#e6b014] text-[#0a2342] font-black text-xs shadow-md transition flex items-center gap-1.5"
          >
            <MapPin size={16} weight="bold" />
            <span>Deploy Guard Duty</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Key Operational Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Total Security Officers
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Shield size={18} weight="bold" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#0a2342] mt-1">{guards.length}</p>
          <span className="text-[11px] text-slate-500">On campus security roster</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Guards on Duty
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle size={18} weight="bold" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {guards.filter((g) => g.status === "active").length}
          </p>
          <span className="text-[11px] text-slate-500">Staffed across 6 campus posts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Night Curfew Policy
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Clock size={18} weight="bold" />
            </div>
          </div>
          <p className="text-base font-black text-slate-900 mt-1">10:00 PM – 5:00 AM</p>
          <span className="text-[11px] text-emerald-600 font-bold">Standard Curfew Active</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Visitor Gate Policy
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Door size={18} weight="bold" />
            </div>
          </div>
          <p className="text-base font-black text-slate-900 mt-1">05:00 AM – 05:00 PM</p>
          <span className="text-[11px] text-slate-500">Day pass validity window</span>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/80 shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("roster")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "roster"
              ? "bg-white text-[#0a2342] shadow-xs font-black border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Users size={16} weight={activeTab === "roster" ? "fill" : "bold"} className="text-amber-500" />
          <span>Security Personnel Roster &amp; Dossiers</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-extrabold text-slate-700">
            {guards.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("duty")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "duty"
              ? "bg-white text-[#0a2342] shadow-xs font-black border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <MapPin size={16} weight={activeTab === "duty" ? "fill" : "bold"} className="text-indigo-600" />
          <span>Deploy Guard Duty Posts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "incidents"
              ? "bg-white text-[#0a2342] shadow-xs font-black border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Warning size={16} weight={activeTab === "incidents" ? "fill" : "bold"} className="text-rose-600" />
          <span>Security Incidents &amp; Alarms</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PERSONNEL ROSTER & DOSSIERS                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search guards by name, badge ID, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-1.5 px-3 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700"
              >
                <option value="all">All Guard Statuses</option>
                <option value="active">Active On Duty</option>
                <option value="suspended">Suspended / Off Duty</option>
              </select>

              <button
                type="button"
                onClick={fetchSecurityData}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Guard Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
              <SpinnerGap size={24} className="animate-spin text-amber-500" />
              <span>Loading security personnel details...</span>
            </div>
          ) : filteredGuards.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-300">
              <ShieldWarning size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">No security guards found matching criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGuards.map((g) => {
                const fullName = g.profile?.full_name || g.full_name || "Security Officer";
                const empId = g.profile?.employee_id || g.employee_id || "SG-" + g.id.slice(0, 6).toUpperCase();
                const jobType = g.profile?.job_type || g.profile?.designation || "Gate & Perimeter Security";
                const shift = g.profile?.shift || "Standard Duty Shift";
                const workArea = g.profile?.work_area || g.profile?.assigned_location || "Main Campus Gate";
                const isActive = g.status === "active";

                return (
                  <div
                    key={g.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-[#0a2342] text-[#f5bd19] flex items-center justify-center font-black text-base shadow-xs shrink-0">
                            <Shield size={20} weight="fill" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900 leading-tight">{fullName}</h3>
                            <p className="text-[11px] font-mono text-slate-500 mt-0.5">Badge: {empId}</p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {isActive ? <CheckCircle size={11} /> : <XCircle size={11} />}
                          {g.status?.toUpperCase() || "ACTIVE"}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-500">Designation:</span>
                          <span className="font-semibold text-slate-800">{jobType}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-500">Assigned Post:</span>
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <MapPin size={12} className="text-amber-600" /> {workArea}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-500">Duty Shift:</span>
                          <span className="font-semibold text-slate-800">{shift}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold border ${
                            g.active_rfid
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          <CreditCard size={12} />
                          RFID {g.active_rfid ? "Armed" : "Not Assigned"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold border ${
                            g.has_face_auth
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          <UserCheck size={12} />
                          Biometric {g.has_face_auth ? "Enrolled" : "Pending"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGuardId(g.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck size={14} /> View Dossier
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAssignForm((prev) => ({ ...prev, guard_id: g.id }));
                          setActiveTab("duty");
                        }}
                        className="py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700"
                        title="Assign duty post"
                      >
                        Assign Post
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: DEPLOY GUARD DUTY POSTS                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "duty" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#0a2342] flex items-center gap-2">
              <MapPin size={20} className="text-indigo-600" />
              <span>Guard Duty Post &amp; Shift Assignment Console</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Assign security guards to specific campus entrance turnstiles, residential hostel barriers, or perimeter security shifts.
            </p>
          </div>

          <form onSubmit={handleAssignDuty} className="space-y-4 max-w-2xl">
            <div>
              <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                Select Security Guard *
              </label>
              <select
                required
                value={assignForm.guard_id}
                onChange={(e) => setAssignForm({ ...assignForm, guard_id: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342] font-semibold text-slate-800"
              >
                <option value="">-- Choose Security Officer --</option>
                {guards.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.profile?.full_name || g.full_name || g.email} (Badge: {g.profile?.employee_id || g.id.slice(0, 6)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                  Assigned Gate / Duty Post *
                </label>
                <select
                  value={assignForm.post_location}
                  onChange={(e) => setAssignForm({ ...assignForm, post_location: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342] font-semibold text-slate-800"
                >
                  <option value="Main Campus Gate (North)">Main Campus Gate (North)</option>
                  <option value="Main Campus Gate (South)">Main Campus Gate (South)</option>
                  <option value="Girls Hostel Main Gate (Shanghmitra / Nivedita)">Girls Hostel Main Gate</option>
                  <option value="Boys Hostel Main Gate (Arvind / Paninni)">Boys Hostel Main Gate</option>
                  <option value="Central Library Turnstile Checkpoint">Central Library Turnstile</option>
                  <option value="Academic Block Main Barrier">Academic Block Main Barrier</option>
                  <option value="Campus Perimeter Patrol">Campus Perimeter Patrol</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                  Active Shift *
                </label>
                <select
                  value={assignForm.shift}
                  onChange={(e) => setAssignForm({ ...assignForm, shift: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342] font-semibold text-slate-800"
                >
                  <option value="Morning Shift (06:00 - 14:00)">Morning Shift (06:00 - 14:00)</option>
                  <option value="Evening Shift (14:00 - 22:00)">Evening Shift (14:00 - 22:00)</option>
                  <option value="Night Shift (22:00 - 06:00)">Night Shift (22:00 - 06:00)</option>
                  <option value="General Day Shift (09:00 - 18:00)">General Day Shift (09:00 - 18:00)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                Specific Post Instructions &amp; Security Protocol
              </label>
              <textarea
                rows={3}
                value={assignForm.instructions}
                onChange={(e) => setAssignForm({ ...assignForm, instructions: e.target.value })}
                placeholder="e.g. Verify all student leave passes via Guard Console, enforce 5 PM visitor cut-off, inspect vehicle boots."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submittingDuty}
                className="px-6 py-2.5 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white text-xs font-black shadow-md transition flex items-center gap-2"
              >
                {submittingDuty && <SpinnerGap size={14} className="animate-spin text-amber-400" />}
                <CheckCircle size={16} weight="bold" />
                <span>Confirm &amp; Deploy Guard Duty</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("roster")}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: CAMPUS SECURITY CONDITIONS & CURFEW                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "conditions" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-[#0a2342] flex items-center gap-2">
                <Sliders size={20} className="text-emerald-600" />
                <span>Campus Gate &amp; Access Policy Controls</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure global security conditions, curfew enforcement, and emergency overrides.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Curfew Switch */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                    <Clock size={16} className="text-amber-600" />
                    <span>Night Curfew Enforcement</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCommand("CURFEW", curfewActive, setCurfewActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      curfewActive ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        curfewActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Curfew active from 10:00 PM to 05:00 AM IST. Turnstiles sound alarm on unauthorized student hostel exits during this window.
                </p>
              </div>

              {/* Visitor Cut-off Switch */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                    <Door size={16} className="text-indigo-600" />
                    <span>5:00 PM Visitor Departure Cut-off</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCommand("VISITOR_CUTOFF", visitorCutoffActive, setVisitorCutoffActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      visitorCutoffActive ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        visitorCutoffActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Automated flag alerting guards to clear day pass visitors remaining on campus after 05:00 PM IST.
                </p>
              </div>

              {/* Emergency Lockdown Switch */}
              <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs text-rose-900">
                    <LockSimple size={16} className="text-rose-600" />
                    <span>Campus Perimeter Lockdown</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCommand("LOCKDOWN", lockdownMode, setLockdownMode)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      lockdownMode ? "bg-rose-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        lockdownMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-rose-700">
                  Restricts all external exits immediately. Only Security Admin authorization allows gate bypass.
                </p>
              </div>

              {/* 2-SV Face Biometrics Enforced */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                    <UserCheck size={16} className="text-purple-600" />
                    <span>FRECO Two-Factor Gate Verification</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCommand("TWO_FACTOR", twoFactorEnforced, setTwoFactorEnforced)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      twoFactorEnforced ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        twoFactorEnforced ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Requires simultaneous RFID card scan and live camera facial recognition match before barrier opens.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: INCIDENTS & ALARMS                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "incidents" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#0a2342] flex items-center gap-2">
              <Warning size={20} className="text-rose-600" />
              <span>Turnstile Incident Log &amp; Curfew Alarms</span>
            </h2>
            <span className="text-xs text-slate-500 font-bold">Real-time incident monitoring</span>
          </div>

          <div className="space-y-3">
            {[
              {
                type: "HOSTEL_CURFEW_VIOLATION",
                title: "Curfew Return Alert: Paninni Boys Hostel Gate",
                time: "10:34 PM IST",
                description: "Student roll no. 2024-DSVV-102 returned 34 minutes after the 10:00 PM curfew cut-off.",
                severity: "HIGH",
              },
              {
                type: "UNAUTHORIZED_EXIT_ATTEMPT",
                title: "Main Gate Exit Denied (No Active Leave Pass)",
                time: "07:12 PM IST",
                description: "Turnstile scanner denied exit badge: student has no approved leave pass for today.",
                severity: "MEDIUM",
              },
              {
                type: "ANTI_PASSBACK_TRIGGERED",
                title: "Anti-Passback Alert: Library Turnstile Barrier",
                time: "03:45 PM IST",
                description: "Card badge was swiped twice in succession without exiting the reading zone.",
                severity: "LOW",
              },
            ].map((inc, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{inc.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        inc.severity === "HIGH"
                          ? "bg-red-100 text-red-800"
                          : inc.severity === "MEDIUM"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </div>
                  <p className="text-slate-600">{inc.description}</p>
                  <span className="text-[11px] font-mono text-slate-400 block pt-0.5">{inc.time}</span>
                </div>

                <button
                  type="button"
                  className="px-3 py-1 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs shrink-0"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fixed Guard Dossier Modal (userService.getUserById resolved) ── */}
      {selectedGuardId && (
        <GuardDetailModal
          guardId={selectedGuardId}
          onClose={() => setSelectedGuardId(null)}
          onGuardUpdated={fetchSecurityData}
        />
      )}
    </div>
  );
};

export default SecurityAdminDashboard;
