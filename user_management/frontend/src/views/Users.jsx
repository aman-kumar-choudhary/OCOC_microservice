import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import userService from "@/services/userService";
import { formatDate } from "@/utils/date";
import {
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CreditCard,
  DotsThreeVertical,
  DownloadSimple,
  Funnel,
  House,
  MagnifyingGlass,
  PencilSimple,
  ShieldCheck,
  ShieldSlash,
  SpinnerGap,
  UploadSimple,
  UserMinus,
  X
} from "@phosphor-icons/react";
import EditUserModal from "@/components/EditUserModal";
import UserStatusModal from "@/components/UserStatusModal";
import Pagination from "@/components/common/Pagination";
const courses = [
  "B.Sc. IT",
  "BCA",
  "M.Sc. Data Science",
  "MCA",
  "BBA Tourism",
  "MBA Tourism",
  "B.A. Mass Comm",
  "M.A. Mass Comm",
  "B.Sc. Animation",
  "M.Sc. Animation",
  "BBA Rural Management",
  "MBA Rural Management",
  "B.Sc. Environmental Science",
  "M.Sc. Environmental Science",
  "B.Ed.",
  "M.Ed.",
  "B.A. Psychology",
  "M.A. Clinical Psychology",
  "B.A. English (Honors)",
  "M.A. English",
  "B.A. Sanskrit (Honors)",
  "M.A. Sanskrit",
  "B.A. Hindi (Honors)",
  "M.A. History and Indian Culture",
  "B.A. History (Honors)",
  "B.A. Music (Vocal) (Honors)",
  "M.A. Music (Vocal)",
  "B.A. Music Instrumental Mridang/Tabla (Honors)",
  "M.A. Music (Tabla, Pakhaawaj)",
  "M.A. Hindu Studies",
  "M.A. Philosophy",
  "B.Sc. Yogic Science (Honors)",
  "M.Sc. Yoga Therapy",
  "M.A. Human Consciousness & Yogic Science",
  "M.Sc. Human Consciousness & Yogic Science",
  "P. G. Diploma Human Consciousness, Yoga & Alternative Therapy",
  "Certificate In Yoga And Alternative Therapy",
];
const semesters = ["1", "2", "3", "4", "5", "6", "7", "8"];

/* ─── Reusable mini-components ─────────────────────────────────────── */

