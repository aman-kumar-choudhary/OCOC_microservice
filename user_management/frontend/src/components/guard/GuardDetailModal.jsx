import React, { useState, useEffect } from "react";
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
        userService.getUserById(guardId).catch(() => null),
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
    return (
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
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2342]/70 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0a2342] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f5bd19] text-[#0a2342] flex items-center justify-center font-black text-lg shadow-xs">
              <Shield size={22} weight="fill" />
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
              <h2 className="text-lg font-extrabold text-white">
                {fullName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingAccess(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#f5bd19] hover:bg-[#e6b014] text-[#0a2342] font-extrabold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <ShieldCheck size={14} weight="bold" />
              Manage Access &amp; Locations
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/60">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <SpinnerGap size={32} className="animate-spin text-[#0a2342]" />
              <p className="text-xs font-bold">Loading guard information cards...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5">
              <WarningCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 14.1 CARD 1: PROFILE HEADER CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  {/* Passport Photo (Standard 3:4 Aspect Ratio) */}
                  <div className="relative shrink-0">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={fullName}
                        className="w-24 h-32 rounded-2xl object-cover border-2 border-slate-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-24 h-32 rounded-2xl bg-slate-100 border-2 border-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <User size={36} />
                        <span className="text-[10px] uppercase font-bold mt-1">Photo</span>
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold border shadow-xs ${
                        isOnDuty
                          ? "bg-emerald-500 text-white border-white"
                          : "bg-slate-400 text-white border-white"
                      }`}
                    >
                      {isOnDuty ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  {/* Header Details */}
                  <div className="space-y-2 flex-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight">
                          {fullName}
                        </h3>
                        <p className="text-xs font-bold text-slate-600 mt-0.5">
                          {designation}
                        </p>
                      </div>

                      <div className="flex items-center justify-center sm:justify-end gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-extrabold">
                          <Shield size={12} weight="fill" />
                          Security Personnel
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Employee / Guard ID
                        </span>
                        <span className="font-mono font-extrabold text-slate-800">
                          {empId}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Current Assigned Post
                        </span>
                        <span className="font-bold text-slate-800 flex items-center gap-1 truncate">
                          <MapPin size={12} className="text-amber-600 shrink-0" />
                          {primaryLocation}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Active Duty Shift
                        </span>
                        <span className="font-bold text-slate-800 truncate block">
                          {shift}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 14.1 TWO-COLUMN GRID FOR PERSONAL & EMPLOYMENT DETAILS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* CARD 2: PERSONAL INFORMATION */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <User size={16} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Personal Information
                    </h4>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Full Legal Name:</span>
                      <span className="font-semibold text-slate-800 text-right">{fullName}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Contact Number:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" />
                        {phone}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Official Email:</span>
                      <span className="font-semibold text-slate-800 truncate">{email}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Emergency Contact:</span>
                      <span className="font-semibold text-rose-700 text-right">{emergencyContact}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Residential Address:</span>
                      <span className="font-semibold text-slate-700 text-right text-[11px] max-w-[200px]">
                        {address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD 3: EMPLOYMENT DETAILS */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <IdentificationBadge size={16} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Employment Details
                    </h4>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Department / Agency:</span>
                      <span className="font-semibold text-slate-800 text-right">{department}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Designated Shift:</span>
                      <span className="font-semibold text-slate-800">{shift}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Deployment Date:</span>
                      <span className="font-semibold text-slate-800">{joiningDate}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Reporting Supervisor:</span>
                      <span className="font-semibold text-slate-800 text-right">{supervisor}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Security Clearance:</span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                        <Check size={11} weight="bold" /> Verified &amp; Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 14.1 CARD 4: ACCESS AND PERMISSIONS SUMMARY */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Access &amp; Permissions Summary
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Role: <span className="text-[#0a2342] font-black">Security Guard</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Assigned Gates / Locations */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <span className="font-extrabold text-slate-900 block flex items-center gap-1">
                      <Door size={14} className="text-amber-600" />
                      Assigned Posts / Gates
                    </span>
                    {assignedLocationNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assignedLocationNames.map((locName, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 text-[11px] font-bold"
                          >
                            {locName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic text-[11px]">
                        Default campus perimeter coverage
                      </p>
                    )}
                  </div>

                  {/* Allowed Operations */}
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                    <span className="font-extrabold text-emerald-950 block flex items-center gap-1">
                      <CheckCircle size={14} className="text-emerald-600" />
                      Allowed Operations
                    </span>
                    <ul className="space-y-1 text-[11px] text-emerald-900">
                      <li className="flex items-center gap-1.5">
                        <Check size={11} weight="bold" className="text-emerald-600" />
                        Gate entry &amp; exit scan evaluation
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check size={11} weight="bold" className="text-emerald-600" />
                        Visitor day pass creation
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check size={11} weight="bold" className="text-emerald-600" />
                        Vehicle verification &amp; delivery logging
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check size={11} weight="bold" className="text-emerald-600" />
                        Emergency barrier override &amp; alert trigger
                      </li>
                    </ul>
                  </div>

                  {/* Restricted Operations */}
                  <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
                    <span className="font-extrabold text-rose-950 block flex items-center gap-1">
                      <ShieldWarning size={14} className="text-rose-600" />
                      Restricted Operations
                    </span>
                    <ul className="space-y-1 text-[11px] text-rose-900">
                      <li className="flex items-center gap-1.5">
                        <X size={11} weight="bold" className="text-rose-500" />
                        Student leave approval (Wardens only)
                      </li>
                      <li className="flex items-center gap-1.5">
                        <X size={11} weight="bold" className="text-rose-500" />
                        System-wide IAM configuration (Admin only)
                      </li>
                      <li className="flex items-center gap-1.5">
                        <X size={11} weight="bold" className="text-rose-500" />
                        Academic &amp; department grade modifications
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 14.1 TWO-COLUMN: ATTENDANCE & BIOMETRIC STATUS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* CARD 5: ATTENDANCE & DUTY ACTIVITY */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#0a2342]" weight="bold" />
                      <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                        Attendance &amp; Duty Activity
                      </h4>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        isOnDuty
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {isOnDuty ? "● ON DUTY" : "○ OFF DUTY"}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Current Shift Status:</span>
                      <span className="font-extrabold text-slate-800">
                        {isOnDuty ? "Active On Post" : "Standby / Shift Concluded"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Recorded Event:</span>
                      <span className="font-mono text-slate-700">
                        {lastEvent?.event_time
                          ? new Date(lastEvent.event_time).toLocaleString()
                          : "No recent gate events"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                      Duty Post Activity History
                    </span>
                    {dutyEvents.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        No recent gate logs logged for this guard identifier.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {dutyEvents.slice(0, 4).map((evt, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]"
                          >
                            <span className="font-semibold text-slate-800 truncate">
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
                </div>

                {/* CARD 6: SECURITY & BIOMETRIC STATUS */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <UserCheck size={16} className="text-[#0a2342]" weight="bold" />
                    <h4 className="text-xs font-extrabold text-[#0a2342] uppercase tracking-wider">
                      Security &amp; Biometric Status
                    </h4>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Face Recognition */}
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
                          <Camera size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Face Biometric Template</p>
                          <p className="text-[11px] text-slate-500">Live gate facial recognition</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          hasFace
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {hasFace ? <CheckCircle size={11} /> : <WarningCircle size={11} />}
                        {hasFace ? "Registered" : "Pending Capture"}
                      </span>
                    </div>

                    {/* RFID Card */}
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                          <CreditCard size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Physical RFID Badge</p>
                          <p className="text-[11px] text-slate-500">
                            {rfidUid ? `UID: ${rfidUid}` : "No card mapped"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          activeRfid
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {activeRfid ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        {activeRfid ? "Card Armed" : "Unmapped"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-500 border border-slate-100">
                      Officer credentials verified for physical barrier control and manual gate verification logs.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-mono">
            Dev Sanskriti Vishwavidyalaya · Security Command Console
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0a2342] text-white hover:bg-[#12365f] text-xs font-bold transition shadow-xs"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuardDetailModal;
