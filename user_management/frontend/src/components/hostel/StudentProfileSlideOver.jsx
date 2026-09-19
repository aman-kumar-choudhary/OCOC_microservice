import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, BookOpen, Shield, Key, AlertTriangle, CheckCircle, Save, XCircle } from 'lucide-react';
import api from '../../services/api';

const StudentProfileSlideOver = ({ student, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    roll_number: '',
    phone: '',
    course: '',
    semester: '',
  });

  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.profile?.full_name || '',
        roll_number: student.profile?.roll_number || '',
        phone: student.phone || '',
        course: student.profile?.course || '',
        semester: student.profile?.semester || '',
      });
    }
  }, [student]);

  if (!student) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/users/${student.id}`, {
        phone: formData.phone,
        profile: {
          full_name: formData.full_name,
          roll_number: formData.roll_number,
          course: formData.course,
          semester: formData.semester,
        }
      });
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error("Failed to update student", err);
      alert("Failed to update student details.");
    }
    setLoading(false);
  };

  const toggleSuspension = async () => {
    const newStatus = student.status === 'suspended' ? 'active' : 'suspended';
    if (!window.confirm(`Are you sure you want to ${newStatus} this student? This will also ${newStatus === 'suspended' ? 'deactivate' : 'reactivate'} their RFID card.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await api.patch(`/users/${student.id}/status`, {
        status: newStatus,
        reason: `Changed by Warden`
      });
      onUpdate();
    } catch (err) {
      console.error("Failed to change status", err);
      alert("Failed to change student status.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-[#0a2342] flex items-center gap-2">
            <User className="text-[#f5bd19]" size={20} />
            Student Details
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Header Card */}
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="h-24 w-24 rounded-full bg-[#f5bd19]/20 text-[#f5bd19] flex items-center justify-center flex-shrink-0">
              <User size={48} />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <h1 className="text-2xl font-bold text-[#0a2342]">{student.profile?.full_name || 'N/A'}</h1>
                <p className="text-sm text-gray-500 font-mono">{student.profile?.roll_number || 'No Roll Number'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 ${
                  student.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {student.status === 'active' ? <CheckCircle size={12}/> : <XCircle size={12}/>}
                  {student.status}
                </span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 ${
                  student.active_rfid ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Shield size={12}/>
                  RFID {student.active_rfid ? 'Assigned' : 'Unassigned'}
                </span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Details'}
              </button>
              <button 
                onClick={toggleSuspension}
                disabled={loading}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex justify-center items-center gap-2 ${
                  student.status === 'suspended' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                } disabled:opacity-50`}
              >
                {student.status === 'suspended' ? 'Activate Student' : 'Suspend Student'}
              </button>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Details Form / Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Mail size={16}/> Contact Information
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email Address (Read-only)</label>
                  <input type="text" value={student.email} disabled className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    value={isEditing ? formData.phone : (student.phone || 'N/A')} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    disabled={!isEditing} 
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isEditing ? 'bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]' : 'bg-gray-50 border-gray-200 text-gray-700'}`} 
                  />
                </div>
              </div>
            </div>

            {/* Academic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <BookOpen size={16}/> Academic Details
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={isEditing ? formData.full_name : (student.profile?.full_name || 'N/A')} 
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    disabled={!isEditing} 
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isEditing ? 'bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]' : 'bg-gray-50 border-gray-200 text-gray-700'}`} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Roll Number</label>
                  <input 
                    type="text" 
                    value={isEditing ? formData.roll_number : (student.profile?.roll_number || 'N/A')} 
                    onChange={e => setFormData({...formData, roll_number: e.target.value})}
                    disabled={!isEditing} 
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isEditing ? 'bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]' : 'bg-gray-50 border-gray-200 text-gray-700'}`} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Course</label>
                    <input 
                      type="text" 
                      value={isEditing ? formData.course : (student.profile?.course || 'N/A')} 
                      onChange={e => setFormData({...formData, course: e.target.value})}
                      disabled={!isEditing} 
                      className={`w-full px-3 py-2 text-sm rounded-lg border ${isEditing ? 'bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]' : 'bg-gray-50 border-gray-200 text-gray-700'}`} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Semester</label>
                    <input 
                      type="text" 
                      value={isEditing ? formData.semester : (student.profile?.semester || 'N/A')} 
                      onChange={e => setFormData({...formData, semester: e.target.value})}
                      disabled={!isEditing} 
                      className={`w-full px-3 py-2 text-sm rounded-lg border ${isEditing ? 'bg-white border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]' : 'bg-gray-50 border-gray-200 text-gray-700'}`} 
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3 text-sm text-yellow-800">
            <AlertTriangle className="flex-shrink-0 text-yellow-600" size={20} />
            <div>
              <p className="font-bold mb-1">Warden Access Restrictions</p>
              <p>Face authentication data and internal user IDs are hidden. To update biometrics, please refer the student to the central IT desk.</p>
            </div>
          </div>
          
        </div>

        {/* Footer Actions */}
        {isEditing && (
          <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex justify-end gap-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 text-sm font-bold text-[#0a2342] bg-[#f5bd19] hover:bg-[#e0a800] rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default StudentProfileSlideOver;
