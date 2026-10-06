import React, { useState, useEffect, useMemo } from "react";
import {
  Buildings,
  Check,
  CheckCircle,
  Clock,
  Door,
  GraduationCap,
  House,
  MagnifyingGlass,
  MapPin,
  Shield,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
  X,
  XCircle,
  IdentificationCard,
  Sparkle,
} from "@phosphor-icons/react";
import accessService from "@/services/accessService";

// Helper to categorize a location into one of the 4 defined categories
export const categorizeLocation = (loc) => {
  const type = (loc.type || "").toLowerCase();
  const name = (loc.name || "").toLowerCase();

  if (
    type === "gate" ||
    type === "checkpoint" ||
    type === "turnstile" ||
    type === "security" ||
    type === "control_room" ||
    name.includes("gate") ||
    name.includes("barrier") ||
    name.includes("entry") ||
    name.includes("exit")
  ) {
    return "GATES";
  }

  if (
    type === "hostel" ||
    type === "residential" ||
    name.includes("hostel") ||
    name.includes("bhawan") ||
    name.includes("residence")
  ) {
    return "HOSTELS";
  }

  if (
    type === "academic" ||
    type === "department" ||
    type === "lab" ||
    type === "library" ||
    type === "classroom" ||
    name.includes("academic") ||
    name.includes("department") ||
    name.includes("lab") ||
    name.includes("library") ||
    name.includes("research") ||
    name.includes("school")
  ) {
    return "ACADEMIC";
  }

  return "ADMINISTRATION";
};

const CATEGORY_META = {
  GATES: {
    title: "Gates & Checkpoints",
    description: "Perimeter access points, vehicle barriers, and turnstiles",
    icon: Door,
    requiredRole: "GUARD",
    roleLabel: "Guard / Security role",
    accent: "border-amber-200 bg-amber-50/50 text-amber-800",
  },
  HOSTELS: {
    title: "Hostels & Residential",
    description: "Student residential halls, quarters, and hostel gates",
    icon: House,
    requiredRole: "WARDEN",
    roleLabel: "Warden / Hostel role",
    accent: "border-blue-200 bg-blue-50/50 text-blue-800",
  },
  ACADEMIC: {
    title: "Academic & Research",
    description: "Lecture halls, research laboratories, and central libraries",
    icon: GraduationCap,
    requiredRole: null,
    roleLabel: null,
    accent: "border-emerald-200 bg-emerald-50/50 text-emerald-800",
  },
  ADMINISTRATION: {
    title: "Administration & Facilities",
    description: "Administrative offices, server rooms, and campus amenities",
    icon: Buildings,
    requiredRole: null,
    roleLabel: null,
    accent: "border-slate-200 bg-slate-50/50 text-slate-800",
  },
};

