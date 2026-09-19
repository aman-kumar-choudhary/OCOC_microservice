import React, { useState, useEffect } from 'react';
import { X, History, MapPin, Save, UserCircle } from 'lucide-react';
import api from '../services/api';

const HostelStudentModal = ({ student, hostels, onClose, onTransferSuccess, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedTransferHostel, setSelectedTransferHostel] = useState('');
  const [transferring, setTransferring] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: student.profile?.full_name || '',
    roll_number: student.profile?.roll_number || '',
    course: student.profile?.course || '',
    semester: student.profile?.semester || '',
    emergency_contact: student.profile?.emergency_contact || '',
    guardian_contact: student.profile?.guardian_contact || ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (activeTab === 'logs' && student) {
      fetchLogs();
    }
  }, [activeTab, student]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get(`/access/events?limit=20&user_id=${student.id}`);
      setLogs(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
    setLoadingLogs(false);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put(`/users/${student.id}`, {
        profile: formData
      });
      if (onProfileUpdate) onProfileUpdate();
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile.');
    }
    setSavingProfile(false);
  };

  const handleTransfer = async () => {
    if (!selectedTransferHostel) return;
    setTransferring(true);
    try {
      await api.put(`/users/${student.id}`, {
        profile: {
            hostel_id: selectedTransferHostel
        }
      });
      onTransferSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to transfer student:', error);
      alert('Failed to transfer student.');
    }
    setTransferring(false);
  };

  if (!student) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
             <div className="h-12 w-12 rounded-full bg-[#f5bd19]/20 text-[#f5bd19] flex items-center justify-center">
                <UserCircle size={28} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-[#0a2342]">{student.profile?.full_name || 'Unknown'}</h2>
               <p className="text-sm text-gray-500">{student.profile?.roll_number} • {student.email}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-[#f5bd19] text-[#0a2342]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile Edit
          </button>
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'transfer' ? 'border-[#f5bd19] text-[#0a2342]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            onClick={() => setActiveTab('transfer')}
          >
            Transfer Hostel
          </button>
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'logs' ? 'border-[#f5bd19] text-[#0a2342]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            onClick={() => setActiveTab('logs')}
          >
            Access Logs
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {activeTab === 'profile' && (
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="font-bold text-[#0a2342] border-b pb-2">Edit Student Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label>
                  <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-[#f5bd19]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Roll Number</label>
                  <input type="text" name="roll_number" value={formData.roll_number} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-[#f5bd19]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Course</label>
                  <input type="text" name="course" value={formData.course} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-[#f5bd19]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Semester</label>
                  <input type="text" name="semester" value={formData.semester} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-[#f5bd19]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact</label>
                  <input type="text" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-[#f5bd19]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Guardian Contact</label>
                  <input type="text" name="guardian_contact" value={formData.guardian_contact} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-[#f5bd19]" />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button 
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="bg-[#0a2342] text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#11325c] transition flex items-center gap-2"
                >
                  <Save size={16} />
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
             <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                    <MapPin size={32} />
                </div>
                <h3 className="font-bold text-xl text-[#0a2342] mb-2">Transfer Hostel</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-md">Select a new hostel for this student. Upon transfer, they will immediately lose access to the current hostel and gain access to the new one.</p>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                  <select 
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5bd19]"
                    value={selectedTransferHostel}
                    onChange={(e) => setSelectedTransferHostel(e.target.value)}
                  >
                    <option value="">Select new hostel...</option>
                    {hostels.filter(h => h.id !== student.profile?.hostel_id).map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleTransfer}
                    disabled={!selectedTransferHostel || transferring}
                    className="bg-[#f5bd19] text-[#0a2342] px-6 py-2 rounded-lg text-sm font-bold hover:bg-yellow-500 disabled:opacity-50 transition-colors"
                  >
                    {transferring ? 'Transferring...' : 'Transfer'}
                  </button>
                </div>
             </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm min-h-[300px]">
              {loadingLogs ? (
                <div className="text-center py-12 text-gray-400">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <History size={48} className="mx-auto mb-3 text-gray-200" />
                  No access events found for this student.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map(log => (
                    <div key={log.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-4 rounded-lg">
                      <div>
                        <p className="text-sm font-bold text-[#0a2342]">{log.location_name}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(log.event_time).toLocaleString()}</p>
                      </div>
                      <div className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${log.action === 'ENTRY' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {log.action}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostelStudentModal;
