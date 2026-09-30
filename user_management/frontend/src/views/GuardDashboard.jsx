import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, AlertTriangle, CheckCircle, XCircle, Clock, ScanFace, ShieldCheck, LogOut, LogIn, Search, UserRound, CalendarCheck, AlertCircle as AlertCircleIcon } from 'lucide-react';
import api from '../services/api';
import accessService from '../services/accessService';
import { useLiveFaceInference } from '../hooks/useLiveFaceInference';

/**
 * Leave validation badge — cross-references identified student against approved leave dates
 */
const LeaveValidationBadge = ({ student }) => {
  if (!student) return null;

  const now = new Date();
  const hasPermission = !!student.permission_type;
  const permStart = student.permission_start_time ? new Date(student.permission_start_time) : null;
  const permEnd = student.permission_end_time ? new Date(student.permission_end_time) : null;
  const isActive = hasPermission && permStart && permEnd && now >= permStart && now <= permEnd;
  const isExpired = hasPermission && permEnd && now > permEnd;
  const isUpcoming = hasPermission && permStart && now < permStart;

  if (isActive) {
    return (
      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 space-y-1">
        <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
          <CheckCircle size={18} className="text-emerald-600" />
          LEAVE ACTIVE — Gate exit permitted
        </div>
        <p className="text-xs text-emerald-700">
          {student.permission_type?.replace('_', ' ')} · Valid until {permEnd.toLocaleString()}
        </p>
        {student.permission_reason && (
          <p className="text-xs text-emerald-600 italic">Reason: {student.permission_reason}</p>
        )}
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 space-y-1">
        <div className="flex items-center gap-2 text-red-800 font-extrabold text-sm">
          <XCircle size={18} className="text-red-600" />
          LEAVE EXPIRED — Overdue return
        </div>
        <p className="text-xs text-red-700">
          {student.permission_type?.replace('_', ' ')} expired {permEnd.toLocaleString()}
        </p>
      </div>
    );
  }

  if (isUpcoming) {
    return (
      <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 space-y-1">
        <div className="flex items-center gap-2 text-blue-800 font-extrabold text-sm">
          <CalendarCheck size={18} className="text-blue-600" />
          UPCOMING LEAVE — Not yet active
        </div>
        <p className="text-xs text-blue-700">
          {student.permission_type?.replace('_', ' ')} starts {permStart.toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 space-y-1">
      <div className="flex items-center gap-2 text-amber-800 font-extrabold text-sm">
        <AlertCircleIcon size={18} className="text-amber-600" />
        NO ACTIVE LEAVE — Manual verification required
      </div>
      <p className="text-xs text-amber-700">
        This student does not have an approved leave pass for the current date. Contact the warden or check the leave register before allowing exit.
      </p>
    </div>
  );
};

const GuardDashboard = () => {
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [hostelLeaves, setHostelLeaves] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('all');
  const [movementFilter, setMovementFilter] = useState('all');
  const ws = useRef(null);
  const videoRef = useRef(null);
  const { isStreaming, error: cameraError, wsError, faces, startStream, stopStream } = useLiveFaceInference(videoRef, 'single_recognition');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [eventsRes, leaveData] = await Promise.all([
          api.get('/access/events?limit=15'),
          accessService.getGuardHostelLeaves(),
        ]);
        setEvents(eventsRes.data.data || []);
        setHostelLeaves(leaveData || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialData();
    const refreshLeaves = setInterval(() => {
      accessService.getGuardHostelLeaves().then(data => setHostelLeaves(data || [])).catch(console.error);
    }, 15000);

    // Connect WebSocket
    const connectWs = () => {
      const token = sessionStorage.getItem('access_token');
      ws.current = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`);
      
      ws.current.onopen = () => {
        console.log('WebSocket Connected to Guard Console');
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ACCESS_EVENT') {
            setEvents(prev => [message.data, ...prev].slice(0, 50));
            if (message.data.status === 'PENDING' && message.data.verification_id) {
              setPendingVerifications(prev => [message.data, ...prev.filter(item => item.verification_id !== message.data.verification_id)]);
            }
          } else if (message.type === 'SYSTEM_ALERT') {
            setAlerts(prev => [message.data, ...prev].slice(0, 20));
          } else if (message.type === 'HOSTEL_CURFEW_ALERT' || message.type === 'HOSTEL_ALERT') {
            setAlerts(prev => [message.data, ...prev].slice(0, 20));
          } else if (message.type === 'HOSTEL_STATUS_UPDATED') {
            accessService.getGuardHostelLeaves().then(data => setHostelLeaves(data || [])).catch(console.error);
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
      clearInterval(refreshLeaves);
    };
  }, []);

  // Cross-reference detected face against hostel leaves for leave validation
  const identifiedStudent = useMemo(() => {
    if (!faces || faces.length === 0 || !hostelLeaves.length) return null;
    const face = faces[0];
    // Match by external_id / user_id if available from face recognition
    const userId = face.userId || face.user_id || face.external_id;
    const name = face.name || face.person_name;
    if (userId) {
      return hostelLeaves.find(s => s.student_id === userId) || null;
    }
    if (name) {
      return hostelLeaves.find(s =>
        s.student_name?.toLowerCase() === name.toLowerCase()
      ) || null;
    }
    return null;
  }, [faces, hostelLeaves]);

  const filteredStudents = hostelLeaves.filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    const searchable = [student.student_name, student.student_roll, student.student_id, student.student_phone, student.hostel_name].filter(Boolean).join(' ').toLowerCase();
    const statusMatches = studentStatusFilter === 'all' || student.current_status === studentStatusFilter;
    const movement = student.last_movement_type?.toUpperCase();
    const movementMatches = movementFilter === 'all' || movement === movementFilter;
    return (!query || searchable.includes(query)) && statusMatches && movementMatches;
  });

  const completeTwoFactor = async (pending, matched) => {
    try {
      const confidence = faces?.[0]?.similarity_score || faces?.[0]?.confidence || null;
      await accessService.verifyFace({ verification_id: pending.verification_id, user_id: pending.user_id, matched, face_confidence: confidence, reason: matched ? null : 'Guard rejected face verification' });
      setPendingVerifications(prev => prev.filter(item => item.verification_id !== pending.verification_id));
    } catch (err) {
      setAlerts(prev => [{ alert_type: '2-SV_ERROR', message: err.response?.data?.error?.message || 'Unable to complete face verification', created_at: new Date().toISOString() }, ...prev]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2342] flex items-center gap-2">
            Guard Console <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Real-time entry/exit logs, face verification, and leave-aware gate decisions</p>
        </div>
        <div className="text-sm font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
           <Clock size={16} /> LIVE FEED
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Camera Feed, Student ID Panel, & Alerts */}
        <div className="space-y-4">
          {/* Camera */}
          <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-[var(--border-light)] flex items-center justify-between"><div className="flex items-center gap-2"><Camera size={18} className="text-[#0a2342]" /><h3 className="font-bold text-[#0a2342] text-sm">FRECO Face Stream</h3></div><button onClick={isStreaming ? stopStream : startStream} className="text-xs font-bold px-2.5 py-1 rounded bg-[#0a2342] text-white">{isStreaming ? 'Stop' : 'Start camera'}</button></div>
            <div className="relative bg-slate-900 aspect-video"><video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />{!isStreaming && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs">Start camera to send frames to FRECO</div>}</div>
            {(cameraError || wsError) && <p className="p-2 text-xs text-red-600">{cameraError || wsError}</p>}
            <p className="px-3 py-2 text-xs text-[var(--text-muted)] flex items-center gap-1"><ScanFace size={14} /> {faces.length ? `${faces.length} face detected` : 'No face detected'}</p>
          </div>

          {/* Identified Student Panel — shown when face is detected and matched */}
          {faces.length > 0 && identifiedStudent && (
            <div className="bg-white border-2 border-[#0a2342] rounded-xl shadow-md overflow-hidden animate-fade-in">
              <div className="bg-[#0a2342] px-4 py-2.5 flex items-center gap-2">
                <UserRound size={16} className="text-[#f5bd19]" />
                <h3 className="font-bold text-white text-sm">Identified Student</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500 font-bold uppercase text-[10px]">Name</span><p className="font-bold text-[#0a2342]">{identifiedStudent.student_name}</p></div>
                  <div><span className="text-slate-500 font-bold uppercase text-[10px]">Student ID</span><p className="font-bold text-[#0a2342]">{identifiedStudent.student_roll || identifiedStudent.student_id}</p></div>
                  <div><span className="text-slate-500 font-bold uppercase text-[10px]">Hostel</span><p className="font-semibold text-slate-800">{identifiedStudent.hostel_name || 'No hostel'}</p></div>
                  <div><span className="text-slate-500 font-bold uppercase text-[10px]">Phone</span><p className="font-semibold text-slate-800">{identifiedStudent.student_phone || '—'}</p></div>
                  <div className="col-span-2"><span className="text-slate-500 font-bold uppercase text-[10px]">Current Status</span><p className="font-bold">{identifiedStudent.current_status?.replace('_', ' ') || 'Unknown'}</p></div>
                </div>
                <LeaveValidationBadge student={identifiedStudent} />
              </div>
            </div>
          )}

          {/* Face detected but NOT matched to any student */}
          {faces.length > 0 && !identifiedStudent && (
            <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-1">
                <AlertCircleIcon size={16} className="text-amber-600" />
                Face Detected — Not Identified
              </div>
              <p className="text-xs text-amber-700">The detected face could not be matched to a registered student. Verify identity manually.</p>
            </div>
          )}

          {/* 2-SV Queue */}
          <div className="bg-white border border-amber-100 rounded-xl shadow-sm overflow-hidden flex-1">
            <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex items-center gap-2"><ShieldCheck size={18} className="text-amber-600" /><h3 className="font-bold text-amber-800 text-sm">2-SV Verification Queue</h3></div>
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">{pendingVerifications.length === 0 ? <p className="text-sm text-slate-400 text-center py-2">No RFID scans waiting for face verification</p> : pendingVerifications.map(pending => <div key={pending.verification_id} className="border border-amber-200 rounded p-2 text-xs"><p className="font-bold">{pending.user_name} — {pending.location_name}</p><p className="text-slate-500">RFID {pending.rfid_uid}</p><div className="flex gap-2 mt-2"><button onClick={() => completeTwoFactor(pending, true)} className="px-2 py-1 rounded bg-emerald-600 text-white">Face matched</button><button onClick={() => completeTwoFactor(pending, false)} className="px-2 py-1 rounded bg-red-600 text-white">Reject</button></div></div>)}</div>
          </div>

          {/* Alerts */}
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
                        {ev.status === 'GRANTED' ? <CheckCircle size={14} className="text-emerald-500" /> : ev.status === 'PENDING' ? <Clock size={14} className="text-amber-500" /> : <XCircle size={14} className="text-red-500" />}
                        <span className={ev.status === 'GRANTED' ? 'text-emerald-600 font-bold' : ev.status === 'PENDING' ? 'text-amber-600 font-bold' : 'text-red-600 font-bold'}>{ev.status}</span>
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

      {/* Gate Movement and Leave Monitor */}
      <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-[var(--border-light)] px-4 py-3 space-y-3">
          <div className="flex justify-between items-center">
            <div><h3 className="font-bold text-[#0a2342] text-sm">Gate Movement and Leave Monitor</h3><p className="text-xs text-[var(--text-muted)] mt-0.5">FRECO live face verification, approved leave status, and each student's latest gate movement</p></div>
            <span className="text-xs text-[var(--text-muted)] font-mono">{filteredStudents.length} / {hostelLeaves.length} students</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="relative sm:col-span-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="form-input pl-9 py-2 text-sm" placeholder="Search student name, ID, phone" aria-label="Search students by student ID or name" /></label>
            <select value={studentStatusFilter} onChange={(e) => setStudentStatusFilter(e.target.value)} className="form-input form-select py-2 text-sm" aria-label="Filter by student status"><option value="all">All student statuses</option>{['INSIDE', 'OUTSIDE', 'ON_LEAVE', 'UNAUTHORIZED', 'LATE_RETURN'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select>
            <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)} className="form-input form-select py-2 text-sm" aria-label="Filter by gate movement"><option value="all">Entry and exit</option><option value="ENTRY">Entering</option><option value="EXIT">Exiting</option></select>
          </div>
        </div>
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-100 sticky top-0 border-b border-[var(--border-light)] text-[11px] font-extrabold uppercase text-[var(--text-muted)]"><tr><th className="px-4 py-3">Student details / ID</th><th className="px-4 py-3">Current status</th><th className="px-4 py-3">Permission</th><th className="px-4 py-3">Approved by</th><th className="px-4 py-3">Last in/out</th></tr></thead>
            <tbody className="divide-y divide-[var(--border-light)] text-xs">                                     
              {filteredStudents.length === 0 ? <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-400">No students match these filters.</td></tr> : filteredStudents.map(student => {
                const outside = ['OUTSIDE', 'ON_LEAVE', 'UNAUTHORIZED', 'LATE_RETURN'].includes(student.current_status);
                return <tr key={student.student_id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-bold text-[#0a2342]">{student.student_name}</p><p className="text-slate-500">Student ID: {student.student_roll || student.student_id} · {student.hostel_name || 'No hostel'}{student.student_phone ? ` · ${student.student_phone}` : ''}</p></td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${outside ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{outside ? <LogOut size={12} /> : <LogIn size={12} />}{student.current_status?.replace('_', ' ')}</span></td><td className="px-4 py-3">{student.permission_type ? <><p className="font-bold text-purple-700">{student.permission_type.replace('_', ' ')}</p><p className="text-slate-500">{new Date(student.permission_start_time).toLocaleString()} – {new Date(student.permission_end_time).toLocaleString()}</p>{student.permission_reason && <p className="text-slate-500 max-w-48 truncate" title={student.permission_reason}>{student.permission_reason}</p>}</> : <span className="text-red-600 font-bold">No active permission</span>}</td><td className="px-4 py-3 text-slate-600">{student.granted_by_name || '—'}</td><td className="px-4 py-3"><p className="font-bold">{student.last_movement_type === 'EXIT' ? 'Exiting' : student.last_movement_type === 'ENTRY' ? 'Entering' : 'No recorded movement'} {student.last_movement_status ? `(${student.last_movement_status})` : ''}</p><p className="text-slate-500">{student.last_gate_name || '—'}{student.last_event_time ? ` · ${new Date(student.last_event_time).toLocaleString()}` : ''}</p></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GuardDashboard;
