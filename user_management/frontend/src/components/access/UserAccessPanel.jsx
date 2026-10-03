import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowRight,
  Buildings,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CheckCircle,
  Eye,
  Funnel,
  House,
  MagnifyingGlass,
  MapPin,
  Shield,
  SlidersHorizontal,
  Sparkle,
  SpinnerGap,
  User,
  UserCheck,
  UserPlus,
  WarningCircle,
  X
} from "@phosphor-icons/react";
import accessService from "@/services/accessService";
import userService from "@/services/userService";
import UserAccessDetail from "./UserAccessDetail";
export const UserAccessPanel = () => {
  // ── MagnifyingGlass & Funnel State ──
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userType, setUserType] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [accessFilter, setAccessFilter] = useState("");

  // Advanced Academic / Hostel filters
  const [courseFilter, setCourseFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [hostelFilter, setHostelFilter] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ── Pagination State ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Data State ──
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Lookup options
  const [departments, setDepartments] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [campuses, setCampuses] = useState([]);

  // ── Selected User for Detail View ──
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load lookup data on mount
  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [deptRes, hostelRes, locRes] = await Promise.all([
        userService.getDepartments().catch(() => []),
        userService.getHostels().catch(() => []),
        accessService.getLocations().catch(() => []),
      ]);
      setDepartments(deptRes || []);
      setHostels(hostelRes || []);
      setCampuses(
        (locRes || []).filter((l) => l.type === "campus" || !l.parent_id),
      );
    } catch (e) {
      console.warn("Could not load all lookup filters:", e);
    }
  };

  // Fetch users when filters or page changes
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        page_size: pageSize,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (userType) params.user_type = userType;
      if (roleFilter) params.role = roleFilter;
      if (departmentFilter) params.department = departmentFilter;
      if (statusFilter) params.status = statusFilter;
      if (campusFilter) params.campus = campusFilter;
      if (accessFilter) params.access_filter = accessFilter;
      if (courseFilter.trim()) params.course = courseFilter.trim();
      if (semesterFilter) params.semester = semesterFilter;
      if (hostelFilter) params.hostel = hostelFilter;

      const res = await accessService.searchAccessUsers(params);
      setUsers(res.users || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to search users.",
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    userType,
    roleFilter,
    departmentFilter,
    statusFilter,
    campusFilter,
    accessFilter,
    courseFilter,
    semesterFilter,
    hostelFilter,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setUserType("");
    setRoleFilter("");
    setDepartmentFilter("");
    setStatusFilter("");
    setCampusFilter("");
    setAccessFilter("");
    setCourseFilter("");
    setSemesterFilter("");
    setHostelFilter("");
    setPage(1);
  };

  const activeFilterCount = [
    userType,
    roleFilter,
    departmentFilter,
    statusFilter,
    campusFilter,
    accessFilter,
    courseFilter,
    semesterFilter,
    hostelFilter,
  ].filter(Boolean).length;

  const quickTypes = [
    { id: "", label: "All users" },
    { id: "student", label: "Students" },
    { id: "faculty", label: "Faculty" },
    { id: "worker", label: "Workers" },
    { id: "visitor", label: "Visitors" },
  ];
  const typeLabel = {
    student: "students",
    faculty: "faculty",
    worker: "workers",
    visitor: "visitors",
  };

  // Helper for access badge
  const renderAccessStatus = (u) => {
    if (u.access_status === "full") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
          <Sparkle size={11} /> Full Access
        </span>
      );
    }
    if (u.access_status === "partial" || u.grant_count > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <MapPin size={11} /> {u.grant_count} Grant
          {u.grant_count > 1 ? "s" : ""}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
        No Direct Grants
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── MagnifyingGlass and Funnel Header Card ── */}
      <div className="rounded-2xl border border-[var(--border-light)] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">
              People & Access
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Funnel by person type, then review each person’s Keycloak roles
              and location grants.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600">
            {totalCount.toLocaleString()} {typeLabel[userType] || "people"}
          </span>
        </div>

        <div
          className="flex flex-wrap gap-2"
          aria-label="Quick filter by user type"
        >
          {quickTypes.map((type) => (
            <button
              key={type.id || "all"}
              type="button"
              onClick={() => {
                setUserType(type.id);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                userType === type.id
                  ? "bg-[#0a2342] text-white border-[#0a2342]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-amber-400"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* MagnifyingGlass Bar & Funnel Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="MagnifyingGlass 5,000+ users by name, email, university ID (enrollment/employee), or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/onboarding"
              className="btn btn-primary text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              <UserPlus size={14} />
              <span>Onboard User</span>
            </Link>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`btn text-xs font-bold ${
                showAdvancedFilters || activeFilterCount > 0
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "btn-outline"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
                  {activeFilterCount}
                </span>
              )}
              {showAdvancedFilters ? (
                <CaretUp size={14} />
              ) : (
                <CaretDown size={14} />
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="btn btn-outline text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                title="Reset all filters"
              >
                <ArrowCounterClockwise size={14} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Primary Funnel Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {/* User Type */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 block">
              User Type
            </label>
            <select
              value={userType}
              onChange={(e) => {
                setUserType(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Types</option>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="staff">Staff</option>
              <option value="worker">Worker</option>
              <option value="visitor">Visitor</option>
            </select>
          </div>

          {/* Operational Role */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 block">
              Assigned Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SECURITY_ADMIN">SECURITY_ADMIN</option>
              <option value="SECURITY_GUARD">SECURITY_GUARD</option>
              <option value="WARDEN">WARDEN</option>
              <option value="FACULTY">FACULTY</option>
              <option value="STUDENT">STUDENT</option>
              <option value="STAFF">STAFF</option>
              <option value="WORKER">WORKER</option>
              <option value="VISITOR">VISITOR</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 block">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Department */}
          <div
            className={
              userType && !["student", "faculty", "worker"].includes(userType)
                ? "hidden"
                : ""
            }
          >
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 block">
              {userType === "faculty" ? "Faculty Department" : "Department"}
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Campus / Location */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 block">
              Campus
            </label>
            <select
              value={campusFilter}
              onChange={(e) => {
                setCampusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Existing Access */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 block">
              Existing Access
            </label>
            <select
              value={accessFilter}
              onChange={(e) => {
                setAccessFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Access</option>
              <option value="no_access">No Direct Grants</option>
              <option value="partial">Has Direct Grants</option>
              <option value="full">Full / Campus Admin</option>
            </select>
          </div>
        </div>

        {/* Collapsible Advanced Academic / Hostel Filters */}
        {showAdvancedFilters && (userType === "student" || userType === "") && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in bg-slate-50/60 p-3.5 rounded-xl">
            {/* Course */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Course / Program
              </label>
              <input
                type="text"
                placeholder="e.g. B.Tech Computer Science"
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white"
              />
            </div>

            {/* Semester */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Semester / Year
              </label>
              <select
                value={semesterFilter}
                onChange={(e) => {
                  setSemesterFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s} (Year {Math.ceil(s / 2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Hostel */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Residential Hostel
              </label>
              <select
                value={hostelFilter}
                onChange={(e) => {
                  setHostelFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">All Hostels</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Results Section ── */}
      <div className="rounded-2xl border border-[var(--border-light)] bg-white shadow-xs overflow-hidden">
        {/* Table Stats Bar */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">
              {loading
                ? "Searching..."
                : `${totalCount.toLocaleString()} Users Found`}
            </span>
            {totalCount > 0 && (
              <span className="text-slate-500">
                (Page {page} of {totalPages})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="py-1 px-2 border border-slate-200 rounded-md text-xs bg-white font-semibold"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1 rounded-md border border-slate-200 hover:bg-white text-slate-600 disabled:opacity-40"
              >
                <CaretLeft size={16} />
              </button>
              <span className="px-2 font-mono font-bold text-slate-700">
                {page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="p-1 rounded-md border border-slate-200 hover:bg-white text-slate-600 disabled:opacity-40"
              >
                <CaretRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <WarningCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Table / Results */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <SpinnerGap size={32} className="animate-spin text-amber-500" />
            <p className="text-xs font-semibold text-slate-500">
              Querying user access directory...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <User size={36} className="mx-auto text-slate-300" />
            <h4 className="font-bold text-sm text-slate-700">
              No Users Match Funnel Criteria
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search query, clearing specific filters, or
              resetting the filter bar.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Link
                to="/onboarding"
                className="btn btn-primary text-xs font-bold inline-flex items-center gap-1.5"
              >
                <UserPlus size={14} /> Onboard New User
              </Link>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="btn btn-outline text-xs"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">User & Identity</th>
                  <th className="px-4 py-3">ID / Enrollment</th>
                  <th className="px-4 py-3">Type & Status</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Department / Hostel</th>
                  <th className="px-4 py-3">Location Access</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? "bg-amber-50/60 ring-1 ring-inset ring-amber-400"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Identity: Avatar + Name + Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {u.photo_reference ? (
                            <img
                              src={u.photo_reference}
                              alt={u.full_name}
                              className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-[#0a2342] text-white flex items-center justify-center font-bold text-xs">
                              {(u.full_name || u.email || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                              <span>{u.full_name || "Unnamed User"}</span>
                              {u.keycloak_linked && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                  title="Keycloak linked"
                                />
                              )}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* University ID */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700">
                        {u.roll_number || u.employee_id || (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* User Type & Status */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {u.user_type || "user"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              u.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : u.status === "suspended"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {u.status || "active"}
                          </span>
                        </div>
                      </td>

                      {/* Roles */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {u.roles?.length > 0 ? (
                            u.roles.map((role) => (
                              <span
                                key={role}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              No roles
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department / Hostel */}
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] text-slate-700 space-y-0.5">
                          {u.department && (
                            <p className="font-semibold text-slate-800 truncate max-w-[160px]">
                              {u.department}
                            </p>
                          )}
                          {u.hostel_name && (
                            <p className="text-amber-800 text-[10px]">
                              Hostel: {u.hostel_name}
                            </p>
                          )}
                          {!u.department && !u.hostel_name && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Location Access Grants */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {renderAccessStatus(u)}
                          {u.locations?.length > 0 && (
                            <p
                              className="max-w-[220px] truncate text-[10px] text-slate-500"
                              title={u.locations.join(", ")}
                            >
                              {u.locations.slice(0, 2).join(", ")}
                              {u.locations.length > 2
                                ? ` +${u.locations.length - 2} more`
                                : ""}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Quick Action Button */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserId(u.id);
                          }}
                          className={`btn text-xs py-1.5 px-3 ${
                            isSelected
                              ? "btn-primary"
                              : "btn-outline text-slate-700 hover:text-slate-900"
                          }`}
                        >
                          <Shield size={13} />
                          <span>Manage Access</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination Bar */}
        <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Showing {(page - 1) * pageSize + (users.length > 0 ? 1 : 0)} –{" "}
            {Math.min(page * pageSize, totalCount)} of{" "}
            {totalCount.toLocaleString()} users
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className="px-2 py-1 rounded text-[11px] font-bold border border-slate-200 bg-white disabled:opacity-40"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-2 py-1 rounded text-[11px] font-bold border border-slate-200 bg-white disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 rounded text-[11px] font-bold border border-slate-200 bg-white disabled:opacity-40"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 rounded text-[11px] font-bold border border-slate-200 bg-white disabled:opacity-40"
            >
              Last ({totalPages})
            </button>
          </div>
        </div>
      </div>

      {/* ── Slide-over Drawer / Modal for Selected User Access Detail ── */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#0a2342]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedUserId(null)}
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-full max-w-4xl bg-white shadow-2xl h-full flex flex-col animate-slide-in-right overflow-hidden">
            <UserAccessDetail
              userId={selectedUserId}
              onClose={() => setSelectedUserId(null)}
              onUserUpdated={fetchUsers}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccessPanel;
