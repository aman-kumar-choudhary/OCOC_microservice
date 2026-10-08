import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  GraduationCap,
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
import {
  SCHOOL_DEPARTMENTS,
  getCoursesForDepartment,
  getCoursesForSchool,
  getAllCourses,
} from "@/utils/academicCatalog";
import UserAccessDetail from "./UserAccessDetail";

const roleFilterClass = "w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white";

const roleOptionsByUserType = {
  student: [{ value: "STUDENT", label: "Student" }],
  faculty: [{ value: "FACULTY", label: "Faculty" }],
  worker: [
    { value: "SECURITY_GUARD", label: "Security Guard" },
    { value: "GUARD", label: "Guard" },
    { value: "WARDEN", label: "Warden" },
    { value: "STAFF", label: "Staff" },
    { value: "WORKER", label: "Worker" },
  ],
  visitor: [{ value: "VISITOR", label: "Visitor" }],
};

const roleToUserType = {
  STUDENT: "student",
  FACULTY: "faculty",
  SECURITY_GUARD: "worker",
  GUARD: "worker",
  WARDEN: "Staff",
  STAFF: "worker",
  WORKER: "worker",
  VISITOR: "visitor",
};

const allRoleOptions = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "SECURITY_ADMIN", label: "Security Admin" },
  ...roleOptionsByUserType.worker,
  ...roleOptionsByUserType.faculty,
  ...roleOptionsByUserType.student,
  ...roleOptionsByUserType.visitor,
];

const FilterInput = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-[11px] font-bold text-slate-600 block mb-1">{label}</label>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={roleFilterClass}
    />
  </div>
);

const FilterSelect = ({
  label,
  value,
  onChange,
  options = [],
  optionLabel = (option) => (typeof option === "object" ? option.label : option),
  placeholder,
}) => (
  <div>
    <label className="text-[11px] font-bold text-slate-600 block mb-1">{label}</label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={roleFilterClass}
    >
      <option value="">{placeholder || `All ${label}s`}</option>
      {options.map((option) => {
        const val = typeof option === "object" ? option.value : option;
        const lbl = optionLabel(option);
        return (
          <option key={val} value={val}>
            {lbl}
          </option>
        );
      })}
    </select>
  </div>
);

