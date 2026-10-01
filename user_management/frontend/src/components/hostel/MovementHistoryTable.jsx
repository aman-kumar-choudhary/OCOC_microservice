import React, { useState, useEffect } from "react";
import { hostelService } from "../../services/hostelService";

const MovementHistoryTable = ({ hostelId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await hostelService.getMovementHistory(hostelId);
        setHistory(res.data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [hostelId]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-50 border-b border-gray-200 px-6 py-4">
        <h3 className="font-bold text-[#0a2342] text-lg">Movement Log</h3>
        <p className="text-xs text-gray-500">
          Immutable record of all IN/OUT events
        </p>
      </div>
      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b border-gray-200">
            <tr className="text-xs uppercase tracking-wider text-gray-500 font-bold">
              <th className="p-4">Time</th>
              <th className="p-4">Student</th>
              <th className="p-4">Action</th>
              <th className="p-4">Status</th>
              <th className="p-4">Gate</th>
              <th className="p-4">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {history.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                  {new Date(m.event_time).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </td>
                <td className="p-4">
                  <p className="font-bold text-[#0a2342]">{m.student_name}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {m.student_roll}
                  </p>
                </td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 text-xs font-black rounded-sm ${m.event_type === "IN" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}
                  >
                    {m.event_type}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 text-xs font-black rounded-full ${m.status === "ALLOWED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-700 font-medium">
                  {m.gate_name || "Unknown"}
                </td>
                <td className="p-4 text-sm text-gray-500">
                  {m.reason?.replace(/_/g, " ") || "-"}
                </td>
              </tr>
            ))}
            {!loading && history.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  No movement events found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  Loading history...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MovementHistoryTable;
