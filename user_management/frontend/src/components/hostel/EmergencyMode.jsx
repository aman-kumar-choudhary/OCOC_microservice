import React, { useState, useEffect } from 'react';
import { AlertTriangle, UserX, Phone, Users } from 'lucide-react';
import { hostelService } from '../../services/hostelService';

const EmergencyMode = ({ hostelId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await hostelService.getEmergencyHeadcount(hostelId);
        setData(res.data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh every 10s during emergency
    return () => clearInterval(interval);
  }, [hostelId]);

  if (loading && !data) {
    return <div className="p-12 text-center text-gray-500">Initializing Emergency Systems...</div>;
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
      
      <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">EMERGENCY HEADCOUNT</h2>
            <p className="text-red-100 font-medium">Real-time tracking of unaccounted students</p>
          </div>
        </div>
        <div className="text-center bg-white/10 px-6 py-3 rounded-xl border border-white/20 backdrop-blur-sm">
          <p className="text-sm font-bold text-red-100 uppercase tracking-wider mb-1">Unaccounted</p>
          <p className="text-4xl font-black">{data.unaccounted}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase">Total Students</p>
          <p className="text-2xl font-black text-[#0a2342] mt-1">{data.total_students}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase">Inside Safe</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{data.inside}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase">Authorized Outside</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{data.on_leave}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm text-center">
          <p className="text-xs font-bold text-red-600 uppercase">Unaccounted / Missing</p>
          <p className="text-2xl font-black text-red-700 mt-1">{data.unaccounted}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-gray-200 px-6 py-4 flex items-center gap-2">
          <UserX className="text-red-600" size={20} />
          <h3 className="font-bold text-[#0a2342] text-lg">Unaccounted Students List</h3>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 shadow-sm z-10 border-b border-gray-200">
              <tr className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-4">Student</th>
                <th className="p-4">Last Status</th>
                <th className="p-4">Last Seen</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.unaccounted_students.map(s => (
                <tr key={s.student_id} className="hover:bg-red-50/50">
                  <td className="p-4">
                     <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-[#0a2342]">{s.student_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{s.student_roll}</p>
                      </div>
                     </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full uppercase">
                      {s.current_status}
                    </span>
                  </td>
                  <td className="p-4">
                    {s.last_event_time ? (
                      <div>
                        <p className="text-sm font-bold text-gray-700">
                          {new Date(s.last_event_time).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                        </p>
                        <p className="text-xs text-gray-500">at {s.last_gate_name || 'Unknown'}</p>
                      </div>
                    ) : <span className="text-gray-400">Never Scanned</span>}
                  </td>
                  <td className="p-4">
                    <button className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors">
                      <Phone size={14} />
                      Contact Emergency
                    </button>
                  </td>
                </tr>
              ))}
              {data.unaccounted_students.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                      <CheckCircle size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-800">All Clear</h4>
                    <p className="text-gray-500 text-sm">Every student is accounted for inside the hostel or on authorized leave.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Reusable check circle for empty state
const CheckCircle = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
)

export default EmergencyMode;
