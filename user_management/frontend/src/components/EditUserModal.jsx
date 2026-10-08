import React, { useState, useEffect } from "react";
import userService from "@/services/userService";
import rfidService from "@/services/rfidService";
import { registerPerson } from "@/services/frecoService";
import FaceOvalCamera from "@/components/FaceOvalCamera";
import PassportPhotoCapture from "@/components/PassportPhotoCapture";
import AcademicBatchSelect from "@/components/common/AcademicBatchSelect";
import {
  BookOpen,
  Briefcase,
  BuildingOffice,
  Camera,
  CheckCircle,
  CreditCard,
  Envelope,
  FloppyDisk,
  Hash,
  House,
  MapPin,
  Phone,
  Scan,
  ShieldCheck,
  SpinnerGap,
  User as UserIcon,
  UserCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

const INITIAL_POSES = [
  {
    key: "center",
    label: "Center",
    hint: "Look straight at the camera",
    file: null,
    preview: null,
  },
  {
    key: "left",
    label: "Left",
    hint: "Turn slightly to the left",
    file: null,
    preview: null,
  },
  {
    key: "right",
    label: "Right",
    hint: "Turn slightly to the right",
    file: null,
    preview: null,
  },
  {
    key: "chin_up",
    label: "Chin Up",
    hint: "Tilt your chin slightly up",
    file: null,
    preview: null,
  },
  {
    key: "chin_down",
    label: "Chin Down",
    hint: "Tilt your chin slightly down",
    file: null,
    preview: null,
  },
];

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const toCenteredJpeg = async (file) => {
  const dataUrl = await toDataUrl(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      const sourceAspect = sourceWidth / sourceHeight;
      const targetAspect = 3 / 4;
      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;

      if (sourceAspect > targetAspect) {
        cropWidth = sourceHeight * targetAspect;
      } else {
        cropHeight = sourceWidth / targetAspect;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 450;
      canvas.height = 600;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Unable to process the captured photo."));
        return;
      }
      context.drawImage(
        image,
        (sourceWidth - cropWidth) / 2,
        (sourceHeight - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => reject(new Error("Unable to load the captured photo."));
    image.src = dataUrl;
  });
};

export const EditUserModal = ({ user, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'photo' | 'face' | 'rfid'

  // Master form state
  const [formData, setFormData] = useState({
    email: user.email || "",
    phone: user.phone || "",
    profile: {
      ...user.profile,
      full_name: user.profile?.full_name || "",
      roll_number: user.profile?.roll_number || "",
      employee_id: user.profile?.employee_id || "",
      school: user.profile?.school || "",
      department: user.profile?.department || "",
      department_id: user.profile?.department_id || null,
      course: user.profile?.course || "",
      semester: user.profile?.semester || "",
      batch: user.profile?.batch || "",
      hostel_flag: user.profile?.hostel_flag || false,
      hostel_id: user.profile?.hostel_id || "",
      room_number: user.profile?.room_number || "",
      guardian_contact: user.profile?.guardian_contact || "",
      emergency_contact: user.profile?.emergency_contact || "",
      photo_reference: user.profile?.photo_reference || "",
      designation: user.profile?.designation || "",
      job_type: user.profile?.job_type || "",
      work_area: user.profile?.work_area || "",
      shift: user.profile?.shift || "",
      hostel_block: user.profile?.hostel_block || "",
      warden_responsibilities: user.profile?.warden_responsibilities || "",
      visit_purpose: user.profile?.visit_purpose || "",
      host_person: user.profile?.host_person || "",
      host_contact: user.profile?.host_contact || "",
    },
  });

  const [dbDepartments, setDbDepartments] = useState([]);
  const [dbHostels, setDbHostels] = useState([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Keyboard close
  useEffect(() => {
    const onKeydown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [onClose]);

  // Fetch departments and hostels
  useEffect(() => {
    userService.getDepartments().then((data) => setDbDepartments(data || [])).catch(console.error);
    userService.getHostels().then((data) => setDbHostels(data || [])).catch(console.error);
  }, []);

  const updateProfileField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value,
      },
    }));
  };

  const updateDepartment = (departmentName) => {
    const department = dbDepartments.find((item) => item.name === departmentName);
    setFormData((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        department: departmentName,
        department_id: department?.id || null,
      },
    }));
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ─── Save Profile Handler ───
  const handleSaveProfile = async () => {
    setProfileError("");
    setIsProfileLoading(true);
    try {
      const payload = {
        phone: formData.phone,
        profile: {
          ...formData.profile,
          hostel_id: formData.profile.hostel_id || null,
        },
      };
      const res = await userService.update(user.id, payload);
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
        onSaved?.(res);
      }, 1000);
    } catch (e) {
      setProfileError(e.response?.data?.error?.message || e.message || "Update failed");
    } finally {
      setIsProfileLoading(false);
    }
  };

  // ─── Face Tab State ───
  const [poses, setPoses] = useState(INITIAL_POSES);
  const [currentPoseIdx, setCurrentPoseIdx] = useState(0);
  const [isFaceLoading, setIsFaceLoading] = useState(false);
  const [faceError, setFaceError] = useState("");
  const [faceSuccess, setFaceSuccess] = useState(false);

  const currentPose = poses[currentPoseIdx];
  const capturedCount = poses.filter((p) => p.file !== null).length;

  const handleAutoCapture = (file) => {
    const updated = [...poses];
    updated[currentPoseIdx] = {
      ...updated[currentPoseIdx],
      file,
      preview: URL.createObjectURL(file),
    };
    setPoses(updated);

    // Advance to next uncaptured pose
    const next = updated.findIndex((p, i) => i > currentPoseIdx && !p.file);
    if (next !== -1) {
      setCurrentPoseIdx(next);
    }
  };

  // ─── Face Enrollment & Sync with photo_reference ───
  const handleRegisterFace = async () => {
    const uncaptured = poses.filter((p) => !p.file);
    if (uncaptured.length > 0) {
      setFaceError(
        `Please capture all 5 poses (${uncaptured.map((p) => p.label).join(", ")} missing)`,
      );
      return;
    }

    setFaceError("");
    setIsFaceLoading(true);
    try {
      // 1. Send all 5 poses to FRECO for biometric embedding extraction
      await registerPerson({
        externalId: user.id,
        name: formData.profile?.full_name || user.profile?.full_name || user.email,
        personType: user.user_type,
        email: user.email,
        images: poses.map((p) => p.file),
        poses: poses.map((p) => p.key),
      });

      // 2. Synchronize front/center pose as the primary photo_reference in user_management
      const centerPose = poses.find((p) => p.key === "center") || poses[0];
      let centerDataUrl = null;
      if (centerPose && centerPose.file) {
        centerDataUrl = await toCenteredJpeg(centerPose.file);
      }

      let updatedUser = null;
      if (centerDataUrl) {
        const updatedProfile = {
          ...formData.profile,
          photo_reference: centerDataUrl,
        };
        const res = await userService.update(user.id, {
          phone: formData.phone,
          profile: updatedProfile,
        });
        setFormData((prev) => ({
          ...prev,
          profile: updatedProfile,
        }));
        updatedUser = res;
      }

      setFaceSuccess(true);
      setTimeout(() => {
        setFaceSuccess(false);
        onSaved?.(updatedUser);
      }, 1200);
    } catch (e) {
      setFaceError(
        e.response?.data?.detail || e.message || "Face enrollment failed",
      );
    } finally {
      setIsFaceLoading(false);
    }
  };

  // ─── RFID Tab State ───
  const [rfidUid, setRfidUid] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isRfidLoading, setIsRfidLoading] = useState(false);
  const [rfidError, setRfidError] = useState("");
  const [rfidSuccess, setRfidSuccess] = useState(false);

  const handleScanRFID = async () => {
    setRfidError("");
    setIsScanning(true);
    try {
      const result = await rfidService.scan();
      setRfidUid(result.uid);
    } catch (e) {
      setRfidError(e.response?.data?.error?.message || "RFID Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAssignRFID = async () => {
    if (!rfidUid) return;
    setRfidError("");
    setIsRfidLoading(true);
    try {
      await userService.enrollRFID(user.id, rfidUid);
      await userService.issueCard(user.id);
      setRfidSuccess(true);
      setTimeout(() => {
        setRfidSuccess(false);
        onSaved?.();
      }, 1000);
    } catch (e) {
      setRfidError(
        e.response?.data?.error?.message || "Failed to assign RFID card",
      );
    } finally {
      setIsRfidLoading(false);
    }
  };

  const userType = (user.user_type || "student").toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        className="fixed inset-0 bg-[#0a2342]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0a2342] to-[#163a66] text-[#f5bd19] flex items-center justify-center font-black text-lg shadow-xs overflow-hidden">
              {formData.profile.photo_reference ? (
                <img
                  src={formData.profile.photo_reference}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (formData.profile.full_name || user.email).charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {formData.profile.full_name || "Edit Member Profile"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {userType}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {user.email} · ID: {user.id.slice(0, 8)}…
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition icon-touch"
            aria-label="Close dialog"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-slate-50/70 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === "profile"
              ? "border-[#0a2342] text-[#0a2342] font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <UserCircle size={16} weight={activeTab === "profile" ? "fill" : "bold"} />
            <span>Profile &amp; Demographics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("photo")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === "photo"
              ? "border-[#0a2342] text-[#0a2342] font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Camera size={16} weight={activeTab === "photo" ? "fill" : "bold"} />
            <span>Passport Photo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("face")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === "face"
              ? "border-[#0a2342] text-[#0a2342] font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Scan size={16} weight={activeTab === "face" ? "fill" : "bold"} />
            <span>Face Biometrics (5 Poses)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rfid")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === "rfid"
              ? "border-[#0a2342] text-[#0a2342] font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <CreditCard size={16} weight={activeTab === "rfid" ? "fill" : "bold"} />
            <span>RFID Credential</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ════════════════════ PROFILE TAB ════════════════════ */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-fade-in">
              {/* Section 1: Personal Information */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0a2342] border-b border-slate-100 pb-2">
                  <UserCircle size={16} className="text-[#f5bd19]" weight="fill" />
                  <span>Personal Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Legal Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.profile.full_name}
                      onChange={(e) => updateProfileField("full_name", e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                      placeholder="Name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address (Keycloak OIDC Username)
                    </label>
                    <div className="relative">
                      <Envelope size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        disabled
                        value={formData.email}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 text-sm text-slate-500 font-mono cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Primary Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 pl-10 pr-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="e.g. +91"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Emergency Contact Phone
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={formData.profile.emergency_contact || ""}
                        onChange={(e) => updateProfileField("emergency_contact", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 pl-10 pr-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="e.g. +91"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Academic / Employment Information */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0a2342] border-b border-slate-100 pb-2">
                  <BookOpen size={16} className="text-[#f5bd19]" weight="fill" />
                  <span>
                    {userType === "student"
                      ? "Academic Enrollment Details"
                      : "Employment & Institutional Assignment"}
                  </span>
                </div>

                {userType === "student" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Scholar / Roll Number
                      </label>
                      <div className="relative">
                        <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={formData.profile.roll_number || ""}
                          onChange={(e) => updateProfileField("roll_number", e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 pl-10 pr-3.5 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                          placeholder="id"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Department
                      </label>
                      <select
                        value={formData.profile.department || ""}
                        onChange={(e) => updateDepartment(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                      >
                        <option value="">Select Department...</option>
                        {dbDepartments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Course / Programme
                      </label>
                      <input
                        type="text"
                        value={formData.profile.course || ""}
                        onChange={(e) => updateProfileField("course", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="program name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Current Semester
                      </label>
                      <select
                        value={formData.profile.semester || ""}
                        onChange={(e) => updateProfileField("semester", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                      >
                        <option value="">Select Semester...</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={String(s)}>
                            Semester {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <AcademicBatchSelect
                        value={formData.profile.batch || ""}
                        onChange={(batchStr) => updateProfileField("batch", batchStr)}
                      />
                    </div>
                  </div>
                )}

                {userType === "faculty" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Employee ID
                      </label>
                      <input
                        type="text"
                        value={formData.profile.employee_id || ""}
                        onChange={(e) => updateProfileField("employee_id", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="id"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Designation / Title
                      </label>
                      <input
                        type="text"
                        value={formData.profile.designation || ""}
                        onChange={(e) => updateProfileField("designation", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="text"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Department
                      </label>
                      <select
                        value={formData.profile.department || ""}
                        onChange={(e) => updateDepartment(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                      >
                        <option value="">Select Department...</option>
                        {dbDepartments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {userType === "worker" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Employee ID
                      </label>
                      <input
                        type="text"
                        value={formData.profile.employee_id || ""}
                        onChange={(e) => updateProfileField("employee_id", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder=""
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Job Type / Role
                      </label>
                      <input
                        type="text"
                        value={formData.profile.job_type || ""}
                        onChange={(e) => updateProfileField("job_type", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="e.g. Electrician, Security, Maintenance"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Assigned Work Area
                      </label>
                      <input
                        type="text"
                        value={formData.profile.work_area || ""}
                        onChange={(e) => updateProfileField("work_area", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="e.g. Campus Zone A"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Work Shift
                      </label>
                      <input
                        type="text"
                        value={formData.profile.shift || ""}
                        onChange={(e) => updateProfileField("shift", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="e.g. Morning (06:00 - 14:00)"
                      />
                    </div>
                  </div>
                )}

                {userType === "visitor" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Purpose of Campus Visit
                      </label>
                      <input
                        type="text"
                        value={formData.profile.visit_purpose || ""}
                        onChange={(e) => updateProfileField("visit_purpose", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="e.g. Guest Lecture / Campus Tour"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Host Person / Department
                      </label>
                      <input
                        type="text"
                        value={formData.profile.host_person || ""}
                        onChange={(e) => updateProfileField("host_person", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Host Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.profile.host_contact || ""}
                        onChange={(e) => updateProfileField("host_contact", e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                        placeholder="phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        No. of People
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        placeholder="0"
                        value={formData.profile.accompanying_count === 0 ? "" : (formData.profile.accompanying_count ?? "")}
                        onChange={(e) => {
                          const num = Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0));
                          const currentList = formData.profile.accompanying_details ? formData.profile.accompanying_details.split(/,\s*/) : [];
                          let nextList;
                          if (num > currentList.length) {
                            nextList = [...currentList, ...Array(num - currentList.length).fill("")];
                          } else {
                            nextList = currentList.slice(0, num);
                          }
                          updateProfileField("accompanying_count", num);
                          updateProfileField("accompanying_details", nextList.join(", "));
                        }}
                        className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                      />
                    </div>

                    {(Number(formData.profile.accompanying_count) || 0) === 0 && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">
                          Person Name(s)
                        </label>
                        <input
                          type="text"
                          disabled
                          placeholder="Solo visitor (Enter No. of People to add names)"
                          className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                        />
                      </div>
                    )}

                    {Array.from({ length: Number(formData.profile.accompanying_count) || 0 }).map((_, idx) => {
                      const namesList = formData.profile.accompanying_details ? formData.profile.accompanying_details.split(/,\s*/) : [];
                      const currentName = namesList[idx] || "";
                      return (
                        <div key={idx}>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Person {idx + 1} Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={`Enter Person ${idx + 1} Full Name`}
                            value={currentName}
                            onChange={(e) => {
                              const updated = [...namesList];
                              while (updated.length <= idx) updated.push("");
                              updated[idx] = e.target.value;
                              updateProfileField("accompanying_details", updated.join(", "));
                            }}
                            className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 3: Residential & Hostel Information */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0a2342] border-b border-slate-100 pb-2">
                  <House size={16} className="text-[#f5bd19]" weight="fill" />
                  <span>Residential &amp; Hostel Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Assigned Hostel
                    </label>
                    <select
                      value={formData.profile.hostel_id || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateProfileField("hostel_id", val);
                        updateProfileField("hostel_flag", !!val);
                      }}
                      className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                    >
                      <option value="">Day Scholar / Non-Residential</option>
                      {dbHostels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.code || "Hostel"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Room Number
                    </label>
                    <input
                      type="text"
                      value={formData.profile.room_number || ""}
                      onChange={(e) => updateProfileField("room_number", e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                      placeholder="e.g. B-204"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Guardian / Parent Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.profile.guardian_contact || ""}
                      onChange={(e) => updateProfileField("guardian_contact", e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
                      placeholder="phone number "
                    />
                  </div>
                </div>
              </div>

              {profileError && (
                <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-2">
                  <WarningCircle size={16} weight="bold" className="shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}
              {profileSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="shrink-0 text-emerald-600" />
                  <span>User profile updated successfully!</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isProfileLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a2342] hover:bg-[#163a66] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isProfileLoading ? (
                    <SpinnerGap className="animate-spin" size={15} />
                  ) : (
                    <FloppyDisk size={15} weight="bold" className="text-[#f5bd19]" />
                  )}
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════ PASSPORT PHOTO TAB ════════════════════ */}
          {activeTab === "photo" && (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0a2342] border-b border-slate-100 pb-2">
                  <Camera size={16} className="text-[#f5bd19]" weight="fill" />
                  <span>Official Passport-Style Photo</span>
                </div>

                <PassportPhotoCapture
                  value={formData.profile.photo_reference || ""}
                  onChange={(val) => updateProfileField("photo_reference", val)}
                  label="Official Institutional Portrait"
                  helperText="Clear front-facing portrait used across User Directory, ID Cards, and Turnstile Displays"
                />
              </div>

              {profileError && (
                <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-2">
                  <WarningCircle size={16} weight="bold" className="shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}
              {profileSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="shrink-0 text-emerald-600" />
                  <span>Photo saved successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isProfileLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a2342] hover:bg-[#163a66] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isProfileLoading ? (
                    <SpinnerGap className="animate-spin" size={15} />
                  ) : (
                    <FloppyDisk size={15} weight="bold" className="text-[#f5bd19]" />
                  )}
                  <span>Save Photo Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════ FACE BIOMETRICS TAB ════════════════════ */}
          {activeTab === "face" && (
            <div className="space-y-6 animate-fade-in">
              {/* Pose Selection Strip */}
              <div className="flex gap-2 justify-center flex-wrap">
                {poses.map((pose, idx) => (
                  <button
                    key={pose.key}
                    type="button"
                    onClick={() => setCurrentPoseIdx(idx)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all w-24 ${idx === currentPoseIdx
                      ? "border-[#f5bd19] bg-[#f5bd19]/10 shadow-xs scale-105"
                      : pose.file
                        ? "border-emerald-500/60 bg-emerald-50/70"
                        : "border-slate-200 bg-slate-50"
                      }`}
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center text-xs font-bold bg-white">
                      {pose.preview ? (
                        <img
                          src={pose.preview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">{pose.label}</span>
                  </button>
                ))}
              </div>

              {/* Guided Oval Viewfinder */}
              <div className="text-center bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <h3 className="text-sm font-extrabold text-slate-900 mb-0.5">
                  Pose {currentPoseIdx + 1} of 5: {currentPose.label}
                </h3>
                <p className="text-xs text-slate-500 mb-4">{currentPose.hint}</p>

                <div className="flex justify-center mb-3">
                  <FaceOvalCamera
                    mode="registration"
                    targetPose={currentPose.key}
                    isActive={activeTab === "face"}
                    onCapture={handleAutoCapture}
                  />
                </div>
                <p className="text-xs font-bold text-slate-600">
                  {capturedCount} of 5 poses completed
                </p>
              </div>

              {faceError && (
                <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-2">
                  <WarningCircle size={16} weight="bold" className="shrink-0" />
                  <span>{faceError}</span>
                </div>
              )}
              {faceSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="shrink-0 text-emerald-600" />
                  <span>Biometric face enrollment and profile photo updated successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Enrolling face also synchronizes the frontal passport photo to the user's profile.
                </span>
                <button
                  type="button"
                  onClick={handleRegisterFace}
                  disabled={isFaceLoading || capturedCount < 5}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a2342] hover:bg-[#163a66] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isFaceLoading ? (
                    <SpinnerGap className="animate-spin" size={15} />
                  ) : (
                    <Camera size={15} weight="bold" className="text-[#f5bd19]" />
                  )}
                  <span>Enroll Face Biometrics ({capturedCount}/5)</span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════ RFID TAB ════════════════════ */}
          {activeTab === "rfid" && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider mb-2">
                  Current Hardware Token
                </p>
                {user.active_rfid ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <CreditCard size={22} weight="bold" />
                      </div>
                      <div>
                        <p className="font-mono font-black text-base text-slate-900">
                          {user.active_rfid}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle size={13} weight="fill" /> Active Physical Credential
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-500">
                    No physical RFID badge is currently linked to this profile.
                  </p>
                )}
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
                <h4 className="font-black text-sm text-slate-900">
                  Assign New or Replacement RFID Token
                </h4>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={rfidUid}
                    onChange={(e) => setRfidUid(e.target.value)}
                    placeholder="Scan on reader or enter card UID…"
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleScanRFID}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition disabled:opacity-50"
                  >
                    {isScanning ? (
                      <SpinnerGap className="animate-spin" size={15} />
                    ) : (
                      <Scan size={15} weight="bold" className="text-[#0a2342]" />
                    )}
                    <span>Scan Token</span>
                  </button>
                </div>

                {rfidError && (
                  <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-2">
                    <WarningCircle size={16} weight="bold" className="shrink-0" />
                    <span>{rfidError}</span>
                  </div>
                )}
                {rfidSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-2">
                    <CheckCircle size={16} weight="fill" className="shrink-0 text-emerald-600" />
                    <span>RFID credential linked and issued successfully!</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleAssignRFID}
                    disabled={!rfidUid || isRfidLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a2342] hover:bg-[#163a66] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    {isRfidLoading ? (
                      <SpinnerGap className="animate-spin" size={15} />
                    ) : (
                      <CreditCard size={15} weight="bold" className="text-[#f5bd19]" />
                    )}
                    <span>Issue RFID Credential</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;
