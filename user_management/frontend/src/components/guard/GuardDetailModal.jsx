import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Camera,
  Check,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  CreditCard,
  Door,
  Envelope,
  IdentificationBadge,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  ShieldWarning,
  SignIn,
  SignOut,
  SpinnerGap,
  User,
  UserCheck,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react";
import api from "@/services/api";
import accessService from "@/services/accessService";
import userService from "@/services/userService";
import UserAccessDetail from "@/components/access/UserAccessDetail";

export const GuardDetailModal = ({
  guardId,
  onClose,
  onGuardUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [guardUser, setGuardUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [dutyEvents, setDutyEvents] = useState([]);
  const [error, setError] = useState("");
  const [isEditingAccess, setIsEditingAccess] = useState(false);

  useEffect(() => {
    if (guardId) {
      loadGuardDetails();
    }
  }, [guardId]);

  const loadGuardDetails = async () => {
    setLoading(true);
    setError("");
    try {
      const [accessDetail, userRes, eventsRes] = await Promise.all([
        accessService.getAccessUserDetail(guardId).catch(() => null),
        (userService.getUserById ? userService.getUserById(guardId) : userService.getById(guardId)).catch(() => null),
        api.get(`/access/events?user_id=${guardId}&limit=10`).catch(() => ({ data: { data: [] } })),
      ]);

      setGuardUser(accessDetail);
      setProfileData(userRes || {});
      setDutyEvents(eventsRes.data?.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to load guard profile.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!guardId) return null;

  // Extract combined properties
  const fullName =
    guardUser?.full_name ||
    profileData?.profile?.full_name ||
    profileData?.full_name ||
    guardUser?.email ||
    "Security Officer";
  const empId =
    guardUser?.employee_id ||
    profileData?.profile?.employee_id ||
    profileData?.employee_id ||
    "Not assigned";
  const designation =
    profileData?.profile?.designation ||
    profileData?.profile?.job_type ||
    "Campus Security Guard";
  const department =
    guardUser?.department ||
    profileData?.profile?.department ||
    profileData?.profile?.agency ||
    "DSVV Campus Security Division";
  const shift = profileData?.profile?.shift || "Not assigned";
  const joiningDate =
    profileData?.profile?.date_of_joining ||
    guardUser?.created_at?.slice(0, 10) ||
    "Not Specified";
  const supervisor =
    profileData?.profile?.reporting_supervisor ||
    profileData?.profile?.supervisor ||
    "Not assigned";
  const phone = guardUser?.phone || profileData?.profile?.phone || "Not Provided";
  const email = guardUser?.email || profileData?.email || "Not Provided";
  const emergencyContact =
    profileData?.profile?.emergency_contact ||
    profileData?.profile?.emergency_phone ||
    "Security Control Room (Ext. 101)";
  const address =
    profileData?.profile?.address ||
    profileData?.profile?.current_address ||
    "DSVV Staff Quarters / Local Residence";

  // Biometrics
  const photoUrl = guardUser?.photo_reference || profileData?.photo_reference;
  const hasFace = !!(
    photoUrl ||
    profileData?.has_face_auth ||
    profileData?.face_registered
  );
  const activeRfid = !!(profileData?.active_rfid || profileData?.rfid_uid);
  const rfidUid =
    profileData?.rfid_uid ||
    profileData?.active_rfid?.uid ||
    null;

  // Assigned locations
  const activeGrants = (guardUser?.location_grants || []).filter(
    (g) => g.status === "active",
  );
  const assignedLocationNames = activeGrants.map((g) => g.location_name);
  const primaryLocation =
    assignedLocationNames[0] ||
    profileData?.profile?.work_area ||
    profileData?.profile?.assigned_location ||
    "Not assigned";

  // Last activity
  const lastEvent = dutyEvents[0] || null;
  const isOnDuty = guardUser?.status === "active";

  if (isEditingAccess) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex justify-end bg-[#0a2342]/60 backdrop-blur-xs animate-fade-in">
        <div className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col animate-slide-left">
          <UserAccessDetail
            userId={guardId}
            onClose={() => {
              setIsEditingAccess(false);
              loadGuardDetails();
              if (onGuardUpdated) onGuardUpdated();
            }}
            onUserUpdated={() => {
              loadGuardDetails();
              if (onGuardUpdated) onGuardUpdated();
            }}
          />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2342]/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0a2342] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f5bd19] text-[#0a2342] flex items-center justify-center font-black text-base shadow-xs shrink-0">
              <Shield size={20} weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#f5bd19] bg-white/10 px-2 py-0.5 rounded">
                  Security Personnel Dossier
                </span>
                <span className="text-white/40">•</span>
                <span className="text-xs font-mono text-white/70">
                  Badge: {empId}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white leading-tight">
                {fullName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingAccess(true)}
              className="px-3 py-1.5 rounded-xl bg-[#f5bd19] hover:bg-[#e6b014] text-[#0a2342] font-black text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <ShieldCheck size={14} weight="bold" />
              Manage Access &amp; Locations
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/60">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <SpinnerGap size={28} className="animate-spin text-[#0a2342]" />
              <p className="text-xs font-bold">Loading guard information...</p>
            </div>
          ) : error ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <WarningCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* CARD 1: PROFILE HEADER CARD */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Passport Photo */}
                  <div className="relative shrink-0">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={fullName}
                        className="w-20 h-26 rounded-xl object-cover border-2 border-slate-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-20 h-26 rounded-xl bg-slate-100 border-2 border-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <User size={30} />
                        <span className="text-[9px] uppercase font-bold mt-1">Photo</span>
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full text-[9px] font-black border shadow-xs ${
                        isOnDuty
                          ? "bg-emerald-500 text-white border-white"
                          : "bg-slate-400 text-white border-white"
                      }`}
                    >
                      {isOnDuty ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  {/* Header Details */}
                  <div className="space-y-1.5 flex-1 text-center sm:text-left min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="truncate">
                        <h3 className="text-lg font-black text-slate-900 leading-snug truncate">
                          {fullName}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500">
                          {designation}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-extrabold shrink-0 self-center sm:self-auto">
                        <Shield size={12} weight="fill" />
                        Security Personnel
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Employee / Guard ID
                        </span>
                        <span className="font-mono font-extrabold text-slate-800 text-[11px]">
                          {empId}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Current Assigned Post
                        </span>
                        <span className="font-bold text-slate-800 flex items-center gap-1 truncate text-[11px]">
                          <MapPin size={11} className="text-amber-600 shrink-0" />
                          {primaryLocation}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Active Duty Shift
                        </span>
                        <span className="font-bold text-slate-800 truncate block text-[11px]">
                          {shift}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TWO-COLUMN GRID: PERSONAL & EMPLOYMENT DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* CARD 2: PERSONAL INFORMATION */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <User size={15} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Personal Information
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Full Name:</span>
                      <span className="font-semibold text-slate-800 text-right">{fullName}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Contact:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Phone size={11} className="text-slate-400" />
                        {phone}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Email:</span>
                      <span className="font-semibold text-slate-800 truncate text-[11px]">{email}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Emergency:</span>
                      <span className="font-semibold text-rose-700 text-right">{emergencyContact}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Address:</span>
                      <span className="font-semibold text-slate-700 text-right text-[11px] max-w-[180px] truncate">
                        {address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD 3: EMPLOYMENT DETAILS */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <IdentificationBadge size={15} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Employment Details
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Department:</span>
                      <span className="font-semibold text-slate-800 text-right">{department}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Shift:</span>
                      <span className="font-semibold text-slate-800">{shift}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Deployment:</span>
                      <span className="font-semibold text-slate-800">{joiningDate}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Supervisor:</span>
                      <span className="font-semibold text-slate-800 text-right">{supervisor}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Clearance:</span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                        <Check size={10} weight="bold" /> Verified &amp; Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 4: ACCESS AND PERMISSIONS SUMMARY */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={15} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Access &amp; Permissions Summary
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Role: <span className="text-[#0a2342] font-black">Security Guard</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Assigned Gates / Locations */}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                    <span className="font-extrabold text-slate-900 block flex items-center gap-1 text-[11px]">
                      <Door size={13} className="text-amber-600" />
                      Assigned Gates
                    </span>
                    {assignedLocationNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assignedLocationNames.map((locName, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 text-[10px] font-bold"
                          >
                            {locName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic text-[11px]">
                        Campus perimeter coverage
                      </p>
                    )}
                  </div>

                  {/* Allowed Operations */}
                  <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-1">
                    <span className="font-extrabold text-emerald-950 block flex items-center gap-1 text-[11px]">
                      <CheckCircle size={13} className="text-emerald-600" />
                      Allowed Operations
                    </span>
                    <ul className="space-y-0.5 text-[11px] text-emerald-900">
                      <li className="flex items-center gap-1">
                        <Check size={10} weight="bold" className="text-emerald-600" />
                        Gate scan evaluation
                      </li>
                      <li className="flex items-center gap-1">
                        <Check size={10} weight="bold" className="text-emerald-600" />
                        Visitor day pass creation
                      </li>
                      <li className="flex items-center gap-1">
                        <Check size={10} weight="bold" className="text-emerald-600" />
                        Vehicle verification
                      </li>
                    </ul>
                  </div>

                  {/* Restricted Operations */}
                  <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-100 space-y-1">
                    <span className="font-extrabold text-rose-950 block flex items-center gap-1 text-[11px]">
                      <ShieldWarning size={13} className="text-rose-600" />
                      Restricted Operations
                    </span>
                    <ul className="space-y-0.5 text-[11px] text-rose-900">
                      <li className="flex items-center gap-1">
                        <X size={10} weight="bold" className="text-rose-500" />
                        Student leave approval
                      </li>
                      <li className="flex items-center gap-1">
                        <X size={10} weight="bold" className="text-rose-500" />
                        System-wide IAM config
                      </li>
                      <li className="flex items-center gap-1">
                        <X size={10} weight="bold" className="text-rose-500" />
                        Academic record edits
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* TWO-COLUMN: ATTENDANCE & BIOMETRIC STATUS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* CARD 5: ATTENDANCE & DUTY ACTIVITY */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-[#0a2342]" weight="bold" />
                      <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                        Attendance &amp; Duty
                      </h4>
                    </div>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                        isOnDuty
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {isOnDuty ? "● ON DUTY" : "○ OFF DUTY"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Shift Status:</span>
                      <span className="font-extrabold text-slate-800 text-[11px]">
                        {isOnDuty ? "Active On Post" : "Standby / Concluded"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Event:</span>
                      <span className="font-mono text-slate-700 text-[11px]">
                        {lastEvent?.event_time
                          ? new Date(lastEvent.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "No recent events"}
                      </span>
                    </div>
                  </div>

                  {dutyEvents.length > 0 && (
                    <div className="pt-1 border-t border-slate-100 space-y-1">
                      {dutyEvents.slice(0, 3).map((evt, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]"
                        >
                          <span className="font-medium text-slate-800 truncate text-[11px]">
                            {evt.location_name || "Campus Checkpoint"}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(evt.event_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CARD 6: SECURITY & BIOMETRIC STATUS */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <UserCheck size={15} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Security &amp; Biometrics
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Face Recognition */}
                    <div className="p-2 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
                          <Camera size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[11px]">Face Biometric</p>
                          <p className="text-[10px] text-slate-400">Gate facial auth</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          hasFace
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {hasFace ? <CheckCircle size={10} /> : <WarningCircle size={10} />}
                        {hasFace ? "Registered" : "Pending"}
                      </span>
                    </div>

                    {/* RFID Card */}
                    <div className="p-2 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                          <CreditCard size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[11px]">Physical RFID</p>
                          <p className="text-[10px] text-slate-400">
                            {rfidUid ? `UID: ${rfidUid}` : "Unmapped"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          activeRfid
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {activeRfid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {activeRfid ? "Armed" : "Not Mapped"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono">
            Dev Sanskriti Vishwavidyalaya · Security Command Console
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#0a2342] text-white hover:bg-[#12365f] text-xs font-bold transition shadow-xs"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GuardDetailModal;
