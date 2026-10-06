import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Buildings,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  Copy,
  Door,
  Eye,
  EyeSlash,
  GraduationCap,
  House,
  Key,
  Lock,
  MagnifyingGlass,
  MapPin,
  Medal,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  SpinnerGap,
  Stack,
  TrashSimple,
  User,
  UserCheck,
  Warning,
  WarningCircle,
  X,
  XCircle,
  IdentificationCard,
} from "@phosphor-icons/react";
import accessService from "@/services/accessService";
import userService from "@/services/userService";
import { useToast } from "@/context/ToastContext";
import { categorizeLocation } from "./AssignAccessModal";

// ── Operational Roles Definitions & Responsibilities ─────────────────────────
export const OPERATIONAL_ROLES_CONFIG = [
  {
    id: "SECURITY_ADMIN",
    aliases: ["SECURITY_ADMIN"],
    title: "Security Admin",
    description: "Security Command Center: supervise guard roster, security conditions, curfew enforcement, campus perimeter lockdown, and gate incident alarms.",
    capabilities: [
      "Security Command Center access",
      "Deploy guard duty posts & shifts",
      "Curfew and emergency lockdown controls",
      "Turnstile incident & security alarm review",
      "Full Guard Console & gate cameras",
    ],
    category: "Security Command",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    id: "GUARD",
    aliases: ["GUARD", "SECURITY_GUARD"],
    title: "Security Guard",
    description: "Gate monitoring, visitor pass verification, vehicle logging, turnstile review, and emergency alarms.",
    capabilities: [
      "Gate entry & exit review",
      "Visitor pass creation & verification",
      "Vehicle movement logging",
      "Emergency gate alarm triggering",
    ],
    category: "Security",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "WARDEN",
    aliases: ["WARDEN"],
    title: "Hostel Warden",
    description: "Hostel resident administration, student leave approval, curfew tracking, and room inspections.",
    capabilities: [
      "Hostel resident administration",
      "Student leave pass approval & rejection",
      "Hostel curfew monitoring & violation alerts",
      "Hostel disciplinary action logs",
    ],
    category: "Hostel",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "SECURITY_SUPERVISOR",
    aliases: ["SECURITY_SUPERVISOR"],
    title: "Security Supervisor",
    description: "Campus security roster dispatch, incident escalation, perimeter oversight, and guard supervision.",
    capabilities: [
      "Security roster management & dispatch",
      "Incident report escalation",
      "Gate operations supervisor review",
      "Perimeter patrol logging",
    ],
    category: "Security",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "HOSTEL_OPERATOR",
    aliases: ["HOSTEL_OPERATOR"],
    title: "Hostel Operator",
    description: "Hostel check-in/check-out logs, maintenance requests, visitor guest logs, and occupancy tracking.",
    capabilities: [
      "Resident check-in & check-out logs",
      "Hostel room maintenance requests",
      "Guest and visitor hostel logs",
      "Hostel facility inspections",
    ],
    category: "Hostel",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  {
    id: "GATE_OPERATOR",
    aliases: ["GATE_OPERATOR"],
    title: "Gate Operator",
    description: "Automated barrier gate management, delivery vehicle registration, and turnstile badge scanning.",
    capabilities: [
      "Barrier gate automation controls",
      "Delivery & service vehicle registration",
      "Turnstile visitor badge scanning",
    ],
    category: "Security",
    color: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    id: "FACULTY",
    aliases: ["FACULTY"],
    title: "Academic Faculty",
    description: "Teaching staff, department lab access, academic block privileges, and student review.",
    capabilities: [
      "Academic block & classroom access",
      "Department research lab entry",
      "Faculty lounge access",
    ],
    category: "Academic",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "STUDENT",
    aliases: ["STUDENT"],
    title: "Student",
    description: "Student identity, assigned residential hostel entry, campus common zones, and leave pass requests.",
    capabilities: [
      "Assigned hostel resident access",
      "Campus common & library access",
      "Leave pass submission",
    ],
    category: "Student",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "STAFF",
    aliases: ["STAFF"],
    title: "Campus Staff",
    description: "Administrative staff members, office facilities, and campus operations.",
    capabilities: [
      "Administrative building access",
      "Department office access",
      "Campus utility zones",
    ],
    category: "Operations",
    color: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    id: "WORKER",
    aliases: ["WORKER"],
    title: "Operations Worker",
    description: "Campus maintenance, service zones, facility support, and utility equipment rooms.",
    capabilities: [
      "Campus maintenance areas",
      "Facility equipment rooms",
      "Service entrance gates",
    ],
    category: "Operations",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    id: "VISITOR",
    aliases: ["VISITOR"],
    title: "Campus Visitor",
    description: "Temporary external guest, time-limited campus access, public zones only.",
    capabilities: [
      "Public campus zones only",
      "Time-restricted entry pass",
    ],
    category: "Visitor",
    color: "bg-slate-50 text-slate-700 border-slate-200",
  },
];

const CATEGORY_META = {
  GATES: {
    title: "Gates & Checkpoints",
    description: "Perimeter entry/exit points, vehicle barriers, and turnstiles",
    icon: Door,
    requiredRoleDesc: "Requires Guard or Security role",
  },
  HOSTELS: {
    title: "Hostels & Residential",
    description: "Student residential halls and hostel premises",
    icon: House,
    requiredRoleDesc: "Requires Warden or Hostel Operator role",
  },
};

export const UserAccessDetail = ({ userId, onClose, onUserUpdated }) => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("access_control"); // 'access_control' | 'audit_history' | 'security_credentials'
  const [detail, setDetail] = useState(null);
  const [effectivePerms, setEffectivePerms] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [hostelsList, setHostelsList] = useState([]);
  const [locationsList, setLocationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Access Control Form State
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedHostels, setSelectedHostels] = useState([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState(new Set());
  const [locationSearch, setLocationSearch] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Password Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [customPasswordInput, setCustomPasswordInput] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId]);

  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [userDetail, userAccess, perms, logs, hostels, flatLocs] =
        await Promise.all([
          accessService.getAccessUserDetail(userId),
          accessService
            .getUserAccess(userId)
            .catch(() => ({ roles: [], hostels: [] })),
          accessService.getUserEffectivePermissions(userId).catch(() => []),
          accessService
            .getAccessAuditLogs({ user_id: userId, page: 1, page_size: 25 })
            .catch(() => ({ logs: [] })),
          userService.getHostels().catch(() => []),
          accessService.getLocations().catch(() => []),
        ]);

      setDetail(userDetail);
      setEffectivePerms(perms || []);
      setAuditLogs(logs.logs || []);
      setHostelsList(hostels || []);
      setLocationsList(flatLocs || []);

      // Normalize current roles - enforce strictly single role
      const currentRoles = (userAccess.roles || userDetail.roles || []).map((r) =>
        String(r).toUpperCase(),
      );
      setSelectedRoles(currentRoles.slice(0, 1));

      // Normalize current hostel IDs
      setSelectedHostels(
        (userAccess.hostels || []).map((h) =>
          typeof h === "string" ? h : h.id,
        ),
      );

      // Normalize current active location grant IDs
      const activeLocIds = new Set();
      if (userDetail.location_grants && Array.isArray(userDetail.location_grants)) {
        userDetail.location_grants.forEach((g) => {
          if (g.status === "active") {
            activeLocIds.add(g.location_id);
          }
        });
      }
      setSelectedLocationIds(activeLocIds);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to load user access details.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Operational Role Check Helpers
  const roleSet = useMemo(() => new Set(selectedRoles), [selectedRoles]);

  const hasGuardRole = useMemo(() => {
    return ["GUARD", "SECURITY_GUARD", "SECURITY_SUPERVISOR", "GATE_OPERATOR", "ADMIN", "SUPER_ADMIN"].some(
      (r) => roleSet.has(r),
    );
  }, [roleSet]);

  const hasWardenRole = useMemo(() => {
    return ["WARDEN", "HOSTEL_OPERATOR", "ADMIN", "SUPER_ADMIN"].some((r) =>
      roleSet.has(r),
    );
  }, [roleSet]);

  const userPersona = (detail?.user_type || "").toLowerCase();
  const isGuardPersona = useMemo(() => {
    return (
      userPersona === "guard" ||
      ["GUARD", "SECURITY_GUARD", "SECURITY_ADMIN", "SECURITY_SUPERVISOR", "GATE_OPERATOR"].some((r) =>
        selectedRoles.includes(r)
      )
    );
  }, [userPersona, selectedRoles]);

  const isStudentPersona = useMemo(() => {
    return userPersona === "student" || selectedRoles.includes("STUDENT");
  }, [userPersona, selectedRoles]);

  const isFacultyPersona = useMemo(() => {
    return userPersona === "faculty" || selectedRoles.includes("FACULTY");
  }, [userPersona, selectedRoles]);

  const isVisitorPersona = useMemo(() => {
    return userPersona === "visitor" || selectedRoles.includes("VISITOR");
  }, [userPersona, selectedRoles]);

  // Single Operational Role Change
  const handleSingleRoleChange = (roleId) => {
    const newRoles = roleId ? [roleId] : [];
    setSelectedRoles(newRoles);

    const newRoleSet = new Set(newRoles);
    const stillHasGuard = ["GUARD", "SECURITY_GUARD", "SECURITY_SUPERVISOR", "GATE_OPERATOR", "ADMIN", "SUPER_ADMIN"].some(
      (r) => newRoleSet.has(r),
    );
    const stillHasWarden = ["WARDEN", "HOSTEL_OPERATOR", "ADMIN", "SUPER_ADMIN"].some((r) =>
      newRoleSet.has(r),
    );

    // If Guard role is removed, automatically remove dependent gate location grants
    if (hasGuardRole && !stillHasGuard) {
      setSelectedLocationIds((prev) => {
        const next = new Set(prev);
        locationsList.forEach((loc) => {
          if (categorizeLocation(loc) === "GATES") {
            next.delete(loc.id);
          }
        });
        return next;
      });
      toast.info("Guard role removed. Associated gate location access unselected.");
    }

    // If Warden role is removed, automatically remove dependent hostel location grants
    if (hasWardenRole && !stillHasWarden) {
      setSelectedLocationIds((prev) => {
        const next = new Set(prev);
        locationsList.forEach((loc) => {
          if (categorizeLocation(loc) === "HOSTELS") {
            next.delete(loc.id);
          }
        });
        return next;
      });
      setSelectedHostels([]);
      toast.info("Warden role removed. Associated hostel access unselected.");
    }
  };

  const toggleLocation = (locId) => {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) {
        next.delete(locId);
      } else {
        next.add(locId);
      }
      return next;
    });
  };

  const handleSelectAllGroup = (groupKey, locs) => {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      locs.forEach((l) => next.add(l.id));
      return next;
    });
  };

  const handleClearAllGroup = (groupKey, locs) => {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      locs.forEach((l) => next.delete(l.id));
      return next;
    });
  };

  // Group locations: strictly only GATES and HOSTELS
  const groupedLocations = useMemo(() => {
    const groups = {
      GATES: [],
      HOSTELS: [],
    };

    const q = locationSearch.toLowerCase().trim();
    locationsList.forEach((loc) => {
      if (q && !loc.name.toLowerCase().includes(q) && !(loc.type || "").toLowerCase().includes(q)) {
        return;
      }
      const cat = categorizeLocation(loc);
      if (cat === "GATES" || cat === "HOSTELS") {
        groups[cat].push(loc);
      }
    });

    Object.keys(groups).forEach((k) => {
      groups[k].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [locationsList, locationSearch]);

  // Save changes without touching passwords (Requirements 13.4 & 13.5)
  const handleSaveAccessChanges = async () => {
    setSavingChanges(true);
    setFeedbackMessage("");
    try {
      // 1. Update roles in Keycloak & local database
      await accessService.updateUserAccess(userId, {
        roles: selectedRoles,
        hostel_ids: selectedRoles.some((role) => ["WARDEN", "HOSTEL_OPERATOR"].includes(role))
          ? selectedHostels
          : [],
        location_ids: Array.from(selectedLocationIds),
        issue_password: false, // Strictly decoupled!
      });

      // 2. Synchronize location grants atomically
      await accessService.syncUserLocations(
        userId,
        Array.from(selectedLocationIds),
        "ENTRY",
        "Assigned via Access Control configuration center",
      );

      toast.success(
        "Access control configuration updated successfully! Password remains unchanged.",
      );
      setFeedbackMessage(
        "Roles and location grants successfully synchronized. Password was not modified.",
      );
      await loadAllData();
      if (onUserUpdated) onUserUpdated();
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
          err.response?.data?.detail?.message ||
          err.message ||
          "Failed to save access changes.";
      toast.error(msg);
      setFeedbackMessage(`Error: ${msg}`);
    } finally {
      setSavingChanges(false);
    }
  };

  // Explicit Password Reset (Requirement 13.4)
  const handleExecuteResetPassword = async () => {
    setResettingPassword(true);
    try {
      const res = await accessService.issueUserCredentials(
        userId,
        customPasswordInput.trim() || null,
      );
      setIssuedCredentials(res);
      toast.success(`Password reset successfully for ${res.email}!`);
      setCustomPasswordInput("");
      await loadAllData();
      if (onUserUpdated) onUserUpdated();
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to reset user password.",
      );
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2500);
  };

  // Derive Effective Capabilities for Section 13.7
  const derivedCapabilities = useMemo(() => {
    const list = [];
    selectedRoles.forEach((role) => {
      const cfg = OPERATIONAL_ROLES_CONFIG.find((c) =>
        c.aliases.includes(role),
      );
      if (cfg && cfg.capabilities) {
        cfg.capabilities.forEach((cap) => {
          if (!list.includes(cap)) list.push(cap);
        });
      }
    });
    return list;
  }, [selectedRoles]);

  const assignedLocationNames = useMemo(() => {
    return locationsList
      .filter((l) => selectedLocationIds.has(l.id))
      .map((l) => l.name);
  }, [locationsList, selectedLocationIds]);

  const derivedRestrictions = useMemo(() => {
    const restrictions = [];
    if (isStudentPersona) {
      restrictions.push("Cross-gender hostel entry strictly prohibited (Boys restricted from Shanghmitra/Nivedita; Girls restricted from Arvind/Paninni)");
    }
    if (!hasWardenRole && !isStudentPersona) {
      restrictions.push("Hostel operations & student leave approvals (Warden role required)");
    }
    if (!hasGuardRole && !isStudentPersona) {
      restrictions.push("Gate barrier automation & live checkpoint review (Guard role required)");
    }
    if (!selectedRoles.includes("ADMIN") && !selectedRoles.includes("SUPER_ADMIN")) {
      restrictions.push("System-wide administrative settings & user role assignments (Admin only)");
    }
    return restrictions;
  }, [hasWardenRole, hasGuardRole, selectedRoles, isStudentPersona]);

  if (loading && !detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <SpinnerGap size={36} className="animate-spin text-[#0a2342]" />
        <p className="text-sm font-bold text-slate-600">
          Loading access control configuration...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/60 overflow-hidden text-slate-800">
      {/* ── HEADER & NAVIGATION BAR ── */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a2342] px-2 py-0.5 rounded-md bg-[#0a2342]/10">
              Access Control
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-mono">
              ID: {detail?.id?.slice(0, 8)}...
            </span>
          </div>
          <h1 className="text-lg font-extrabold text-[#0a2342] mt-0.5">
            {detail?.full_name || detail?.email}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Navigation Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("access_control")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "access_control"
                  ? "bg-[#0a2342] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck size={14} weight="bold" />
              Access Control
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("security_credentials")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "security_credentials"
                  ? "bg-[#0a2342] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Lock size={14} weight="bold" />
              Security &amp; Password
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE WORKSPACE ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5">
            <WarningCircle size={18} className="text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: UNIFIED ACCESS CONTROL
            ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "access_control" && (
          <div className="space-y-6">
            {/* 1. USER INFORMATION CARD (13.6) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {detail?.photo_reference ? (
                    <img
                      src={detail.photo_reference}
                      alt={detail.full_name}
                      className="w-16 h-20 rounded-xl object-cover border-2 border-slate-200 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-20 rounded-xl bg-slate-100 border-2 border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <User size={24} />
                      <span className="text-[9px] uppercase mt-1">Photo</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-slate-900">
                        {detail?.full_name || detail?.email}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                          detail?.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <CheckCircle size={11} />
                        {detail?.status?.toUpperCase() || "ACTIVE"}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {detail?.user_type || "User"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-0.5 font-mono">
                      <p>
                        Email:{" "}
                        <span className="text-slate-800 font-semibold font-sans">
                          {detail?.email}
                        </span>
                      </p>
                      <p>
                        Identifier:{" "}
                        <span className="text-slate-800 font-semibold">
                          {detail?.employee_id || detail?.roll_number || detail?.id}
                        </span>
                      </p>
                    </div>

                    {detail?.department && (
                      <p className="text-xs text-slate-500">
                        Department:{" "}
                        <span className="font-semibold text-slate-700">
                          {detail.department}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end justify-center space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Keycloak SSO:</span>
                    {detail?.keycloak_linked ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Check size={11} weight="bold" /> Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Unlinked
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Roles configure authorization only. Passwords are never altered.
                  </p>
                </div>
              </div>

              {/* Single Operational Role Selector */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-[#0a2342] text-[#f5bd19]">
                    <Shield size={16} weight="fill" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Assigned Operational Role
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Single role governing permissions and campus authorization
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedRoles[0] || ""}
                    onChange={(e) => handleSingleRoleChange(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-black text-[#0a2342] bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a2342]/20 shadow-2xs"
                  >
                    <option value="" disabled>Select Role...</option>
                    {OPERATIONAL_ROLES_CONFIG.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title} ({role.category})
                      </option>
                    ))}
                  </select>

                  {selectedRoles[0] && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#0a2342]/10 text-[#0a2342] border border-[#0a2342]/15 whitespace-nowrap">
                      {OPERATIONAL_ROLES_CONFIG.find((r) => r.id === selectedRoles[0])?.title || selectedRoles[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Warden Assigned Hostels if Warden role is checked */}
              {selectedRoles.some((role) => ["WARDEN", "HOSTEL_OPERATOR"].includes(role)) && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <House size={15} weight="fill" />
                      Hostel Jurisdiction (Required for Hostel Wardens)
                    </span>
                    <span className="text-[11px] font-bold text-amber-800">
                      {selectedHostels.length} Hostels Assigned
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {hostelsList.map((h) => {
                      const hId = h.id;
                      const isAssigned = selectedHostels.includes(hId);
                      return (
                        <label
                          key={hId}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                            isAssigned
                              ? "bg-amber-100/70 border-amber-300 font-bold text-amber-950"
                              : "bg-white border-amber-200/60 text-slate-700 hover:bg-amber-50/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {
                              if (isAssigned) {
                                setSelectedHostels(
                                  selectedHostels.filter((x) => x !== hId),
                                );
                              } else {
                                setSelectedHostels([...selectedHostels, hId]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded-sm border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="truncate">{h.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. LOCATION ACCESS SECTION (Only Gates & Checkpoints and Hostels & Residential) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-[#0a2342] text-[#f5bd19]">
                      <MapPin size={16} weight="fill" />
                    </div>
                    <h3 className="text-sm font-extrabold text-[#0a2342]">
                      Location Grants &amp; Campus Policy
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Select locations where operational permissions apply (Checked = Access Granted, Unchecked = Denied).
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <MagnifyingGlass
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search locations..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a2342]/20 focus:border-[#0a2342]"
                  />
                </div>
              </div>

              {/* Grouped Location Checkbox Sections - Only Gates & Checkpoints and Hostels & Residential */}
              <div className="space-y-4 pt-1">
                {Object.entries(groupedLocations).map(([catKey, locs]) => {
                  if (locs.length === 0) return null;
                  const meta = CATEGORY_META[catKey];
                  if (!meta) return null;
                  const IconComp = meta.icon;

                  const isMissingRole =
                    (catKey === "GATES" && !hasGuardRole) ||
                    (catKey === "HOSTELS" && !hasWardenRole);

                  const countSelected = locs.filter((l) =>
                    selectedLocationIds.has(l.id),
                  ).length;

                  return (
                    <div
                      key={catKey}
                      className="rounded-xl border border-slate-200 overflow-hidden bg-white"
                    >
                      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconComp size={15} className="text-[#0a2342]" weight="bold" />
                          <span className="text-xs font-bold text-slate-900">
                            {meta.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-extrabold text-slate-700">
                            {countSelected} / {locs.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleSelectAllGroup(catKey, locs)}
                            className="font-bold text-[#0a2342] hover:underline px-1.5 py-0.5 rounded hover:bg-white"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => handleClearAllGroup(catKey, locs)}
                            className="font-bold text-slate-500 hover:text-slate-800 hover:underline px-1.5 py-0.5 rounded hover:bg-white"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {isMissingRole && (
                        <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-200/70 text-[11px] text-amber-800 flex items-center gap-2">
                          <WarningCircle size={14} className="text-amber-600 shrink-0" />
                          <span>
                            {meta.requiredRoleDesc}. Granting location access without the operational role restricts active duty controls.
                          </span>
                        </div>
                      )}

                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {locs.map((loc) => {
                          const isChecked = selectedLocationIds.has(loc.id);
                          return (
                            <label
                              key={loc.id}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer select-none transition ${
                                isChecked
                                  ? "bg-emerald-50/40 border-emerald-300 shadow-2xs font-semibold text-emerald-950"
                                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleLocation(loc.id)}
                                  className="w-3.5 h-3.5 rounded-sm border-slate-300 text-[#0a2342] focus:ring-[#0a2342]"
                                />
                                <span className="truncate">{loc.name}</span>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0 ${
                                  isChecked
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {isChecked ? "Granted" : "Denied"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. ACTION BUTTONS & FEEDBACK */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {feedbackMessage ? (
                  <span className="font-bold text-slate-700">{feedbackMessage}</span>
                ) : (
                  <span>
                    Saving applies roles &amp; location grants atomically. Passwords are <strong className="text-slate-700">never</strong> reset.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAccessChanges}
                  disabled={savingChanges}
                  className="px-6 py-2 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                >
                  {savingChanges ? (
                    <>
                      <SpinnerGap size={14} className="animate-spin" />
                      Saving Configuration...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={15} weight="bold" className="text-[#f5bd19]" />
                      Save Access Changes
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 4. DECOUPLED PASSWORD MANAGEMENT SECTION */}
            <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
                    <Key size={20} weight="fill" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Authentication &amp; Password Security
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Password management is strictly decoupled from access control. Passwords can only be reset manually.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs transition flex items-center gap-1.5"
                >
                  <Lock size={14} />
                  Reset User Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: SECURITY & CREDENTIALS
            ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "security_credentials" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#0a2342]">
                  Security, Identity &amp; Keycloak SSO
                </h3>
                <p className="text-xs text-slate-500">
                  Manage user authentication credentials and verify single sign-on synchronization.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Keycloak User Link:
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {detail?.keycloak_user_id || "Not Linked"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Authentication Realm:
                  </span>
                  <span className="text-xs font-mono text-slate-800">
                    ococ-realm
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    SSO Status:
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle size={12} /> Active
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Key size={15} />
                  Explicit Password Reset
                </h4>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  To reset this user's password, click the button below. You can either supply a specific custom password or let the system generate a secure temporary password.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#0a2342] text-white hover:bg-[#12365f] text-xs font-bold shadow-2xs transition"
                  >
                    Reset Password Now
                  </button>
                </div>
              </div>

              {issuedCredentials && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
                    <CheckCircle size={16} />
                    New Credentials Generated Successfully!
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-emerald-200">
                      <span className="text-slate-500">Username:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {issuedCredentials.username || detail?.email}
                      </span>
                    </div>
                    {issuedCredentials.password && (
                      <div className="flex items-center justify-between p-2 rounded bg-white border border-emerald-200">
                        <span className="text-slate-500">Password:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {showPassword ? issuedCredentials.password : "••••••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(issuedCredentials.password, "pwd")}
                            className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]"
                          >
                            {copiedKey === "pwd" ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── RESET PASSWORD CONFIRMATION MODAL (13.4) ── */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#0a2342]/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Lock size={20} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Reset User Password
                  </h3>
                  <p className="text-xs text-slate-500">
                    {detail?.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This action will reset the user's Keycloak password. Enter a custom password below, or leave it blank to automatically generate a secure temporary password.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Custom Password (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank for auto-generated password"
                value={customPasswordInput}
                onChange={(e) => setCustomPasswordInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0a2342]/20 focus:border-[#0a2342]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={resettingPassword}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleExecuteResetPassword();
                  setIsResetModalOpen(false);
                }}
                disabled={resettingPassword}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {resettingPassword ? (
                  <>
                    <SpinnerGap size={14} className="animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Confirm Password Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccessDetail;
