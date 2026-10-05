import React, { useState, useEffect } from "react";
import {
  BookOpen,
  CheckCircle,
  Envelope,
  FloppyDisk,
  House,
  IdentificationBadge,
  Phone,
  Shield,
  User,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react";
import api from "../../services/api";
import { useToast } from "@/context/ToastContext";

const StudentProfileSlideOver = ({ student, onClose, onUpdate }) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    roll_number: "",
    phone: "",
    course: "",
    semester: "",
    room_number: "",
    batch: "",
    emergency_contact: "",
    guardian_contact: "",
  });

  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.profile?.full_name || student.full_name || "",
        roll_number: student.profile?.roll_number || "",
        phone: student.phone || "",
        course: student.profile?.course || "",
        semester: student.profile?.semester || "",
        room_number: student.profile?.room_number || "",
        batch: student.profile?.batch || "",
        emergency_contact: student.profile?.emergency_contact || "",
        guardian_contact: student.profile?.guardian_contact || "",
      });
    }
  }, [student]);

  if (!student) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/users/${student.id}`, {
        phone: formData.phone,
        profile: {
          full_name: formData.full_name,
          roll_number: formData.roll_number,
          course: formData.course,
          semester: formData.semester,
          room_number: formData.room_number,
          batch: formData.batch,
          emergency_contact: formData.emergency_contact,
          guardian_contact: formData.guardian_contact,
        },
      });
      setIsEditing(false);
      toast.success("Student details updated successfully!");
      onUpdate();
    } catch (err) {
      console.error("Failed to update student", err);
      toast.error(err.response?.data?.error?.message || "Failed to update student details.");
    }
    setLoading(false);
  };

  const toggleSuspension = async () => {
    const newStatus = student.status === "suspended" ? "active" : "suspended";
    if (
      !window.confirm(
        `Are you sure you want to ${newStatus} this student? This will also ${
          newStatus === "suspended" ? "deactivate" : "reactivate"
        } their RFID campus turnstile card.`,
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/users/${student.id}/status`, {
        status: newStatus,
        reason: `Residential status changed by Hostel Warden`,
      });
      toast.success(`Student status updated to ${newStatus}.`);
      onUpdate();
    } catch (err) {
      console.error("Failed to change status", err);
      toast.error(err.response?.data?.error?.message || "Failed to change student status.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-[#0a2342] flex items-center gap-2">
            <User className="text-[#f5bd19]" size={20} />
            Student Residential Record
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Card */}
          <div className="flex flex-col md:flex-row gap-5 items-start md:items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="h-20 w-20 rounded-full bg-[#f5bd19]/20 text-[#0a2342] font-black flex items-center justify-center flex-shrink-0 text-2xl">
              {(student.profile?.full_name || student.full_name || "S").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 space-y-1.5">
              <div>
                <h1 className="text-xl font-black text-[#0a2342]">
                  {student.profile?.full_name || student.full_name || "Unnamed Student"}
                </h1>
                <p className="text-xs text-gray-500 font-mono">
                  Roll: {student.profile?.roll_number || "No Roll Number"} • Batch: {student.profile?.batch || "N/A"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase flex items-center gap-1 ${
                    student.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {student.status === "active" ? (
                    <CheckCircle size={12} />
                  ) : (
                    <XCircle size={12} />
                  )}
                  {student.status}
                </span>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase flex items-center gap-1 ${
                    student.active_rfid
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Shield size={12} />
                  RFID {student.active_rfid ? "Active" : "Unassigned"}
                </span>
                {student.has_face_auth && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full uppercase flex items-center gap-1 bg-purple-100 text-purple-700">
                    <CheckCircle size={12} /> Face ID Enrolled
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors shadow-2xs"
              >
                {isEditing ? "Cancel Edit" : "Edit Profile"}
              </button>
              <button
                onClick={toggleSuspension}
                disabled={loading}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex justify-center items-center gap-1.5 ${
                  student.status === "suspended"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                } disabled:opacity-50 shadow-2xs`}
              >
                {student.status === "suspended"
                  ? "Activate Student"
                  : "Suspend Student"}
              </button>
            </div>
          </div>

          {/* Residential Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <House size={16} className="text-amber-500" /> Hostel Accommodation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Assigned Room Number
                </label>
                <input
                  type="text"
                  value={isEditing ? formData.room_number : student.profile?.room_number || "Unassigned"}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700 font-bold"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Hostel Block / Wing
                </label>
                <input
                  type="text"
                  value={student.profile?.hostel_block || "Main Block"}
                  disabled
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Details Form / Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Envelope size={16} className="text-blue-500" /> Contact Details
              </h3>

              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Email Address (Official)
                  </label>
                  <input
                    type="text"
                    value={student.email}
                    disabled
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Student Phone Number
                  </label>
                  <input
                    type="text"
                    value={isEditing ? formData.phone : student.phone || "N/A"}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    value={isEditing ? formData.emergency_contact : student.profile?.emergency_contact || "N/A"}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact: e.target.value })
                    }
                    disabled={!isEditing}
                    placeholder="+91..."
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Guardian Contact
                  </label>
                  <input
                    type="text"
                    value={isEditing ? formData.guardian_contact : student.profile?.guardian_contact || "N/A"}
                    onChange={(e) =>
                      setFormData({ ...formData, guardian_contact: e.target.value })
                    }
                    disabled={!isEditing}
                    placeholder="+91..."
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Academic Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen size={16} className="text-emerald-500" /> Academic Info
              </h3>

              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={
                      isEditing
                        ? formData.full_name
                        : student.profile?.full_name || student.full_name || "N/A"
                    }
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    value={
                      isEditing
                        ? formData.roll_number
                        : student.profile?.roll_number || "N/A"
                    }
                    onChange={(e) =>
                      setFormData({ ...formData, roll_number: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Course
                    </label>
                    <input
                      type="text"
                      value={
                        isEditing
                          ? formData.course
                          : student.profile?.course || "N/A"
                      }
                      onChange={(e) =>
                        setFormData({ ...formData, course: e.target.value })
                      }
                      disabled={!isEditing}
                      className={`w-full px-3 py-2 text-sm rounded-lg border ${
                        isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Semester
                    </label>
                    <input
                      type="text"
                      value={
                        isEditing
                          ? formData.semester
                          : student.profile?.semester || "N/A"
                      }
                      onChange={(e) =>
                        setFormData({ ...formData, semester: e.target.value })
                      }
                      disabled={!isEditing}
                      className={`w-full px-3 py-2 text-sm rounded-lg border ${
                        isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Batch
                  </label>
                  <input
                    type="text"
                    value={
                      isEditing
                        ? formData.batch
                        : student.profile?.batch || "N/A"
                    }
                    onChange={(e) =>
                      setFormData({ ...formData, batch: e.target.value })
                    }
                    disabled={!isEditing}
                    placeholder="e.g. 2023-2027"
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isEditing ? "bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]" : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs text-amber-900 leading-relaxed">
            <Warning
              className="flex-shrink-0 text-amber-600 mt-0.5"
              size={18}
            />
            <div>
              <p className="font-bold mb-0.5">Warden Jurisdiction & Biometric Governance</p>
              <p>
                As hostel warden, you have full custody of residential room assignment and student contact verification.
                For biometric RFID replacement or face re-enrollment, direct the student to Central Campus IT.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {isEditing && (
          <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex justify-end gap-3">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 text-xs font-bold text-[#0a2342] bg-[#f5bd19] hover:bg-[#e0a800] rounded-lg flex items-center gap-2 disabled:opacity-50 shadow-xs"
            >
              <FloppyDisk size={16} />
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfileSlideOver;
