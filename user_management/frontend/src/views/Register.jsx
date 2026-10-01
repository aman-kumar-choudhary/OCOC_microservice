import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import registrationService from "@/services/registrationService";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import LegalModal from "@/components/LegalModal";
import {
  User,
  Mail,
  Phone,
  Hash,
  Building,
  Briefcase,
  FileText,
  UserCheck,
  MapPin,
  ArrowRight,
  Loader2,
  CheckCircle,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Award,
  Shield,
  Wrench,
  Calendar,
  Clock,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  ShieldCheck,
  Cpu,
  CheckCircle2,
} from "lucide-react";
const ROLE_PRESETS = [
  { id: "student", label: "Student", icon: GraduationCap, roles: ["student"] },
  { id: "faculty", label: "Faculty", icon: Award, roles: ["faculty"] },
  {
    id: "faculty_warden",
    label: "Faculty + Warden",
    icon: Shield,
    roles: ["faculty", "warden"],
  },
  { id: "worker", label: "Worker", icon: Wrench, roles: ["worker"] },
  { id: "visitor", label: "Visitor", icon: UserCheck, roles: ["visitor"] },
];

export const Register = () => {
  const navigate = useNavigate();

  // Preset or custom multi-role mode
  const [selectedPreset, setSelectedPreset] = useState("student");
  const [isMultiRoleCustom, setIsMultiRoleCustom] = useState(false);
  const [activeRoles, setActiveRoles] = useState(["student"]);

  // Account identity
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Reference options loaded from backend
  const [departments, setDepartments] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [locations, setLocations] = useState([]);

  // Student specific details
  const [studentId, setStudentId] = useState("");
  const [studentCourse, setStudentCourse] = useState("");
  const [studentDepartmentId, setStudentDepartmentId] = useState("");
  const [studentSemester, setStudentSemester] = useState("1");
  const [studentBatch, setStudentBatch] = useState("2024-2028");
  const [studentHostelId, setStudentHostelId] = useState("");
  const [studentRoomNumber, setStudentRoomNumber] = useState("");

  // Faculty specific details
  const [facultyId, setFacultyId] = useState("");
  const [facultyDepartmentId, setFacultyDepartmentId] = useState("");
  const [facultyDesignation, setFacultyDesignation] = useState(
    "Assistant Professor",
  );
  const [facultyCourses, setFacultyCourses] = useState("");
  const [facultyAssignedStudents, setFacultyAssignedStudents] = useState("");

  // Warden specific details (Faculty + Warden or Warden)
  const [wardenHostelId, setWardenHostelId] = useState("");
  const [wardenHostelBlock, setWardenHostelBlock] = useState("");
  const [wardenResponsibilities, setWardenResponsibilities] = useState("");

  // Worker specific details
  const [workerId, setWorkerId] = useState("");
  const [workerJobType, setWorkerJobType] = useState("Maintenance");
  const [workerDepartmentId, setWorkerDepartmentId] = useState("");
  const [workerAssignedLocationId, setWorkerAssignedLocationId] = useState("");
  const [workerWorkArea, setWorkerWorkArea] = useState("");
  const [workerShift, setWorkerShift] = useState(
    "General Shift (09:00 - 17:00)",
  );

  // Visitor specific details
  const [visitorGovIdType, setVisitorGovIdType] = useState("Aadhaar");
  const [visitorGovIdNumber, setVisitorGovIdNumber] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("");
  const [hostPerson, setHostPerson] = useState("");
  const [hostContact, setHostContact] = useState("");
  const [visitDurationDays, setVisitDurationDays] = useState("1");
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);

  // Request & UI states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationResult, setRegistrationResult] = useState(null);
  const [formReady, setFormReady] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState("terms");
  const [biometricConsent, setBiometricConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);

  // Load reference catalogs on mount
  useEffect(() => {
    const timer = setTimeout(() => setFormReady(true), 50);
    Promise.all([
      registrationService.getDepartments(),
      registrationService.getHostels(),
      registrationService.getLocations(),
    ])
      .then(([deptList, hostelList, locList]) => {
        setDepartments(deptList || []);
        setHostels(hostelList || []);
        setLocations(locList || []);
        if (locList && locList.length > 0 && selectedLocationIds.length === 0) {
          setSelectedLocationIds([locList[0].id]);
        }
      })
      .catch((err) => {
        console.error("Failed to load registration reference data:", err);
      });
    return () => clearTimeout(timer);
  }, []);

  // Handle Preset Selection
  const handleSelectPreset = (presetId) => {
    setSelectedPreset(presetId);
    setIsMultiRoleCustom(false);
    const preset = ROLE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setActiveRoles(preset.roles);
    }
  };

  // Handle Multi-Role Checkbox Toggle
  const toggleRole = (roleKey) => {
    setIsMultiRoleCustom(true);
    let updated = [];
    if (activeRoles.includes(roleKey)) {
      if (activeRoles.length === 1) return; // Keep at least one role
      updated = activeRoles.filter((r) => r !== roleKey);
    } else {
      updated = [...activeRoles, roleKey];
    }
    setActiveRoles(updated);
    // Check if updated matches any preset
    const match = ROLE_PRESETS.find(
      (p) =>
        p.roles.length === updated.length &&
        p.roles.every((r) => updated.includes(r)),
    );
    setSelectedPreset(match ? match.id : "custom");
  };

  const hasStudent = activeRoles.includes("student");
  const hasFaculty = activeRoles.includes("faculty");
  const hasWarden = activeRoles.includes("warden");
  const hasWorker = activeRoles.includes("worker");
  const hasVisitor = activeRoles.includes("visitor");

  // Password validation regex
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,128}$/;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!passwordRegex.test(password)) {
      setError(
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
      );
      return;
    }

    if (!biometricConsent) {
      setError(
        "You must provide explicit biometric consent for campus turnstile identity verification.",
      );
      return;
    }

    if (!termsConsent) {
      setError(
        "You must accept the Campus Terms & Conditions to complete registration.",
      );
      return;
    }

    if (activeRoles.length === 0) {
      setError("Please select at least one role for registration.");
      return;
    }

    setIsLoading(true);

    // Build payload according to selected roles
    const payload = {
      role: activeRoles[0],
      roles: activeRoles,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
    };

    // Role-specific field population
    if (hasStudent) {
      payload.student_id = studentId.trim();
      payload.roll_number = studentId.trim();
      payload.course = studentCourse.trim();
      payload.department_id = studentDepartmentId || null;
      payload.semester = studentSemester;
      payload.batch = studentBatch.trim();
      payload.hostel_id = studentHostelId || null;
      payload.room_number = studentRoomNumber.trim();
    }

    if (hasFaculty) {
      payload.faculty_id = facultyId.trim();
      payload.employee_id = facultyId.trim();
      payload.department_id =
        facultyDepartmentId || studentDepartmentId || null;
      payload.designation = facultyDesignation.trim();
      payload.courses = facultyCourses.trim();
      payload.assigned_students = facultyAssignedStudents.trim();
    }

    if (hasWarden) {
      payload.hostel_id = wardenHostelId || studentHostelId || null;
      payload.hostel_block = wardenHostelBlock.trim();
      payload.warden_responsibilities =
        wardenResponsibilities.trim() ||
        "Hostel Caretaker & Gate Pass Approver";
    }

    if (hasWorker) {
      payload.worker_id = workerId.trim();
      payload.employee_id = workerId.trim();
      payload.job_type = workerJobType.trim();
      payload.department_id = workerDepartmentId || null;
      payload.assigned_location_id = workerAssignedLocationId || null;
      payload.work_area = workerWorkArea.trim();
      payload.shift = workerShift.trim();
    }

    if (hasVisitor) {
      payload.gov_id_type = visitorGovIdType;
      payload.gov_id_number = visitorGovIdNumber.trim();
      payload.visit_purpose = visitPurpose.trim();
      payload.host_person = hostPerson.trim();
      payload.host_contact = hostContact.trim();
      payload.visit_duration_days = parseInt(visitDurationDays, 10) || 1;
      payload.allowed_location_ids = selectedLocationIds;
    }

    try {
      const result = await registrationService.register(payload);
      setRegistrationResult(result);
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.message ||
        "Registration failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLocationSelection = (locId) => {
    setSelectedLocationIds((prev) =>
      prev.includes(locId)
        ? prev.filter((id) => id !== locId)
        : [...prev, locId],
    );
  };

  return (
    <div className={`login-view ${formReady ? "is-ready" : ""}`}>
      {/* ── Registration Success State ── */}
      {registrationResult ? (
        <div className="success-state text-center flex flex-col items-center justify-center py-6 animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
            <CheckCircle size={40} />
          </div>
          <h2 className="login-title mb-1 text-slate-900 font-extrabold text-xl">
            {registrationResult.is_existing_user
              ? "Role Added to Existing Profile!"
              : "Registration Successful!"}
          </h2>
          <p className="text-xs text-slate-600 max-w-sm mb-4">
            {registrationResult.is_existing_user
              ? `Your account (${registrationResult.email}) was updated with new role access without duplicate profiles.`
              : `Your OCOC campus digital identity has been created for ${registrationResult.email}.`}
          </p>

          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-left text-xs space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Active Roles
              </span>
              <div className="flex flex-wrap gap-1">
                {(registrationResult.roles || [registrationResult.role]).map(
                  (r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#f5bd19]/20 text-[#0a2342] border border-[#f5bd19]/50 uppercase"
                    >
                      {r}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Assigned Dashboard
              </span>
              <span className="font-bold text-slate-800">
                {registrationResult.dashboard_name ||
                  registrationResult.dashboard_path ||
                  "Personal Workspace"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Access Route
              </span>
              <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                {registrationResult.dashboard_path || "/dashboard"}
              </code>
            </div>
          </div>

          {/* Onboarding Lifecycle Journey */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 text-left text-xs space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1">
              Onboarding Process Progression
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>1. Digital ID Created</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>2. Biometric Vector Enrolled</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                <Clock size={13} className="text-amber-600" />
                <span>3. Collect RFID Card</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <ShieldCheck size={13} className="text-slate-400" />
                <span>4. Gate Turnstile Active</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="btn btn-primary w-full flex items-center justify-center gap-2 py-2.5 font-bold"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="auth-tabs">
            <Link to="/login" className="auth-tab">
              Sign In
            </Link>
            <Link to="/register" className="auth-tab active">
              Sign Up
            </Link>
          </div>

          <div className="login-welcome mb-3">
            <h2 id="login-heading" className="login-title">
              Role-Based Campus Registration
            </h2>
            <p className="login-subtitle">
              Select your role(s) to collect details & assign verified campus
              permissions
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div id="login-error" className="login-error mb-3" role="alert">
              <div className="login-error-bar"></div>
              <span>{error}</span>
            </div>
          )}

          <form
            id="register-form"
            onSubmit={handleRegister}
            className="login-form space-y-4"
          >
            {/* ── Role Preset Selection ── */}
            <div className="form-group mb-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="form-label text-xs font-bold text-slate-700">
                  Select Role / Preset
                </label>
                <button
                  type="button"
                  onClick={() => setIsMultiRoleCustom(!isMultiRoleCustom)}
                  className="text-[11px] font-extrabold text-[#b87800] hover:text-[#d99e00] flex items-center gap-1 transition"
                >
                  <Layers size={13} />
                  <span>
                    {isMultiRoleCustom
                      ? "Hide Custom Multi-Role"
                      : "Customize Multiple Roles"}
                  </span>
                </button>
              </div>

              {/* Preset Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {ROLE_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isActive =
                    !isMultiRoleCustom && selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-semibold transition ${
                        isActive
                          ? "border-[#d99e00] bg-gradient-to-r from-[#f5bd19]/20 to-[#f5bd19]/10 text-[#0a2342] font-bold shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon
                        size={16}
                        className={
                          isActive ? "text-[#b87800]" : "text-slate-400"
                        }
                      />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Multi-Role Selector (Expandable) */}
              {isMultiRoleCustom && (
                <div className="mt-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2 animate-scale-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <Sparkles size={13} className="text-amber-600" />{" "}
                      Multi-Role Assignment Active
                    </span>
                    <span className="text-[10px] text-amber-700">
                      One profile, multiple permissions
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "student", label: "Student" },
                      { key: "faculty", label: "Faculty" },
                      { key: "warden", label: "Warden" },
                      { key: "worker", label: "Worker" },
                      { key: "visitor", label: "Visitor" },
                    ].map(({ key, label }) => {
                      const checked = activeRoles.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleRole(key)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition border ${
                            checked
                              ? "bg-[#0a2342] text-amber-400 border-[#0a2342]"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {checked ? (
                            <CheckSquare size={13} />
                          ) : (
                            <Square size={13} />
                          )}
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable Fields Container */}
            <div className="scrollable-fields">
              {/* ── 1. Common Identity Details ── */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1">
                  1. Account Identity & Credentials
                </span>

                <div className="form-group">
                  <label className="form-label text-xs">Full Name *</label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      type="text"
                      required
                      className="form-input pl-9 text-xs"
                      placeholder="e.g. Dr. Rajesh Verma or Ananya Sharma"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-xs">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        required
                        className="form-input pl-9 text-xs"
                        placeholder="user@ococ.edu"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs">Phone Number *</label>
                    <div className="relative">
                      <Phone
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        type="tel"
                        required
                        className="form-input pl-9 text-xs"
                        placeholder="10-digit mobile"
                        pattern="[0-9]{10,15}"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-xs">Password *</label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        required
                        className="form-input pl-9 text-xs"
                        placeholder="Min 8 chars"
                        minLength={8}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        className="field-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <input
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        required
                        className="form-input pl-9 text-xs"
                        placeholder="Re-type password"
                        minLength={8}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* Password Strength Meter & Complexity Checklist */}
                <PasswordStrengthMeter
                  password={password}
                  confirmPassword={confirmPassword}
                />
              </div>

              {/* ── 2. Student Role Details ── */}
              {hasStudent && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 shadow-2xs space-y-3 animate-scale-in">
                  <div className="flex items-center gap-1.5 text-blue-900 border-b border-blue-200 pb-1">
                    <GraduationCap size={16} className="text-blue-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      Student Academic Profile
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">
                        Student ID / Roll Number *
                      </label>
                      <div className="relative">
                        <Hash
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          type="text"
                          required
                          className="form-input pl-9 text-xs font-mono"
                          placeholder="e.g. CS2024001"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Enrolled Course *
                      </label>
                      <input
                        value={studentCourse}
                        onChange={(e) => setStudentCourse(e.target.value)}
                        type="text"
                        required
                        className="form-input text-xs"
                        placeholder="e.g. B.Tech Computer Science"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="form-group">
                      <label className="form-label text-xs">Department *</label>
                      <select
                        value={studentDepartmentId}
                        onChange={(e) => setStudentDepartmentId(e.target.value)}
                        required
                        className="form-input form-select text-xs"
                        disabled={isLoading || !departments.length}
                      >
                        <option value="">Select dept...</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">Semester *</label>
                      <select
                        value={studentSemester}
                        onChange={(e) => setStudentSemester(e.target.value)}
                        className="form-input form-select text-xs"
                        disabled={isLoading}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={String(s)}>
                            Semester {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">Batch *</label>
                      <input
                        value={studentBatch}
                        onChange={(e) => setStudentBatch(e.target.value)}
                        type="text"
                        required
                        className="form-input text-xs"
                        placeholder="2024-2028"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-blue-100">
                    <div className="form-group">
                      <label className="form-label text-xs">Hostel</label>
                      <div className="relative">
                        <Building
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <select
                          value={studentHostelId}
                          onChange={(e) => setStudentHostelId(e.target.value)}
                          className="form-input form-select pl-9 text-xs"
                          disabled={isLoading}
                        >
                          <option value="">Day scholar / No hostel</option>
                          {hostels.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">Room Number</label>
                      <div className="relative">
                        <MapPin
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={studentRoomNumber}
                          onChange={(e) => setStudentRoomNumber(e.target.value)}
                          type="text"
                          className="form-input pl-9 text-xs"
                          placeholder="e.g. Room 204"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 3. Faculty Role Details ── */}
              {hasFaculty && (
                <div className="p-3.5 rounded-xl border border-violet-200 bg-violet-50/40 shadow-2xs space-y-3 animate-scale-in">
                  <div className="flex items-center gap-1.5 text-violet-900 border-b border-violet-200 pb-1">
                    <Award size={16} className="text-violet-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      Faculty & Academic Details
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">Faculty ID *</label>
                      <div className="relative">
                        <Briefcase
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={facultyId}
                          onChange={(e) => setFacultyId(e.target.value)}
                          type="text"
                          required
                          className="form-input pl-9 text-xs font-mono"
                          placeholder="e.g. FAC-2024"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">Department *</label>
                      <div className="relative">
                        <Building
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <select
                          value={facultyDepartmentId}
                          onChange={(e) =>
                            setFacultyDepartmentId(e.target.value)
                          }
                          required
                          className="form-input form-select pl-9 text-xs"
                          disabled={isLoading || !departments.length}
                        >
                          <option value="">Select department...</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs">Designation *</label>
                    <input
                      value={facultyDesignation}
                      onChange={(e) => setFacultyDesignation(e.target.value)}
                      type="text"
                      required
                      className="form-input text-xs"
                      placeholder="e.g. Associate Professor, HOD"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">
                        Courses / Subjects *
                      </label>
                      <input
                        value={facultyCourses}
                        onChange={(e) => setFacultyCourses(e.target.value)}
                        type="text"
                        required
                        className="form-input text-xs"
                        placeholder="e.g. CS101, Data Structures, AI"
                        disabled={isLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Assigned Students
                      </label>
                      <input
                        value={facultyAssignedStudents}
                        onChange={(e) =>
                          setFacultyAssignedStudents(e.target.value)
                        }
                        type="text"
                        className="form-input text-xs"
                        placeholder="e.g. 25 Advisees (Batch 2024)"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 4. Warden Role Details (Faculty + Warden or Warden) ── */}
              {hasWarden && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs space-y-3 animate-scale-in">
                  <div className="flex items-center gap-1.5 text-amber-900 border-b border-amber-200 pb-1">
                    <Shield size={16} className="text-amber-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      Hostel Warden Administration
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">
                        Assigned Hostel *
                      </label>
                      <div className="relative">
                        <Building
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <select
                          value={wardenHostelId}
                          onChange={(e) => setWardenHostelId(e.target.value)}
                          required
                          className="form-input form-select pl-9 text-xs"
                          disabled={isLoading || !hostels.length}
                        >
                          <option value="">Select hostel...</option>
                          {hostels.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Hostel Block / Location *
                      </label>
                      <div className="relative">
                        <MapPin
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={wardenHostelBlock}
                          onChange={(e) => setWardenHostelBlock(e.target.value)}
                          type="text"
                          required
                          className="form-input pl-9 text-xs"
                          placeholder="e.g. Block A - Senior Wing"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs">
                      Warden Responsibilities
                    </label>
                    <input
                      value={wardenResponsibilities}
                      onChange={(e) =>
                        setWardenResponsibilities(e.target.value)
                      }
                      type="text"
                      className="form-input text-xs"
                      placeholder="e.g. Hostel Caretaker, Curfew & Gate Pass Approver"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {/* ── 5. Worker Role Details ── */}
              {hasWorker && (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs space-y-3 animate-scale-in">
                  <div className="flex items-center gap-1.5 text-emerald-900 border-b border-emerald-200 pb-1">
                    <Wrench size={16} className="text-emerald-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      Campus Worker & Operations
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">Worker ID *</label>
                      <div className="relative">
                        <Hash
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={workerId}
                          onChange={(e) => setWorkerId(e.target.value)}
                          type="text"
                          required
                          className="form-input pl-9 text-xs font-mono"
                          placeholder="e.g. WRK-108"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Job Type / Trade *
                      </label>
                      <select
                        value={workerJobType}
                        onChange={(e) => setWorkerJobType(e.target.value)}
                        className="form-input form-select text-xs"
                        disabled={isLoading}
                      >
                        <option value="Electrician">Electrician</option>
                        <option value="HVAC / Air Conditioning">
                          HVAC / Air Conditioning
                        </option>
                        <option value="Plumber">Plumbing / Water</option>
                        <option value="Housekeeping / Cleaning">
                          Housekeeping / Cleaning
                        </option>
                        <option value="Security Personnel">
                          Security Personnel
                        </option>
                        <option value="Gardener">Gardener / Grounds</option>
                        <option value="Carpenter">Carpenter</option>
                        <option value="IT Support">IT & Network Tech</option>
                        <option value="General Maintenance">
                          General Maintenance
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">Department</label>
                      <select
                        value={workerDepartmentId}
                        onChange={(e) => setWorkerDepartmentId(e.target.value)}
                        className="form-input form-select text-xs"
                        disabled={isLoading}
                      >
                        <option value="">Estate & Campus Maintenance</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Assigned Campus / Building *
                      </label>
                      <div className="relative">
                        <Building
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <select
                          value={workerAssignedLocationId}
                          onChange={(e) =>
                            setWorkerAssignedLocationId(e.target.value)
                          }
                          required
                          className="form-input form-select pl-9 text-xs"
                          disabled={isLoading || !locations.length}
                        >
                          <option value="">
                            Select location / building...
                          </option>
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name} ({loc.type || "Zone"})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">Work Area *</label>
                      <div className="relative">
                        <MapPin
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={workerWorkArea}
                          onChange={(e) => setWorkerWorkArea(e.target.value)}
                          type="text"
                          required
                          className="form-input pl-9 text-xs"
                          placeholder="e.g. Ground Floor & Server Room"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Assigned Shift *
                      </label>
                      <div className="relative">
                        <Clock
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <select
                          value={workerShift}
                          onChange={(e) => setWorkerShift(e.target.value)}
                          className="form-input form-select pl-9 text-xs"
                          disabled={isLoading}
                        >
                          <option value="Morning Shift (06:00 - 14:00)">
                            Morning Shift (06:00 - 14:00)
                          </option>
                          <option value="General Shift (09:00 - 17:00)">
                            General Shift (09:00 - 17:00)
                          </option>
                          <option value="Evening Shift (14:00 - 22:00)">
                            Evening Shift (14:00 - 22:00)
                          </option>
                          <option value="Night Shift (22:00 - 06:00)">
                            Night Shift (22:00 - 06:00)
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 6. Visitor Role Details ── */}
              {hasVisitor && (
                <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/40 shadow-2xs space-y-3 animate-scale-in">
                  <div className="flex items-center gap-1.5 text-orange-900 border-b border-orange-200 pb-1">
                    <UserCheck size={16} className="text-orange-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">
                      Visitor Pass & Access Boundaries
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">
                        Government ID Type *
                      </label>
                      <div className="relative">
                        <FileText
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <select
                          value={visitorGovIdType}
                          onChange={(e) => setVisitorGovIdType(e.target.value)}
                          className="form-input form-select pl-9 text-xs"
                          disabled={isLoading}
                        >
                          <option value="Aadhaar">Aadhaar Card</option>
                          <option value="PAN">PAN Card</option>
                          <option value="Passport">Passport</option>
                          <option value="Driving License">
                            Driving License
                          </option>
                          <option value="Voter ID">Voter ID</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Government ID Number *
                      </label>
                      <div className="relative">
                        <Hash
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={visitorGovIdNumber}
                          onChange={(e) =>
                            setVisitorGovIdNumber(e.target.value)
                          }
                          type="text"
                          required
                          className="form-input pl-9 text-xs font-mono"
                          placeholder="e.g. 5678 1234 9012"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">
                        Host / Person to Visit *
                      </label>
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={hostPerson}
                          onChange={(e) => setHostPerson(e.target.value)}
                          type="text"
                          required
                          className="form-input pl-9 text-xs"
                          placeholder="e.g. Dr. Rajesh Verma"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Host Contact (Phone/Email) *
                      </label>
                      <div className="relative">
                        <Phone
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <input
                          value={hostContact}
                          onChange={(e) => setHostContact(e.target.value)}
                          type="text"
                          required
                          className="form-input pl-9 text-xs"
                          placeholder="Host email or phone"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xs">
                        Purpose of Visit *
                      </label>
                      <input
                        value={visitPurpose}
                        onChange={(e) => setVisitPurpose(e.target.value)}
                        type="text"
                        required
                        className="form-input text-xs"
                        placeholder="e.g. Guest Lecture, Meeting, Campus Tour"
                        disabled={isLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xs">
                        Visit Validity / Duration *
                      </label>
                      <div className="relative">
                        <Calendar
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                        />
                        <select
                          value={visitDurationDays}
                          onChange={(e) => setVisitDurationDays(e.target.value)}
                          className="form-input form-select pl-9 text-xs"
                          disabled={isLoading}
                        >
                          <option value="1">1 Day Pass (Valid Today)</option>
                          <option value="2">2 Days Pass</option>
                          <option value="3">3 Days Pass</option>
                          <option value="7">7 Days Pass</option>
                          <option value="14">14 Days Pass</option>
                          <option value="30">30 Days Pass</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Allowed Campus Locations */}
                  <div className="form-group">
                    <label className="form-label text-xs">
                      Allowed Campus Locations *
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-orange-200 bg-white max-h-24 overflow-y-auto">
                      {locations.map((loc) => {
                        const isChecked = selectedLocationIds.includes(loc.id);
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => toggleLocationSelection(loc.id)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                              isChecked
                                ? "bg-orange-500 text-white border-orange-600 shadow-2xs"
                                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            {isChecked ? "✓ " : "+ "}
                            {loc.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Biometric Trust & Granular Compliance Section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3 text-xs mt-3">
              {/* Biometric Neural Vector Assurance */}
              <div className="flex items-start gap-2 text-[11px] text-slate-600 border-b border-slate-200/80 pb-2.5">
                <Cpu size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                <p className="leading-tight">
                  <strong className="text-slate-800">
                    Biometric Privacy Safeguard:
                  </strong>{" "}
                  OCOC generates high-dimensional mathematical vector embeddings
                  via the FRECO neural engine. Raw surveillance video is never
                  stored or broadcast.
                </p>
              </div>

              {/* Granular Consent 1: Explicit Biometric Consent (DPDP Act) */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  required
                  checked={biometricConsent}
                  onChange={(e) => setBiometricConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0a2342] focus:ring-[#f5bd19]"
                />
                <span className="text-[11px] text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                  I give explicit, informed consent for facial feature vector
                  generation and storage for automated campus turnstile
                  clearance and attendance in accordance with the{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLegalModalTab("privacy");
                      setLegalModalOpen(true);
                    }}
                    className="underline text-blue-600 hover:text-blue-800 font-bold inline"
                  >
                    Campus Biometric &amp; Privacy Policy
                  </button>
                  .
                </span>
              </label>

              {/* Granular Consent 2: Terms & Conditions */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  required
                  checked={termsConsent}
                  onChange={(e) => setTermsConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0a2342] focus:ring-[#f5bd19]"
                />
                <span className="text-[11px] text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                  I accept the{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLegalModalTab("terms");
                      setLegalModalOpen(true);
                    }}
                    className="underline text-blue-600 hover:text-blue-800 font-bold inline"
                  >
                    Campus Terms &amp; Conditions
                  </button>{" "}
                  and agree to abide by university conduct, RFID smart card
                  custody rules, and gate movement regulations.
                </span>
              </label>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              className="btn btn-primary w-full mt-3 flex items-center justify-center gap-2 py-2.5 font-bold"
              disabled={isLoading}
            >
              {!isLoading ? (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Registering Identity...</span>
                </>
              )}
            </button>

            <div className="login-footer text-center pt-2 border-t border-slate-100 text-xs">
              <span className="text-muted">
                Already registered or need to sign in?
              </span>
              <Link to="/login" className="field-link ml-1 font-bold">
                Sign In
              </Link>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "8px",
                fontSize: "10px",
                color: "#8795a8",
              }}
            >
              <Shield size={12} style={{ color: "#8795a8" }} />
              <span>Secured by Keycloak SSO · TLS Encrypted</span>
            </div>
          </form>
        </>
      )}

      {/* Interactive Legal & Biometric Policy Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalModalTab}
      />
    </div>
  );
};

export default Register;