export const AssignAccessModal = ({
  isOpen,
  onClose,
  user,
  locations = [],
  onSuccess,
}) => {
  const [availableLocations, setAvailableLocations] = useState(locations || []);
  const [selectedLocationIds, setSelectedLocationIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingLocs, setLoadingLocs] = useState(false);

  // Initialize selected location IDs from user's current active grants
  useEffect(() => {
    if (!isOpen || !user) return;
    setError("");
    setSearchQuery("");

    const activeGrantIds = new Set();
    if (user.location_grants && Array.isArray(user.location_grants)) {
      user.location_grants.forEach((g) => {
        if (g.status === "active") {
          activeGrantIds.add(g.location_id);
        }
      });
    }
    setSelectedLocationIds(activeGrantIds);

    // Fetch fresh locations list if empty
    if (!locations || locations.length === 0) {
      setLoadingLocs(true);
      accessService
        .getLocations()
        .then((data) => setAvailableLocations(data || []))
        .catch(() => {})
        .finally(() => setLoadingLocs(false));
    } else {
      setAvailableLocations(locations);
    }
  }, [isOpen, user, locations]);

  // Operational roles of the user for compatibility validation
  const userRoles = useMemo(() => {
    if (!user) return new Set();
    const rawRoles = user.roles || [];
    return new Set(rawRoles.map((r) => String(r).toUpperCase()));
  }, [user]);

  const hasGuardRole = useMemo(() => {
    return ["GUARD", "SECURITY_GUARD", "SECURITY_SUPERVISOR", "GATE_OPERATOR", "ADMIN", "SUPER_ADMIN"].some(
      (r) => userRoles.has(r),
    );
  }, [userRoles]);

  const hasWardenRole = useMemo(() => {
    return ["WARDEN", "HOSTEL_OPERATOR", "ADMIN", "SUPER_ADMIN"].some((r) =>
      userRoles.has(r),
    );
  }, [userRoles]);

  const userPersona = (user?.user_type || "").toLowerCase();
  const isGuardPersona = useMemo(() => {
    return (
      userPersona === "guard" ||
      ["GUARD", "SECURITY_GUARD", "SECURITY_ADMIN", "SECURITY_SUPERVISOR", "GATE_OPERATOR"].some((r) =>
        userRoles.has(r)
      )
    );
  }, [userPersona, userRoles]);

  const isStudentPersona = useMemo(() => {
    return userPersona === "student" || userRoles.has("STUDENT");
  }, [userPersona, userRoles]);

  const isFacultyPersona = useMemo(() => {
    return userPersona === "faculty" || userRoles.has("FACULTY");
  }, [userPersona, userRoles]);

  const isVisitorPersona = useMemo(() => {
    return userPersona === "visitor" || userRoles.has("VISITOR");
  }, [userPersona, userRoles]);

  // Group locations by category with search filter
  const groupedLocations = useMemo(() => {
    const groups = {
      GATES: [],
      HOSTELS: [],
      ACADEMIC: [],
      ADMINISTRATION: [],
    };

    const q = searchQuery.toLowerCase().trim();
    availableLocations.forEach((loc) => {
      if (q && !loc.name.toLowerCase().includes(q) && !(loc.type || "").toLowerCase().includes(q)) {
        return;
      }
      const category = categorizeLocation(loc);
      if (groups[category]) {
        groups[category].push(loc);
      } else {
        groups.ADMINISTRATION.push(loc);
      }
    });

    // Sort alphabetically within each category
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [availableLocations, searchQuery]);

  if (!isOpen || !user) return null;

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

  const handleSelectAllGroup = (groupKey) => {
    const locs = groupedLocations[groupKey] || [];
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      locs.forEach((l) => next.add(l.id));
      return next;
    });
  };

  const handleClearAllGroup = (groupKey) => {
    const locs = groupedLocations[groupKey] || [];
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      locs.forEach((l) => next.delete(l.id));
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const idsArray = Array.from(selectedLocationIds);
      await accessService.syncUserLocations(
        user.id,
        idsArray,
        "ENTRY",
        "Assigned via Access Management location checkbox UI",
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.detail?.message ||
          err.message ||
          "Failed to update location access.",
      );
    } finally {
      setSaving(false);
    }
  };

  const totalAssigned = selectedLocationIds.size;
  const totalAvailable = availableLocations.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2342]/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2342] text-[#f5bd19] flex items-center justify-center shadow-xs">
              <MapPin size={22} weight="fill" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0a2342]">
                Assign Location Access
              </h2>
              <p className="text-xs text-slate-500">
                Configure operational locations for{" "}
                <span className="font-bold text-slate-800">
                  {user.full_name || user.email}
                </span>{" "}
                (Checked = Access Granted)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Selection Summary Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Filter locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a2342]/20 focus:border-[#0a2342] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Selected Locations:</span>
            <span className="font-extrabold px-2.5 py-0.5 rounded-full bg-[#0a2342] text-white text-[11px]">
              {totalAssigned} / {totalAvailable}
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <WarningCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Checkbox Categories or Persona Policy */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isGuardPersona ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0">
                  <ShieldCheck size={24} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-950">
                    Guard Duty Posts Managed by Security Admin
                  </h3>
                  <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                    Gate deployments, security post assignments, and shift rosters for guards are handled in the <strong className="font-bold">Security Command Center</strong> (<span className="font-mono text-blue-900">/security-admin</span>). Manual location assignments in Access Management are disabled for guard personnel.
                  </p>
                </div>
              </div>
            </div>
          ) : isStudentPersona ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0">
                  <Buildings size={24} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-indigo-950">
                    Hostel Gender Isolation & Open Campus Access Policy
                  </h3>
                  <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                    Student location permissions are enforced automatically based on university campus rules:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 space-y-1">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                    <XCircle size={16} weight="fill" className="text-rose-600 shrink-0" />
                    <span>Strict Hostel Gender Isolation</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    • <strong className="font-semibold">Male Students:</strong> Prohibited from Girls Hostels (Shanghmitra, Nivedita).<br />
                    • <strong className="font-semibold">Female Students:</strong> Prohibited from Boys Hostels (Arvind, Paninni).
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <CheckCircle size={16} weight="fill" className="text-emerald-600 shrink-0" />
                    <span>Unrestricted Campus Facilities</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Automated access to all Academic Blocks, Central Library, Research Laboratories, Sports Arena, and Food Courts.
                  </p>
                </div>
              </div>
            </div>
          ) : isFacultyPersona ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                  <Sparkle size={24} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Faculty Universal Campus-Wide Access
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Faculty members possess universal campus-wide authorization across all academic buildings, seminar halls, labs, faculty lounges, and campus gates. Manual location grants are not required and are disabled.
                  </p>
                </div>
              </div>
            </div>
          ) : isVisitorPersona ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-600 text-white shrink-0">
                  <IdentificationCard size={24} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Visitor Access Governed by Gate Desk
                  </h3>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Visitor access is managed dynamically at gates via Guard Console passes (Temporary 5:00 AM – 5:00 PM IST or Special Function ID cards). Manual location grants are disabled.
                  </p>
                </div>
              </div>
            </div>
          ) : loadingLocs ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <SpinnerGap size={24} className="animate-spin text-[#0a2342]" />
              <p className="text-xs">Loading campus locations...</p>
            </div>
          ) : (
            Object.entries(groupedLocations).map(([categoryKey, locs]) => {
              if (locs.length === 0) return null;
              const meta = CATEGORY_META[categoryKey];
              const IconComp = meta.icon;

              const isRoleMissing =
                (categoryKey === "GATES" && !hasGuardRole) ||
                (categoryKey === "HOSTELS" && !hasWardenRole);

              const selectedInGroup = locs.filter((l) =>
                selectedLocationIds.has(l.id),
              ).length;

              return (
                <div
                  key={categoryKey}
                  className="rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs"
                >
                  {/* Category Header */}
                  <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white shadow-xs text-[#0a2342] border border-slate-200">
                        <IconComp size={16} weight="bold" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900">
                            {meta.title}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-extrabold text-slate-700">
                            {selectedInGroup} of {locs.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {meta.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectAllGroup(categoryKey)}
                        className="text-[11px] font-bold text-[#0a2342] hover:underline px-2 py-1 rounded-md hover:bg-white"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleClearAllGroup(categoryKey)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline px-2 py-1 rounded-md hover:bg-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Role warning banner if user lacks operational role */}
                  {isRoleMissing && (
                    <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-200/60 flex items-center gap-2 text-[11px] text-amber-800">
                      <WarningCircle size={14} className="text-amber-600 shrink-0" />
                      <span>
                        Note: User does not currently hold the{" "}
                        <strong>{meta.roleLabel}</strong>. Granting access will
                        authorize this location, but operational duties require
                        the matching role.
                      </span>
                    </div>
                  )}

                  {/* Location Checkbox Grid */}
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {locs.map((loc) => {
                      const isChecked = selectedLocationIds.has(loc.id);
                      return (
                        <label
                          key={loc.id}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                            isChecked
                              ? "bg-emerald-50/40 border-emerald-300 shadow-xs"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleLocation(loc.id)}
                              className="w-4 h-4 rounded-sm border-slate-300 text-[#0a2342] focus:ring-[#0a2342] cursor-pointer"
                            />
                            <div className="truncate">
                              <p
                                className={`font-semibold truncate ${
                                  isChecked ? "text-emerald-950 font-bold" : "text-slate-800"
                                }`}
                              >
                                {loc.name}
                              </p>
                              <span className="text-[10px] text-slate-400 capitalize">
                                {loc.type || "Zone"}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 ml-2">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
                                <Check size={10} weight="bold" /> Granted
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200">
                                Denied
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Passwords are <span className="font-semibold text-slate-700">never</span> reset by changing location access.
          </div>
          <div className="flex items-center gap-2.5">
            {isGuardPersona || isStudentPersona || isFacultyPersona || isVisitorPersona ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-[#0a2342] text-white text-xs font-bold hover:bg-[#12365f] transition"
              >
                Close Policy View
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white text-xs font-bold transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#0a2342] hover:bg-[#12365f] text-white text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <SpinnerGap size={14} className="animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={15} weight="bold" className="text-[#f5bd19]" />
                      Save Changes ({totalAssigned} Locations)
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignAccessModal;
