import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../services/api';

const GuardDashboard = () => {
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const eventsRes = await api.get('/access/events?limit=15');
        setEvents(eventsRes.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialData();

    // Connect WebSocket
    const connectWs = () => {
      ws.current = new WebSocket('ws://localhost:8080/api/v1/ws/stream');
      
      ws.current.onopen = () => {
        console.log('WebSocket Connected to Guard Console');
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ACCESS_EVENT') {
            setEvents(prev => [message.data, ...prev].slice(0, 50));
          } else if (message.type === 'SYSTEM_ALERT') {
            setAlerts(prev => [message.data, ...prev].slice(0, 20));
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket Disconnected, reconnecting in 5s...');
        setTimeout(connectWs, 5000);
      };
    };

    connectWs();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2342] flex items-center gap-2">
            Guard Console <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Real-time entry/exit logs and system alerts</p>
        </div>
        <div className="text-sm font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
           <Clock size={16} /> LIVE FEED
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Camera Feed & Alerts */}
        <div className="space-y-6">
          <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden flex-1">
            <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <h3 className="font-bold text-red-700 text-sm">Actionable Alerts</h3>
            </div>
            <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No active alerts</p>
              ) : (
                alerts.map((alert, idx) => (
                  <div key={idx} className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
                    <div className="font-bold text-amber-800 mb-1">{alert.alert_type}</div>
                    <div className="text-amber-700">{alert.message}</div>
                    <div className="text-xs text-amber-500 mt-2">{new Date(alert.created_at).toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Traditional Register Table */}
        <div className="lg:col-span-2 bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="bg-slate-50 border-b border-[var(--border-light)] px-4 py-3 flex justify-between items-center">
            <h3 className="font-bold text-[#0a2342] text-sm">Digital Register (Live)</h3>
            <span className="text-xs text-[var(--text-muted)] font-mono">{events.length} records</span>
          </div>
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100 sticky top-0 border-b border-[var(--border-light)] text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)] font-mono text-xs">
                {events.map((ev, idx) => (
                  <tr key={ev.id || idx} className={`hover:bg-slate-50 transition-colors ${ev.status === 'DENIED' ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">{new Date(ev.event_time).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 font-semibold text-[#0a2342]">{ev.user_name || ev.user_identifier}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${ev.action === 'ENTRY' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {ev.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{ev.location_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {ev.status === 'GRANTED' ? <CheckCircle size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-red-500" />}
                        <span className={ev.status === 'GRANTED' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{ev.status}</span>
                      </div>
                      {ev.reason && ev.status === 'DENIED' && (
                        <div className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={ev.reason}>{ev.reason}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardDashboard;
