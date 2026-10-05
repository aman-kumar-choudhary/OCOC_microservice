import React, { useState, useEffect, useMemo } from "react";
import api from "@/services/api";
import {
  BuildingOffice,
  Envelope,
  House,
  MagnifyingGlass,
  Phone,
  ShieldCheck,
  SpinnerGap,
  User,
  Users,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Pagination from "@/components/common/Pagination";
import StatusBadge from "@/components/common/StatusBadge";
import EmptyState from "@/components/common/EmptyState";

export const WardenDirectoryTable = () => {
  const [wardens, setWardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedHostelFilter, setSelectedHostelFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchWardens = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/hostel/wardens");
      setWardens(res.data.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.detail ||
          "Unable to load warden directory. Admin privileges required.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWardens();
  }, []);

  // Filtered wardens
  const filteredWardens = useMemo(() => {
    return wardens.filter((w) => {
      const q = search.toLowerCase().trim();
      const name = (w.full_name || "").toLowerCase();
      const email = (w.email || "").toLowerCase();
      const empId = (w.employee_id || "").toLowerCase();
      const hostelNames = (w.assigned_hostels || [])
        .map((h) => (h.name || "").toLowerCase())
        .join(" ");

      const matchesSearch =
        !q ||
        name.includes(q) ||
        email.includes(q) ||
        empId.includes(q) ||
        hostelNames.includes(q);

      const matchesHostel =
        !selectedHostelFilter ||
        (w.assigned_hostels || []).some(
          (h) => h.id === selectedHostelFilter || h.name === selectedHostelFilter,
        );

      return matchesSearch && matchesHostel;
    });
  }, [wardens, search, selectedHostelFilter]);

  // Unique hostels for filter dropdown
  const allHostels = useMemo(() => {
    const map = new Map();
    wardens.forEach((w) => {
      (w.assigned_hostels || []).forEach((h) => {
        if (h.id && !map.has(h.id)) {
          map.set(h.id, h.name);
        }
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [wardens]);

  // Paginated slice
  const paginatedWardens = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWardens.slice(start, start + pageSize);
  }, [filteredWardens, page, pageSize]);

  const totalPages = Math.ceil(filteredWardens.length / pageSize) || 1;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header and Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-black uppercase tracking-wider">
                <ShieldCheck size={13} weight="fill" className="text-amber-600" /> Admin Restricted View
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-bold text-slate-500">
                {wardens.length} Registered Warden{wardens.length === 1 ? "" : "s"}
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Warden Directory &amp; Hostel Assignments
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Official mapping between campus wardens and their supervised residential blocks
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchWardens}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-[#0a2342] shadow-2xs transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by warden name, email, employee ID, or hostel..."
              className="w-full h-10 rounded-xl border border-slate-200 pl-10 pr-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>

          <div className="sm:w-64">
            <select
              value={selectedHostelFilter}
              onChange={(e) => {
                setSelectedHostelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
            >
              <option value="">All Assigned Hostels</option>
              {allHostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200 flex items-center gap-2">
          <WarningCircle size={16} weight="bold" className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Wardens Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs z-10 flex items-center justify-center">
            <SpinnerGap size={30} className="animate-spin text-[#0a2342]" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-5 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Warden Official
                </th>
                <th className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Employee ID
                </th>
                <th className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Contact Information
                </th>
                <th className="px-5 py-3.5 text-[11px] font-black uppercase tracking-wider text-[#0a2342] bg-amber-50/50">
                  Warden → Assigned Hostel
                </th>
                <th className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedWardens.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="py-12">
                    <EmptyState
                      title="No Wardens Found"
                      description={
                        search || selectedHostelFilter
                          ? "No wardens match your current search or hostel filter."
                          : "No warden accounts are currently provisioned in the system."
                      }
                      icon={Users}
                      action={
                        search || selectedHostelFilter ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setSelectedHostelFilter("");
                              setPage(1);
                            }}
                            className="text-xs font-bold text-[#0a2342] hover:underline"
                          >
                            Reset Filters
                          </button>
                        ) : null
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedWardens.map((w) => {
                  const assigned = w.assigned_hostels || [];
                  return (
                    <tr
                      key={w.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Warden Profile */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0a2342] to-[#163a66] text-[#f5bd19] flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                            {(w.full_name || w.email || "W").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-slate-900 leading-tight">
                              {w.full_name || "Institutional Warden"}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {w.email}
                            </p>
                            {w.warden_responsibilities && (
                              <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                                {w.warden_responsibilities}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                          {w.employee_id || "N/A"}
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {w.phone ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                              <Phone size={13} className="text-slate-400" />
                              <span>{w.phone}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No phone</span>
                          )}
                          {w.emergency_contact && (
                            <div className="text-[11px] text-slate-500">
                              <span className="text-slate-400">Emergency: </span>
                              <span>{w.emergency_contact}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Warden → Assigned Hostel (Highlighted) */}
                      <td className="px-5 py-4 bg-amber-50/20">
                        {assigned.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {assigned.map((h) => (
                              <div
                                key={h.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-xs font-bold text-amber-950 shadow-2xs"
                              >
                                <House size={14} weight="fill" className="text-amber-600 shrink-0" />
                                <span>{h.name}</span>
                                {h.code && (
                                  <span className="text-[10px] font-mono text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                    {h.code}
                                  </span>
                                )}
                                {h.capacity && (
                                  <span className="text-[10px] text-slate-500">
                                    (Cap: {h.capacity})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                            Unassigned
                          </span>
                        )}
                        {w.hostel_block && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Block assignment: <strong className="text-slate-700">{w.hostel_block}</strong>
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredWardens.length > 0 && (
          <div className="border-t border-slate-100">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filteredWardens.length}
              limit={pageSize}
              onPageChange={(p) => setPage(p)}
              onLimitChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WardenDirectoryTable;
