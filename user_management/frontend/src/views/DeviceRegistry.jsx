import React, { useState, useEffect } from "react";
import { Cpu, Server, CheckCircle, XCircle, Clock } from "lucide-react";
import api from "../services/api";

const DeviceRegistry = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await api.get("/devices");
        setDevices(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();

    const interval = setInterval(fetchDevices, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2342] flex items-center gap-2">
            Device Registry <Cpu size={24} className="text-[#f5bd19]" />
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Hardware health monitoring and throughput
          </p>
        </div>
        <button className="btn btn-primary text-sm px-4 py-2 h-auto">
          Add New Device
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
        <div className="bg-[#0a2342] p-4 rounded-xl shadow-sm">
          <p className="text-xs font-bold text-blue-200 uppercase">
            Engine Latency
          </p>
          <h3 className="text-2xl font-black text-white flex items-end gap-1">
            24<span className="text-sm font-normal text-blue-300 pb-1">ms</span>
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
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-400">
                  No hardware devices registered in the system.
                </td>
              </tr>
            ) : (
              devices.map((dev) => (
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
      </div>
    </div>
  );
};

export default DeviceRegistry;
