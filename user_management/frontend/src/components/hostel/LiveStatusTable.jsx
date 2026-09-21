import React, { useState, useEffect } from 'react';
import { Search, UserCircle } from 'lucide-react';
import { hostelService } from '../../services/hostelService';

const LiveStatusTable = ({ hostelId, liveVersion = 0 }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchLiveStatus = async () => {
      setLoading(true);
      try {
        const res = await hostelService.getLiveStatus(hostelId);
        setStudents(res.data);
      } catch (err) {
        console.error("Failed to fetch live status", err);
      }
      setLoading(false);
    };
    
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [hostelId, liveVersion]);

  const filteredStudents = students.filter(s => {
    if (statusFilter && s.current_status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (s.student_name || '').toLowerCase();
    const roll = (s.student_roll || '').toLowerCase();
    return name.includes(q) || roll.includes(q);
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'INSIDE': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full uppercase">🟢 Inside</span>;
      case 'OUTSIDE': return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-black rounded-full uppercase">🔴 Outside</span>;
      case 'ON_LEAVE': return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-black rounded-full uppercase">🟡 On Leave</span>;
      case 'UNAUTHORIZED': return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full uppercase animate-pulse">⚠ Unauthorized</span>;
      case 'LATE_RETURN': return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full uppercase">⚠ Late</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-black rounded-full uppercase">{status}</span>;
    }
  };

  return (
    <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-50 border-b border-[var(--border-light)] px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="font-bold text-[#0a2342] text-lg">Live Movement Status</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f5bd19] bg-white shadow-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="INSIDE">Inside</option>
            <option value="OUTSIDE">Outside</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="UNAUTHORIZED">Unauthorized</option>
            <option value="LATE_RETURN">Late Return</option>
          </select>
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Search by name or roll no..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19] transition-all bg-white shadow-sm"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto max-h-[600px]">
        {loading && students.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-medium">Loading live status...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-medium">No students found matching your criteria.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b border-gray-200">
              <tr className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-4">Student</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Event</th>
                <th className="p-4">Time</th>
                <th className="p-4">Permission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map(s => (
                <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                     <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#f5bd19]/20 text-[#f5bd19] flex items-center justify-center">
                        <UserCircle size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-[#0a2342]">{s.student_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{s.student_roll}</p>
                      </div>
                     </div>
                  </td>
                  <td className="p-4">
                    {getStatusBadge(s.current_status)}
                  </td>
                  <td className="p-4">
                    {s.last_movement_type ? (
                      <div>
                        <p className="text-sm font-bold text-gray-700">{s.last_movement_type}</p>
                        <p className="text-xs text-gray-500">{s.last_gate_name || 'Unknown Gate'}</p>
                      </div>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {s.last_event_time ? new Date(s.last_event_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                  </td>
                  <td className="p-4">
                    {s.active_permission_type ? (
                      <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                        {s.active_permission_type.replace('_', ' ')}
                      </span>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LiveStatusTable;
