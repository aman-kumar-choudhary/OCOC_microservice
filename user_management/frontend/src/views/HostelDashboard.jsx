import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, AlertCircle, Clock, CheckCircle, Activity, Search, LogOut, LogIn, AlertTriangle, LifeBuoy } from 'lucide-react';
import api from '../services/api';
import { hostelService } from '../services/hostelService';
import LiveStatusTable from '../components/hostel/LiveStatusTable';
import HostelStatsCards from '../components/hostel/HostelStatsCards';
import PermissionPanel from '../components/hostel/PermissionPanel';
import MovementHistoryTable from '../components/hostel/MovementHistoryTable';
import EmergencyMode from '../components/hostel/EmergencyMode';
import HostelStudentsList from '../components/hostel/HostelStudentsList';

const HostelDashboard = () => {
  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [liveVersion, setLiveVersion] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const res = await api.get('/hostel/assigned-hostels');
        setHostels(res.data.data || []);
        if (res.data.data && res.data.data.length > 0) {
          setSelectedHostel(res.data.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchHostels();
  }, []);

  useEffect(() => {
    let reconnectTimer;
    const connect = () => {
      const token = localStorage.getItem('access_token');
      socketRef.current = new WebSocket(`ws://localhost:8080/api/v1/ws/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`);
      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (['HOSTEL_STATUS_UPDATED', 'HOSTEL_CURFEW_ALERT', 'HOSTEL_ALERT'].includes(message.type)) {
            setLiveVersion(version => version + 1);
          }
        } catch (error) { console.error('Hostel live update parsing failed', error); }
      };
      socketRef.current.onclose = () => { reconnectTimer = setTimeout(connect, 5000); };
    };
    connect();
    return () => { clearTimeout(reconnectTimer); socketRef.current?.close(); };
  }, []);

  const tabs = [
    { id: 'overview', name: 'Overview Dashboard', icon: Activity },
    { id: 'directory', name: 'Students Directory', icon: Users },
    { id: 'live', name: 'Live Status', icon: Activity },
    { id: 'permissions', name: 'Leave & Permissions', icon: Clock },
    { id: 'history', name: 'Movement History', icon: LogOut },
    { id: 'emergency', name: 'Emergency Headcount', icon: LifeBuoy }
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2342] flex items-center gap-2">
            Hostel Management <Home size={24} className="text-[#f5bd19]" />
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">RFID-based movement, attendance, and permissions</p>
        </div>
        
        {/* Hostel Selector */}
        <select 
          className="border border-[var(--border-light)] rounded-lg px-4 py-2 text-sm bg-white font-bold text-[#0a2342] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#f5bd19]"
          value={selectedHostel}
          onChange={(e) => setSelectedHostel(e.target.value)}
        >
          <option value="">All Hostels</option>
          {hostels.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-1 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? 'border-[#f5bd19] text-[#0a2342]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-[#f5bd19]' : 'text-gray-400'} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {activeTab === 'overview' && <HostelStatsCards hostelId={selectedHostel} liveVersion={liveVersion} />}
        {activeTab === 'directory' && <HostelStudentsList hostelId={selectedHostel} />}
        {activeTab === 'live' && <LiveStatusTable hostelId={selectedHostel} liveVersion={liveVersion} />}
        {activeTab === 'permissions' && <PermissionPanel hostelId={selectedHostel} />}
        {activeTab === 'history' && <MovementHistoryTable hostelId={selectedHostel} />}
        {activeTab === 'emergency' && <EmergencyMode hostelId={selectedHostel} />}
      </div>
    </div>
  );
};

export default HostelDashboard;