export const UserAccessPanel = () => {
  // ── Search & Filter State ──
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userType, setUserType] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [accessFilter, setAccessFilter] = useState("");

  // Advanced Academic / Hostel filters
  const [courseFilter, setCourseFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [hostelFilter, setHostelFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [workAreaFilter, setWorkAreaFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [visitPurposeFilter, setVisitPurposeFilter] = useState("");
  const [hostPersonFilter, setHostPersonFilter] = useState("");
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
  const [dbCourses, setDbCourses] = useState([]);

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
      const [deptRes, hostelRes, locRes, courseRes] = await Promise.all([
        userService.getDepartments().catch(() => []),
        userService.getHostels().catch(() => []),
        accessService.getLocations().catch(() => []),
        userService.getCourses().catch(() => []),
      ]);
      setDepartments(deptRes || []);
      setHostels(hostelRes || []);
      setCampuses(
        (locRes || []).filter((l) => l.type === "campus" || !l.parent_id),
      );
      setDbCourses(courseRes || []);
    } catch (e) {
      console.warn("Could not load all lookup filters:", e);
    }
  };

  // Derived schools and cascading lists
  const schools = useMemo(() => {
    const fromDb = departments.map((d) => d.school).filter(Boolean);
    const fromCatalog = Object.keys(SCHOOL_DEPARTMENTS);
    return [...new Set([...fromDb, ...fromCatalog])].sort();
  }, [departments]);

  const filteredDepartments = useMemo(() => {
    if (!schoolFilter) return departments;
    const dbMatched = departments.filter((d) => d.school === schoolFilter);
    if (dbMatched.length > 0) return dbMatched;
    const catalogDeptNames = SCHOOL_DEPARTMENTS[schoolFilter] || [];
    return departments.filter((d) => catalogDeptNames.includes(d.name));
  }, [departments, schoolFilter]);

  const availableCourses = useMemo(() => {
    if (departmentFilter) {
      return getCoursesForDepartment(departmentFilter, dbCourses);
    }
    if (schoolFilter) {
      return getCoursesForSchool(schoolFilter, departments, dbCourses);
    }
    return getAllCourses(dbCourses);
  }, [schoolFilter, departmentFilter, departments, dbCourses]);

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
      if (schoolFilter) params.school = schoolFilter;
      if (departmentFilter) params.department = departmentFilter;
      if (statusFilter) params.status = statusFilter;
      if (campusFilter) params.campus = campusFilter;
      if (accessFilter) params.access_filter = accessFilter;
      if (courseFilter.trim()) params.course = courseFilter.trim();
      if (semesterFilter) params.semester = semesterFilter;
      if (hostelFilter) params.hostel = hostelFilter;
      if (designationFilter.trim()) params.designation = designationFilter.trim();
      if (jobTypeFilter.trim()) params.job_type = jobTypeFilter.trim();
      if (workAreaFilter.trim()) params.work_area = workAreaFilter.trim();
      if (shiftFilter.trim()) params.shift = shiftFilter.trim();
      if (visitPurposeFilter.trim()) params.visit_purpose = visitPurposeFilter.trim();
      if (hostPersonFilter.trim()) params.host_person = hostPersonFilter.trim();

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
    schoolFilter,
    departmentFilter,
    statusFilter,
    campusFilter,
    accessFilter,
    courseFilter,
    semesterFilter,
    hostelFilter,
    designationFilter,
    jobTypeFilter,
    workAreaFilter,
    shiftFilter,
    visitPurposeFilter,
    hostPersonFilter,
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
    setSchoolFilter("");
    setDepartmentFilter("");
    setStatusFilter("");
    setCampusFilter("");
    setAccessFilter("");
    setCourseFilter("");
    setSemesterFilter("");
    setHostelFilter("");
    setDesignationFilter("");
    setJobTypeFilter("");
    setWorkAreaFilter("");
    setShiftFilter("");
    setVisitPurposeFilter("");
    setHostPersonFilter("");
    setPage(1);
  };

  // Profile fields belong to a single person type. Clear them when the type changes.
  const handleUserTypeChange = (nextType) => {
    setUserType(nextType);
    setRoleFilter("");
    setShowAdvancedFilters(Boolean(nextType));
    setSchoolFilter("");
    setDepartmentFilter("");
    setCourseFilter("");
    setSemesterFilter("");
    setHostelFilter("");
    setDesignationFilter("");
    setJobTypeFilter("");
    setWorkAreaFilter("");
    setShiftFilter("");
    setVisitPurposeFilter("");
    setHostPersonFilter("");
    setPage(1);
  };

  // Role filter selection - auto-syncs user type if mapped
  const handleRoleFilterChange = (nextRole) => {
    setRoleFilter(nextRole);
    if (nextRole && roleToUserType[nextRole]) {
      const mapped = roleToUserType[nextRole];
      if (userType !== mapped) {
        setUserType(mapped);
      }
    }
    setShowAdvancedFilters(true);
    setPage(1);
  };

  // School filter selection with cascading cleanups
  const handleSchoolChange = (nextSchool) => {
    setSchoolFilter(nextSchool);
    if (departmentFilter && nextSchool) {
      const validDeptNames = departments
        .filter((d) => d.school === nextSchool)
        .map((d) => d.name);
      const catalogDeptNames = SCHOOL_DEPARTMENTS[nextSchool] || [];
      const allValid = [...new Set([...validDeptNames, ...catalogDeptNames])];
      if (!allValid.includes(departmentFilter)) {
        setDepartmentFilter("");
        setCourseFilter("");
      }
    }
    if (courseFilter && nextSchool) {
      const validCourses = getCoursesForSchool(nextSchool, departments, dbCourses);
      if (!validCourses.includes(courseFilter)) {
        setCourseFilter("");
      }
    }
    setPage(1);
  };

  // Department filter selection with cascading cleanups
  const handleDepartmentChange = (nextDept) => {
    setDepartmentFilter(nextDept);
    if (courseFilter && nextDept) {
      const validCourses = getCoursesForDepartment(nextDept, dbCourses);
      if (!validCourses.includes(courseFilter)) {
        setCourseFilter("");
      }
    }
    if (!schoolFilter && nextDept) {
      const deptObj = departments.find((d) => d.name === nextDept);
      if (deptObj?.school) {
        setSchoolFilter(deptObj.school);
      } else {
        for (const [sch, dList] of Object.entries(SCHOOL_DEPARTMENTS)) {
          if (dList.includes(nextDept)) {
            setSchoolFilter(sch);
            break;
          }
        }
      }
    }
    setPage(1);
  };

  const updateRoleFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  // Determine active persona / role type
  const activeRoleType = userType || roleToUserType[roleFilter] || "";

  const activeFilterCount = [
    userType,
    roleFilter,
    schoolFilter,
    departmentFilter,
    statusFilter,
    campusFilter,
    accessFilter,
    courseFilter,
    semesterFilter,
    hostelFilter,
    designationFilter,
    jobTypeFilter,
    workAreaFilter,
    shiftFilter,
    visitPurposeFilter,
    hostPersonFilter,
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
  const availableRoleOptions = userType
    ? roleOptionsByUserType[userType] || []
    : allRoleOptions;
  const rolePlaceholder = userType
    ? `All ${typeLabel[userType]?.replace(/^./, (letter) => letter.toUpperCase()) || ""} Roles`
    : "All Roles";

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
      {/* ── Search and Filter Header Card ── */}
      <div className="rounded-2xl border border-[var(--border-light)] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">
              People & Access
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter by person type, then review each person’s Keycloak roles
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
              onClick={() => handleUserTypeChange(type.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${userType === type.id
                ? "bg-[#0a2342] text-white border-[#0a2342]"
                : "bg-white text-slate-600 border-slate-200 hover:border-amber-400"
                }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Search Bar & Filter Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search 5,000+ users by name, email, university ID (enrollment/employee), or phone..."
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
              className={`btn text-xs font-bold ${showAdvancedFilters || activeFilterCount > 0
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

        {/* Primary Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {/* User Type */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 block">
              User Type
            </label>
            <select
              value={userType}
              onChange={(e) => handleUserTypeChange(e.target.value)}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Types</option>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
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
              onChange={(e) => handleRoleFilterChange(e.target.value)}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="">{rolePlaceholder}</option>
              {availableRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
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
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Active Filters:</span>
            {userType && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                User Type: {userType}
                <button
                  type="button"
                  onClick={() => handleUserTypeChange("")}
                  className="hover:text-rose-600 transition"
                  title="Remove User Type filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {roleFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Role: {roleFilter}
                <button
                  type="button"
                  onClick={() => { setRoleFilter(""); setPage(1); }}
                  className="hover:text-rose-600 transition"
                  title="Remove Role filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {schoolFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Buildings size={11} /> School: {schoolFilter.replace("School of ", "")}
                <button
                  type="button"
                  onClick={() => handleSchoolChange("")}
                  className="hover:text-rose-600 transition"
                  title="Remove School filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {departmentFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Dept: {departmentFilter.replace("Department of ", "")}
                <button
                  type="button"
                  onClick={() => handleDepartmentChange("")}
                  className="hover:text-rose-600 transition"
                  title="Remove Department filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {courseFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                Program: {courseFilter}
                <button
                  type="button"
                  onClick={() => { setCourseFilter(""); setPage(1); }}
                  className="hover:text-rose-600 transition"
                  title="Remove Program filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {semesterFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Semester: {semesterFilter}
                <button
                  type="button"
                  onClick={() => { setSemesterFilter(""); setPage(1); }}
                  className="hover:text-rose-600 transition"
                  title="Remove Semester filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {hostelFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Hostel: {hostelFilter}
                <button
                  type="button"
                  onClick={() => { setHostelFilter(""); setPage(1); }}
                  className="hover:text-rose-600 transition"
                  title="Remove Hostel filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Status: {statusFilter}
                <button
                  type="button"
                  onClick={() => { setStatusFilter(""); setPage(1); }}
                  className="hover:text-rose-600 transition"
                  title="Remove Status filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold ml-1 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Each profile type has its own fields. Opening filters shows the corresponding role-based section. */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 animate-fade-in bg-slate-50/70 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Funnel size={13} className="text-amber-600" />
                <span>
                  {activeRoleType
                    ? `${activeRoleType.toUpperCase()} FILTERS`
                    : "ALL USERS FILTERS"}
                </span>
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                >
                  <ArrowCounterClockwise size={12} /> Clear all filters
                </button>
              )}
            </div>

            {/* 1. STUDENT FILTERS */}
            {activeRoleType === "student" && (
              <div className="space-y-3.5">
                {/* School Selector Card */}
                <div className="bg-white rounded-xl border border-blue-100 p-3.5 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
                        <GraduationCap size={14} weight="bold" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Select School of the Student:
                      </span>
                    </div>
                    {schoolFilter && (
                      <button
                        type="button"
                        onClick={() => handleSchoolChange("")}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-bold inline-flex items-center gap-1"
                      >
                        <X size={12} /> Reset to All Schools
                      </button>
                    )}
                  </div>

                  {/* Quick School Selection Buttons */}


                  {/* School Dropdown */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-600 shrink-0">
                      Or select School:
                    </label>
                    <select
                      value={schoolFilter}
                      onChange={(e) => handleSchoolChange(e.target.value)}
                      className={roleFilterClass}
                    >
                      <option value="">All Schools</option>
                      {schools.map((sch) => (
                        <option key={sch} value={sch}>
                          {sch}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Under-school Cascading Section: Department, Program, Semester, Residential Hostel */}
                {schoolFilter ? (
                  <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/50 rounded-xl border border-blue-200 p-3.5 space-y-2.5 animate-fade-in shadow-2xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-[11px] font-extrabold uppercase text-blue-900 tracking-wide">
                          Under School: <span className="text-slate-900 font-black">{schoolFilter}</span>
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                        {filteredDepartments.length} Departments • {availableCourses.length} Programs
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <FilterSelect
                        label="Department"
                        value={departmentFilter}
                        onChange={handleDepartmentChange}
                        options={filteredDepartments.map((d) => d.name)}
                        placeholder="All Departments"
                      />
                      <FilterSelect
                        label="Program"
                        value={courseFilter}
                        onChange={updateRoleFilter(setCourseFilter)}
                        options={availableCourses}
                        placeholder={departmentFilter ? "All Department" : "All Programs"}
                      />
                      <FilterSelect
                        label="Semester / Year"
                        value={semesterFilter}
                        onChange={updateRoleFilter(setSemesterFilter)}
                        options={[1, 2, 3, 4, 5, 6, 7, 8].map(String)}
                        optionLabel={(s) => `Semester ${s} (Year ${Math.ceil(Number(s) / 2)})`}
                        placeholder="All Semesters / Years"
                      />
                      <FilterSelect
                        label="Residential Hostel"
                        value={hostelFilter}
                        onChange={updateRoleFilter(setHostelFilter)}
                        options={hostels.map((h) => h.name)}
                        placeholder="All Residential Hostels"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500 font-medium">
                        💡 Select a specific school above to narrow departments and academic programs to that school, or filter across all schools below:
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <FilterSelect
                        label="Department"
                        value={departmentFilter}
                        onChange={handleDepartmentChange}
                        options={departments.map((d) => d.name)}
                        placeholder="All Departments"
                      />
                      <FilterSelect
                        label="Program"
                        value={courseFilter}
                        onChange={updateRoleFilter(setCourseFilter)}
                        options={availableCourses}
                        placeholder="All Programs"
                      />
                      <FilterSelect
                        label="Semester / Year"
                        value={semesterFilter}
                        onChange={updateRoleFilter(setSemesterFilter)}
                        options={[1, 2, 3, 4, 5, 6, 7, 8].map(String)}
                        optionLabel={(s) => `Semester ${s} (Year ${Math.ceil(Number(s) / 2)})`}
                        placeholder="All Semesters / Years"
                      />
                      <FilterSelect
                        label="Residential Hostel"
                        value={hostelFilter}
                        onChange={updateRoleFilter(setHostelFilter)}
                        options={hostels.map((h) => h.name)}
                        placeholder="All Residential Hostels"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. FACULTY FILTERS */}
            {activeRoleType === "faculty" && (
              <div className="bg-white rounded-xl border border-amber-100 p-3.5 space-y-3 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FilterSelect
                    label="School"
                    value={schoolFilter}
                    onChange={handleSchoolChange}
                    options={schools}
                    placeholder="All Schools"
                  />
                  <FilterSelect
                    label="Faculty Department"
                    value={departmentFilter}
                    onChange={handleDepartmentChange}
                    options={filteredDepartments.map((d) => d.name)}
                    placeholder={schoolFilter ? "All Departments in School" : "All Departments"}
                  />
                  <FilterInput
                    label="Designation"
                    value={designationFilter}
                    onChange={updateRoleFilter(setDesignationFilter)}
                    placeholder="e.g. Professor, Assistant Professor, Dean"
                  />
                </div>
              </div>
            )}

            {/* 3. WORKER FILTERS */}
            {activeRoleType === "worker" && (
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FilterSelect
                    label="Department"
                    value={departmentFilter}
                    onChange={updateRoleFilter(setDepartmentFilter)}
                    options={departments.map((d) => d.name)}
                  />
                  <FilterInput
                    label="Job Type"
                    value={jobTypeFilter}
                    onChange={updateRoleFilter(setJobTypeFilter)}
                    placeholder="e.g. Maintenance, Security, Warden"
                  />
                  <FilterInput
                    label="Work Area"
                    value={workAreaFilter}
                    onChange={updateRoleFilter(setWorkAreaFilter)}
                    placeholder="e.g. Main Gate, Library, Hostels"
                  />
                  <FilterInput
                    label="Shift"
                    value={shiftFilter}
                    onChange={updateRoleFilter(setShiftFilter)}
                    placeholder="e.g. Morning, Evening, Night"
                  />
                </div>
              </div>
            )}

            {/* 4. VISITOR FILTERS */}
            {activeRoleType === "visitor" && (
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FilterInput
                    label="Visit Purpose"
                    value={visitPurposeFilter}
                    onChange={updateRoleFilter(setVisitPurposeFilter)}
                    placeholder="e.g. Admission enquiry, Official visit"
                  />
                  <FilterInput
                    label="Host Person"
                    value={hostPersonFilter}
                    onChange={updateRoleFilter(setHostPersonFilter)}
                    placeholder="Search by host name"
                  />
                </div>
              </div>
            )}

            {/* 5. ALL USERS GENERAL FILTERS */}
            {!activeRoleType && (
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FilterSelect
                    label="School"
                    value={schoolFilter}
                    onChange={handleSchoolChange}
                    options={schools}
                    placeholder="All Schools"
                  />
                  <FilterSelect
                    label="Department"
                    value={departmentFilter}
                    onChange={handleDepartmentChange}
                    options={filteredDepartments.map((d) => d.name)}
                    placeholder="All Departments"
                  />
                  <FilterSelect
                    label="Residential Hostel"
                    value={hostelFilter}
                    onChange={updateRoleFilter(setHostelFilter)}
                    options={hostels.map((h) => h.name)}
                    placeholder="All Residential Hostels"
                  />
                  <FilterSelect
                    label="Campus Location"
                    value={campusFilter}
                    onChange={updateRoleFilter(setCampusFilter)}
                    options={campuses.map((c) => c.name)}
                    placeholder="All Campuses"
                  />
                </div>
              </div>
            )}
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
              No Users Match Filter Criteria
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
                      className={`cursor-pointer transition ${isSelected
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
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${u.status === "active"
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
                            <p className="font-semibold text-slate-800 truncate max-w-[160px]" title={u.department}>
                              {u.department}
                            </p>
                          )}
                          {u.school && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[160px]" title={u.school}>
                              {u.school}
                            </p>
                          )}
                          {u.hostel_name && (
                            <p className="text-amber-800 text-[10px]">
                              Hostel: {u.hostel_name}
                            </p>
                          )}
                          {!u.department && !u.hostel_name && !u.school && (
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
                          className={`btn text-xs py-1.5 px-3 ${isSelected
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
