import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  CreditCard,
  Envelope,
  MagnifyingGlass,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  SpinnerGap,
  User,
  UserCheck,
  UserCircle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import api from "@/services/api";
import GuardDetailModal from "./GuardDetailModal";

export const SecurityGuardRoster = () => {
  const [guards, setGuards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedGuardId, setSelectedGuardId] = useState(null);
  const [error, setError] = useState("");

  const fetchGuards = async () => {
    setLoading(true);
    setError("");
    try {
      // Query users with SECURITY_GUARD role
      const res = await api.get("/users?role=SECURITY_GUARD&limit=100");
      const list = res.data?.data?.users || [];
      setGuards(list);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to load security personnel roster.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuards();
  }, []);

  const filteredGuards = guards.filter((g) => {
    const q = search.toLowerCase();
    const name = (g.profile?.full_name || g.full_name || "").toLowerCase();
    const email = (g.email || "").toLowerCase();
    const empId = (
      g.profile?.employee_id ||
      g.employee_id ||
      ""
    ).toLowerCase();
    const matchSearch =
      !q || name.includes(q) || email.includes(q) || empId.includes(q);

    const matchStatus =
      statusFilter === "all" ||
      g.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#0a2342]" />
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Security Personnel &amp; Guard Roster
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
              {guards.length} On Duty
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official roster of active gate officers, perimeter guards, and turnstile supervisors across campus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlass
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by name, email, badge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342] bg-slate-50/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            onClick={fetchGuards}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition"
          >
            Refresh Roster
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 shadow-2xs">
          <WarningCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Guard Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
          <SpinnerGap size={24} className="animate-spin text-amber-500" />
          <span>Loading security personnel details...</span>
        </div>
      ) : filteredGuards.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-300">
          <ShieldWarning size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-slate-600">No security guards found matching criteria.</p>
          <p className="text-[11px] text-slate-400 mt-1">
            To register security guards, assign the SECURITY_GUARD role in Access Management or Onboard Identity.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGuards.map((g) => {
            const fullName = g.profile?.full_name || g.full_name || "Security Officer";
            const empId = g.profile?.employee_id || g.employee_id || "SG-" + g.id.slice(0, 6).toUpperCase();
            const jobType = g.profile?.job_type || g.profile?.designation || "Gate & Perimeter Security";
            const shift = g.profile?.shift || "Standard Duty Shift";
            const workArea = g.profile?.work_area || g.profile?.assigned_location || "Campus Perimeter";
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
                        <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                          {fullName}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Badge: {empId}
                        </p>
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

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500">Role Designation:</span>
                      <span className="font-semibold text-slate-800">{jobType}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500">Assigned Post:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <MapPin size={11} className="text-amber-600" /> {workArea}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500">Active Shift:</span>
                      <span className="font-semibold text-slate-800">{shift}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500">
                    {g.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Envelope size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{g.email}</span>
                      </div>
                    )}
                    {g.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span>{g.phone}</span>
                      </div>
                    )}
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
                      Face Biometric {g.has_face_auth ? "Ready" : "Pending"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGuardId(g.id)}
                    className="w-full py-2 px-3 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck size={14} /> View Details &amp; Location Grants
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Guard Dossier & Access Modal */}
      {selectedGuardId && (
        <GuardDetailModal
          guardId={selectedGuardId}
          onClose={() => setSelectedGuardId(null)}
          onGuardUpdated={fetchGuards}
        />
      )}
    </div>
  );
};

export default SecurityGuardRoster;
