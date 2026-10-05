import React, { useState, useEffect } from "react";
import {
  Check,
  Clock,
  MagnifyingGlass,
  Plus,
  Shield,
  X
} from "@phosphor-icons/react";
import { hostelService } from "../../services/hostelService";
import api from "../../services/api";
import { useToast } from "@/context/ToastContext";

const PermissionPanel = ({ hostelId }) => {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await hostelService.getPermissions(hostelId);
      // If we need to filter by hostel, ideally the backend supports it,
      // but for now we just fetch all or filter client side if needed.
      setPermissions(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPermissions();
  }, [hostelId]);

  const handleRevoke = async (id) => {
    if (window.confirm("Are you sure you want to revoke this permission?")) {
      try {
        await hostelService.revokePermission(id);
        toast.success("Permission revoked successfully");
        fetchPermissions();
      } catch (err) {
        toast.error("Failed to revoke permission");
      }
    }
  };

  const filtered = permissions.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.student_name?.toLowerCase().includes(q) ||
      p.student_roll?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0a2342]">
            Leave & Permissions
          </h2>
          <p className="text-sm text-gray-500">
            Manage student exit authorizations
          </p>
        </div>
        <button
          onClick={() => setShowGrantModal(true)}
          className="bg-[#0a2342] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#11325c] transition-colors"
        >
          <Plus size={16} />
          Grant New Permission
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19] bg-white"
            />
            <MagnifyingGlass
              className="absolute left-3 top-2.5 text-gray-400"
              size={16}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-gray-200">
              <tr className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-4">Student</th>
                <th className="p-4">Type</th>
                <th className="p-4">Valid From</th>
                <th className="p-4">Valid Until</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-bold text-[#0a2342]">{p.student_name}</p>
                    <p className="text-xs text-gray-500">{p.student_roll}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-bold text-gray-700">
                      {p.permission_type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(p.start_time).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(p.end_time).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-4">
                    {p.status === "ACTIVE" && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-black rounded-full">
                        ACTIVE
                      </span>
                    )}
                    {p.status === "REVOKED" && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full">
                        REVOKED
                      </span>
                    )}
                    {p.status === "EXPIRED" && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-black rounded-full">
                        EXPIRED
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {p.status === "ACTIVE" && (
                      <button
                        onClick={() => handleRevoke(p.id)}
                        className="text-xs text-red-600 font-bold hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    No permissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showGrantModal && (
        <GrantModal
          onClose={() => setShowGrantModal(false)}
          onSuccess={() => {
            setShowGrantModal(false);
            fetchPermissions();
          }}
          hostelId={hostelId}
        />
      )}
    </div>
  );
};

const GrantModal = ({ onClose, onSuccess, hostelId }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    student_id: "",
    permission_type: "HOSTEL_EXIT",
    start_time: "",
    end_time: "",
    reason: "",
  });
  const [students, setStudents] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch students to populate dropdown (in reality, maybe search autocomplete)
    const fetchStudents = async () => {
      try {
        const res = await api.get(`/users?limit=1000&hostel_id=${hostelId}`);
        if (res.data?.data?.users) {
          setStudents(res.data.data.users);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStudents();
  }, [hostelId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Ensure times are converted properly to ISO string if needed
      const payload = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      };
      await hostelService.grantPermission(payload);
      toast.success("Permission granted successfully!");
      onSuccess();
    } catch (err) {
      console.error("Backend Error Response:", err.response?.data);
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        err.message ||
        "Failed to grant permission";
      toast.error(errorMsg);
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-[#0a2342] text-lg">Grant Permission</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Student
            </label>
            <select
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={formData.student_id}
              onChange={(e) =>
                setFormData({ ...formData, student_id: e.target.value })
              }
            >
              <option value="">Select a student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.profile?.full_name} ({s.profile?.roll_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Permission Type
            </label>
            <select
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={formData.permission_type}
              onChange={(e) =>
                setFormData({ ...formData, permission_type: e.target.value })
              }
            >
              <option value="HOSTEL_EXIT">Hostel Exit (Curfew Bypass)</option>
              <option value="CAMPUS_EXIT">Campus Exit</option>
              <option value="OVERNIGHT">Overnight Leave</option>
              <option value="EMERGENCY">Emergency Leave</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Reason (Optional)
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows="2"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
            ></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-bold text-white bg-[#0a2342] hover:bg-[#11325c] rounded-lg"
            >
              {submitting ? "Granting..." : "Grant Permission"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermissionPanel;
