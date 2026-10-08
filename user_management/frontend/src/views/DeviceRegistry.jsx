import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle,
  Clock,
  Cpu,
  HardDrives,
  Plus,
  SpinnerGap,
  X,
  XCircle,
} from "@phosphor-icons/react";
import api from "../services/api";
import Pagination from "@/components/common/Pagination";
import { useToast } from "@/context/ToastContext";

const DEVICE_TYPES = [
  { value: "RFID_READER", label: "RFID Reader Turnstile" },
  { value: "CAMERA_BARRIER", label: "Camera Barrier (Face Recog)" },
  { value: "TURNSTILE_GATE", label: "Biometric Turnstile Gate" },
  { value: "BIOMETRIC_KIOSK", label: "Biometric Security Kiosk" },
];

const DeviceRegistry = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pingLatency, setPingLatency] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add Device Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    mac_address: "",
    type: "RFID_READER",
    location_id: "",
    firmware_version: "1.0.0",
  });

  const fetchDevices = async () => {
    const t0 = performance.now();
    try {
      const res = await api.get("/devices");
      setDevices(res.data.data || []);
      setPingLatency(Math.max(1, Math.round(performance.now() - t0)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get("/access/locations");
      setLocations(res.data.data || []);
    } catch (err) {
      console.error("Failed to load locations", err);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(devices.length / pageSize));
    setPage((currentPage) => Math.min(Math.max(1, currentPage), lastPage));
  }, [devices.length, pageSize]);

  const handleOpenAddModal = () => {
    fetchLocations();
    setIsAddModalOpen(true);
  };

  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    if (!form.mac_address || !form.location_id) {
      toast.error("Please provide both MAC address and location.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/devices", form);
      toast.success("Hardware device successfully registered!");
      setIsAddModalOpen(false);
      setForm({
        mac_address: "",
        type: "RFID_READER",
        location_id: "",
        firmware_version: "1.0.0",
      });
      await fetchDevices();
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.error?.message ||
        "Failed to register hardware device."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const paginatedDevices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return devices.slice(start, start + pageSize);
  }, [devices, page, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2342] flex items-center gap-2">
            Device Registry <Cpu size={24} className="text-[#f5bd19]" />
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Hardware health monitoring, gateways, and gate telemetry.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="btn btn-primary text-sm px-4 py-2 h-auto inline-flex items-center gap-2"
        >
          <Plus size={16} /> Add New Device
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[var(--border-light)] shadow-sm">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase">
            Total Devices
          </p>
          <h3 className="text-2xl font-black text-[#0a2342]">
            {devices.length}
          </h3>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
          <p className="text-xs font-bold text-emerald-600 uppercase">Online</p>
          <h3 className="text-2xl font-black text-emerald-700">
            {devices.filter((d) => d.status === "ONLINE").length}
          </h3>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
          <p className="text-xs font-bold text-red-600 uppercase">Offline</p>
          <h3 className="text-2xl font-black text-red-700">
            {devices.filter((d) => d.status === "OFFLINE").length}
          </h3>
        </div>

      </div>

      <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-[var(--border-light)] text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3">Device ID</th>
              <th className="px-4 py-3">MAC Address</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Heartbeat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)] font-mono text-xs">
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-8">
                  Loading devices...
                </td>
              </tr>
            ) : paginatedDevices.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-400">
                  No hardware devices registered in the system.
                </td>
              </tr>
            ) : (
              paginatedDevices.map((dev) => (
                <tr key={dev.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">
                    {dev.id.substring(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0a2342]">
                    {dev.mac_address}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-bold text-[10px]">
                      {dev.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {dev.location_name || "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {dev.status === "ONLINE" ? (
                        <CheckCircle size={14} className="text-emerald-500" />
                      ) : (
                        <XCircle size={14} className="text-red-500" />
                      )}
                      <span
                        className={
                          dev.status === "ONLINE"
                            ? "text-emerald-600 font-bold"
                            : "text-red-600 font-bold"
                        }
                      >
                        {dev.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {dev.last_heartbeat
                      ? new Date(dev.last_heartbeat).toLocaleString()
                      : "Never"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 border-t border-[var(--border-light)] bg-white rounded-b-xl">
          <Pagination
            currentPage={page}
            totalItems={devices.length}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      </div>

      {/* Add New Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-[#0a2342] text-base flex items-center gap-2">
                <Cpu size={18} className="text-[#f5bd19]" /> Register Hardware Device
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRegisterDevice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  MAC Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AA:BB:CC:DD:EE:01"
                  value={form.mac_address}
                  onChange={(e) =>
                    setForm({ ...form, mac_address: e.target.value.trim().toUpperCase() })
                  }
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Device Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342]"
                >
                  {DEVICE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Assigned Gate / Location
                </label>
                <select
                  required
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342]"
                >
                  <option value="">-- Select Location --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.type ? `(${loc.type})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Firmware Version
                </label>
                <input
                  type="text"
                  value={form.firmware_version}
                  onChange={(e) =>
                    setForm({ ...form, firmware_version: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#0a2342]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs px-4 py-2 font-bold inline-flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <SpinnerGap size={14} className="animate-spin" /> Registering...
                    </>
                  ) : (
                    "Register Device"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceRegistry;