const Sel = ({ value, onChange, children, id, className = "" }) => (
  <select
    id={id}
    value={value}
    onChange={onChange}
    className={`h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-800 transition appearance-auto ${className}`}
  >
    {children}
  </select>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 transition ${className}`}
    {...props}
  />
);

/* ─── Main view ─────────────────────────────────────────────────────── */

export const UsersView = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const importInputRef = useRef(null);

  const [dbDepartments, setDbDepartments] = useState([]);
  const [dbHostels, setDbHostels] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [viewTarget, setViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusAction, setStatusAction] = useState("suspend");
  const [showActionsId, setShowActionsId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    user_type: "",
    status: "",
    school: "",
    department: "",
    course: "",
    semester: "",
    hostel_id: "",
    hostel_status: "",
  });

  /* ── Derived data ── */
  const schools = useMemo(
    () => [...new Set(dbDepartments.map((d) => d.school).filter(Boolean))],
    [dbDepartments],
  );
  const filteredDepartments = useMemo(
    () =>
      dbDepartments.filter(
        (d) => !filters.school || d.school === filters.school,
      ),
    [dbDepartments, filters.school],
  );

  const hostelMap = useMemo(() => {
    const m = {};
    dbHostels.forEach((h) => {
      m[h.id] = h.name;
    });
    return m;
  }, [dbHostels]);

  /* ── Fetching ── */
  const fetchUsers = useCallback(
    async (customPage, customLimit) => {
      setIsLoading(true);
      setApiError("");
      try {
        const currentPage = customPage || page;
        const currentLimit = customLimit || limit;
        const data = await userService.list({
          page: currentPage,
          limit: currentLimit,
          ...filters,
        });
        setUsers(data.users || []);
        setTotal(data.total);
        setTotalPages(data.total_pages);
      } catch (e) {
        console.error(e);
        setApiError(
          e.response?.data?.error?.message ||
            "Failed to load users. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit, filters],
  );

  const isMountedRef = useRef(false);

  // Initial load on mount
  useEffect(() => {
    userService.getDepartments().then(setDbDepartments).catch(console.error);
    userService.getHostels().then(setDbHostels).catch(console.error);
    fetchUsers(1);
  }, []);

  // Debounce search (skip initial mount)
  useEffect(() => {
    if (!isMountedRef.current) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchUsers(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Filter changes (skip initial mount)
  useEffect(() => {
    if (!isMountedRef.current) return;
    fetchUsers(1);
  }, [
    filters.user_type,
    filters.status,
    filters.school,
    filters.department,
    filters.course,
    filters.semester,
    filters.hostel_id,
    filters.hostel_status,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleFilterChange = (updates) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      user_type: "",
      status: "",
      school: "",
      department: "",
      course: "",
      semester: "",
      hostel_id: "",
      hostel_status: "",
    });
    setPage(1);
  };

  const hasActiveFilters =
    filters.search ||
    filters.user_type ||
    filters.status ||
    filters.school ||
    filters.department ||
    filters.course ||
    filters.semester ||
    filters.hostel_id ||
    filters.hostel_status;

  /* ── Helpers ── */
  const getStatusBadge = (s) => {
    if (s === "active")
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    if (s === "suspended")
      return "bg-amber-50 text-amber-800 border border-amber-200";
    return "bg-rose-50 text-rose-700 border border-rose-200";
  };

  const getRoleColor = (type) =>
    ({
      student: "bg-slate-100 text-slate-800 border-slate-200",
      faculty: "bg-indigo-50 text-indigo-700 border-indigo-200",
      worker: "bg-slate-100 text-slate-700 border-slate-200",
      visitor: "bg-amber-50 text-amber-800 border-amber-200",
    })[type] || "bg-slate-50 text-slate-700 border-slate-200";

  const getIdentifier = (u) =>
    u.profile?.roll_number ||
    u.profile?.employee_id ||
    u.profile?.gov_id_number ||
    "—";
  const getUserName = (u) => u.profile?.full_name || "Unnamed User";

  const openAction = (user, action) => {
    setStatusTarget(user);
    setStatusAction(action);
    setShowActionsId(null);
  };

  const getHostelName = (u) => {
    if (!u.profile?.hostel_flag) return null;
    const id = u.profile?.hostel_id;
    return id && hostelMap[id] ? hostelMap[id] : "Hostel";
  };

  /* ── Export / Import ── */
  const exportToCSV = async () => {
    setExportLoading(true);
    try {
      const data = await userService.list({
        page: 1,
        limit: 10000,
        ...filters,
      });
      const rows = data.users || [];
      const headers = [
        "Name",
        "Email",
        "Phone",
        "Type",
        "Identifier",
        "Department",
        "Status",
        "RFID Tag",
        "Joined",
      ];
      const csvContent = [
        headers.join(","),
        ...rows.map((u) =>
          [
            `"${getUserName(u)}"`,
            `"${u.email}"`,
            `"${u.phone || ""}"`,
            u.user_type,
            `"${getIdentifier(u)}"`,
            `"${u.profile?.department || ""}"`,
            u.status,
            u.active_rfid || "",
            formatDate(u.created_at),
          ].join(","),
        ),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `ococ-users-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setExportLoading(false);
    }
  };

  const importFromCSV = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportMessage("");
    setImportError("");
    try {
      const result = await userService.importCsv(file);
      const created = result?.created_rows ?? 0;
      const invalid = result?.invalid_rows ?? 0;
      const failed = result?.failed_rows ?? 0;
      setImportMessage(
        `Import complete: ${created} user${created === 1 ? "" : "s"} added${invalid || failed ? `, ${invalid + failed} row${invalid + failed === 1 ? "" : "s"} skipped` : ""}.`,
      );
      await fetchUsers();
    } catch (e) {
      setImportError(
        e.response?.data?.error?.message ||
          "Failed to import CSV. Please check the file and try again.",
      );
    } finally {
      setImportLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  /* ─────────────────────────── JSX ─────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            User &amp; Identity Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {!isLoading
              ? `${total.toLocaleString()} registered campus identities`
              : "Loading directory…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={importFromCSV}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importLoading}
            id="import-csv-btn"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            {importLoading ? (
              <SpinnerGap className="animate-spin" size={14} />
            ) : (
              <UploadSimple size={14} />
            )}
            Import CSV
          </button>
          <button
            onClick={exportToCSV}
            disabled={exportLoading}
            id="export-csv-btn"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 transition disabled:opacity-50 shadow-2xs"
          >
            {exportLoading ? (
              <SpinnerGap className="animate-spin" size={14} />
            ) : (
              <DownloadSimple size={14} />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {importMessage && (
        <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2">
          {importMessage}
        </p>
      )}
      {importError && (
        <p className="text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2">
          {importError}
        </p>
      )}

      {/* ── Filter Panel ── */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs">
        {/* Row 1 — Always visible */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <Input
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              type="text"
              placeholder="Search by name, email, roll number…"
              className="w-full pl-8 pr-8"
              id="user-search-input"
            />
            {filters.search && (
              <button
                onClick={() => setFilters({ ...filters, search: "" })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Type */}
          <Sel
            id="user-type-filter"
            value={filters.user_type}
            onChange={(e) =>
              handleFilterChange({
                user_type: e.target.value,
                school: "",
                department: "",
                course: "",
                semester: "",
                hostel_id: "",
                hostel_status: "",
              })
            }
            className="w-32"
          >
            <option value="">All Types</option>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="worker">Worker</option>
            <option value="visitor">Visitor</option>
          </Sel>

          {/* Status */}
          <Sel
            id="status-filter"
            value={filters.status}
            onChange={(e) => handleFilterChange({ status: e.target.value })}
            className="w-32"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </Sel>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Advanced toggle — shown only for students */}
          {filters.user_type === "student" && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition ${showAdvanced ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              <Funnel size={13} />
              Filters
              {showAdvanced ? (
                <CaretUp size={12} />
              ) : (
                <CaretDown size={12} />
              )}
            </button>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              id="clear-filters-btn"
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Row 2 — Advanced (student-only, collapsible) */}
        {filters.user_type === "student" && showAdvanced && (
          <div className="mt-3 pt-3 border-t border-[var(--border-light)] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 page-enter">
            <Sel
              id="school-filter"
              value={filters.school}
              onChange={(e) =>
                handleFilterChange({
                  school: e.target.value,
                  department: "",
                  course: "",
                })
              }
              className="w-full"
            >
              <option value="">All Schools</option>
              {schools.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Sel>

            <Sel
              value={filters.department}
              onChange={(e) =>
                handleFilterChange({ department: e.target.value })
              }
              className="w-full"
            >
              <option value="">All Departments</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Sel>

            <Sel
              value={filters.course}
              onChange={(e) => handleFilterChange({ course: e.target.value })}
              className="w-full"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Sel>

            <Sel
              value={filters.semester}
              onChange={(e) => handleFilterChange({ semester: e.target.value })}
              className="w-full"
            >
              <option value="">All Sems</option>
              {semesters.map((s) => (
                <option key={s} value={s}>
                  Sem {s}
                </option>
              ))}
            </Sel>

            <Sel
              value={filters.hostel_id}
              onChange={(e) =>
                handleFilterChange({
                  hostel_id: e.target.value,
                  hostel_status: "",
                })
              }
              className="w-full"
            >
              <option value="">All Hostels</option>
              {dbHostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Sel>

            <Sel
              id="hostel-status-filter"
              value={filters.hostel_status}
              onChange={(e) =>
                handleFilterChange({
                  hostel_status: e.target.value,
                  hostel_id: "",
                })
              }
              className="w-full"
            >
              <option value="">All Residence</option>
              <option value="hosteller">Hosteller</option>
              <option value="day_scholar">Day Scholar</option>
            </Sel>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden relative animate-fade-in shadow-xs">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-10 flex items-center justify-center rounded-xl">
            <SpinnerGap className="animate-spin text-slate-800" size={30} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {[
                  "User",
                  "Role & ID",
                  ...(filters.user_type === "student" ? ["Course & Sem"] : []),
                  "Department",
                  ...(filters.user_type === "student" ? ["Hostel"] : []),
                  "Status",
                  "RFID",
                  "Photo",
                  "Joined",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 whitespace-nowrap"
                  >
                    {h === "RFID" ? (
                      <span className="flex items-center gap-1">
                        <CreditCard size={13} className="text-slate-400" /> RFID
                      </span>
                    ) : h === "Photo" ? (
                      <span className="flex items-center gap-1">
                        <Camera size={13} className="text-slate-400" /> Photo
                      </span>
                    ) : (
                      h
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {apiError && !isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldSlash
                        size={28}
                        className="text-rose-400 opacity-80"
                      />
                      <p className="text-xs font-semibold text-rose-600">
                        {apiError}
                      </p>
                      <button
                        onClick={() => fetchUsers()}
                        className="text-xs font-medium text-slate-900 hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <MagnifyingGlass size={28} className="text-slate-300" />
                      <p className="text-xs font-medium text-slate-500">
                        No users match your filters.
                      </p>
                      <button
                        onClick={clearFilters}
                        className="text-xs font-medium text-slate-900 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const hostelName = getHostelName(user);
                  return (
                    <tr
                      key={user.id}
                      className="group hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => setViewTarget(user)}
                    >
                      {/* User */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0 select-none overflow-hidden">
                            {user.profile?.photo_reference ? (
                              <img
                                src={user.profile.photo_reference}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getUserName(user).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate max-w-[150px] text-slate-900">
                              {getUserName(user)}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role & ID */}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wide ${getRoleColor(user.user_type)}`}
                          >
                            {user.user_type}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {getIdentifier(user)}
                          </span>
                        </div>
                      </td>

                      {/* Course & Sem */}
                      {filters.user_type === "student" && (
                        <td className="px-4 py-2.5">
                          <p className="text-xs text-slate-800 truncate max-w-[130px]">
                            {user.profile?.course || "—"}
                          </p>
                          {user.profile?.semester && (
                            <p className="text-[11px] text-slate-400 font-mono">
                              Sem {user.profile.semester}
                            </p>
                          )}
                        </td>
                      )}

                      {/* Dept */}
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-slate-600 truncate max-w-[140px] block">
                          {user.profile?.department ||
                            user.profile?.school ||
                            "—"}
                        </span>
                      </td>

                      {/* Hostel */}
                      {filters.user_type === "student" && (
                        <td className="px-4 py-2.5">
                          {hostelName ? (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 max-w-[110px] truncate"
                              title={hostelName}
                            >
                              <House size={11} className="text-slate-500 shrink-0" />
                              <span>{hostelName}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Day Scholar
                            </span>
                          )}
                        </td>
                      )}

                      {/* Status */}
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${getStatusBadge(user.status)}`}
                        >
                          {user.status}
                        </span>
                      </td>

                      {/* RFID */}
                      <td className="px-4 py-2.5 text-center">
                        {user.active_rfid ? (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700"
                            title={user.active_rfid}
                          >
                            <CreditCard size={11} />{" "}
                            {user.active_rfid.slice(0, 8)}…
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">
                            —
                          </span>
                        )}
                      </td>

                      {/* Photo */}
                      <td className="px-4 py-3 text-center">
                        {user.profile?.photo_reference ? (
                          <img
                            src={user.profile.photo_reference}
                            alt={`${getUserName(user)} passport photo`}
                            className="h-9 w-7 mx-auto rounded border border-slate-200 object-cover"
                          />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">
                            —
                          </span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative inline-block">
                          <button
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-[var(--text-muted)] transition-colors"
                            onClick={() =>
                              setShowActionsId(
                                showActionsId === user.id ? null : user.id,
                              )
                            }
                          >
                            <DotsThreeVertical size={16} />
                          </button>
                          {showActionsId === user.id && (
                            <div className="absolute right-0 top-9 z-20 min-w-[170px] rounded-xl border border-[var(--border-light)] bg-white p-1 shadow-xl">
                              <button
                                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 rounded-lg transition"
                                onClick={() => {
                                  setEditTarget(user);
                                  setShowActionsId(null);
                                }}
                              >
                                <PencilSimple size={13} /> Edit Profile
                              </button>
                              {user.status !== "active" ? (
                                <button
                                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                  onClick={() => openAction(user, "activate")}
                                >
                                  <ShieldCheck size={13} /> Activate
                                </button>
                              ) : (
                                <button
                                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                  onClick={() => openAction(user, "suspend")}
                                >
                                  <ShieldSlash size={13} /> Suspend
                                </button>
                              )}
                              <button
                                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition"
                                onClick={() => openAction(user, "deactivate")}
                              >
                                <UserMinus size={13} /> Deactivate
                              </button>
                              <div className="my-1 border-t border-[var(--border-light)]" />
                              <button
                                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 rounded-lg transition"
                                onClick={() => openAction(user, "delete")}
                              >
                                <UserMinus size={13} /> Delete permanently
                              </button>
                            </div>
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

        {/* Pagination */}
        <div className="border-t border-slate-200">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={(p) => {
              setPage(p);
              fetchUsers(p);
            }}
            onLimitChange={(newSize) => {
              setLimit(newSize);
              setPage(1);
              fetchUsers(1, newSize);
            }}
          />
        </div>
      </div>

      {/* ── Drawer: User Details ── */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
            onClick={() => setViewTarget(null)}
          />
          <div className="relative z-10 w-full max-w-lg h-full bg-white shadow-xl flex flex-col overflow-hidden animate-slide-in-right border-l border-slate-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/70 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700 shrink-0 overflow-hidden">
                  {viewTarget.profile?.photo_reference ? (
                    <img
                      src={viewTarget.profile.photo_reference}
                      alt={`${getUserName(viewTarget)} passport photo`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getUserName(viewTarget).charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    {getUserName(viewTarget)}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-semibold uppercase ${getRoleColor(viewTarget.user_type)}`}
                    >
                      {viewTarget.user_type}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {viewTarget.email}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setEditTarget(viewTarget);
                    setViewTarget(null);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                  title="Edit User"
                >
                  <PencilSimple size={15} />
                </button>
                <button
                  onClick={() => setViewTarget(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              {/* Status & Identity */}
              <div className="rounded-xl border border-slate-200/90 p-4 bg-white">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-100">
                  Status &amp; Identity Credentials
                </h3>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">
                      Account Status
                    </p>
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${getStatusBadge(viewTarget.status)}`}
                    >
                      {viewTarget.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">
                      Primary Identifier
                    </p>
                    <p className="text-xs font-mono font-medium text-slate-800">
                      {getIdentifier(viewTarget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">
                      Assigned RFID Tag
                    </p>
                    {viewTarget.active_rfid ? (
                      <span className="text-xs font-mono font-medium text-emerald-700">
                        {viewTarget.active_rfid.slice(0, 10)}…
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        None assigned
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">
                      Face Biometrics
                    </p>
                    {viewTarget.has_face_auth ? (
                      <span className="text-xs font-medium text-blue-700">
                        Enrolled
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Not enrolled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="rounded-xl border border-slate-200/90 p-4 bg-white">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-100">
                  Institutional Profile
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Phone Number
                    </p>
                    <p className="text-sm">{viewTarget.phone || "—"}</p>
                  </div>

                  {viewTarget.user_type === "student" && (
                    <>
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          School & Department
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.school || "—"}
                        </p>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">
                          {viewTarget.profile?.department || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Course
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.course || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Semester
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.semester || "—"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Guardian Contact
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.guardian_contact || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Nationality
                        </p>
                        <p className="text-sm capitalize">
                          {viewTarget.profile?.nationality || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Government ID
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.gov_id_type || "—"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">
                          {viewTarget.profile?.gov_id_number || ""}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Hostel
                        </p>
                        {viewTarget.profile?.hostel_flag ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                            <House size={13} className="text-slate-500" />
                            {viewTarget.profile?.hostel_id &&
                            hostelMap[viewTarget.profile.hostel_id]
                              ? hostelMap[viewTarget.profile.hostel_id]
                              : "Hostel Resident"}
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--text-muted)]">
                            Day Scholar
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {(viewTarget.user_type === "faculty" ||
                    viewTarget.user_type === "worker") && (
                    <>
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Designation
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.designation || "—"}
                        </p>
                      </div>
                      {viewTarget.user_type === "faculty" && (
                        <div className="col-span-2">
                          <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                            Department
                          </p>
                          <p className="text-sm">
                            {viewTarget.profile?.department || "—"}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {viewTarget.user_type === "visitor" && (
                    <>
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Visit Purpose
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.visit_purpose || "—"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                          Host Contact
                        </p>
                        <p className="text-sm">
                          {viewTarget.profile?.host_contact || "—"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updatedUser) => {
            setEditTarget(null);
            if (updatedUser) {
              setViewTarget((prev) => (prev && prev.id === updatedUser.id ? updatedUser : prev));
            }
            fetchUsers();
          }}
        />
      )}

      {statusTarget && (
        <UserStatusModal
          user={statusTarget}
          action={statusAction}
          onClose={() => setStatusTarget(null)}
          onDone={() => {
            setStatusTarget(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
};

export default UsersView;
