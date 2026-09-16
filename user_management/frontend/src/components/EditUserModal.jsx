import React, { useState, useEffect } from 'react'
import userService from '@/services/userService'
import rfidService from '@/services/rfidService'
import { registerPerson } from '@/services/frecoService'
import FaceOvalCamera from '@/components/FaceOvalCamera'
import UserProfileForm from '@/components/UserProfileForm'
import {
  X, Loader2, Save, Camera, CreditCard, User as UserIcon,
  CheckCircle2, Scan
} from 'lucide-react'

const INITIAL_POSES = [
  { key: 'center', label: 'Center', hint: 'Look straight at the camera', file: null, preview: null },
  { key: 'left', label: 'Left', hint: 'Turn slightly to the left', file: null, preview: null },
  { key: 'right', label: 'Right', hint: 'Turn slightly to the right', file: null, preview: null },
  { key: 'chin_up', label: 'Chin Up', hint: 'Tilt your chin slightly up', file: null, preview: null },
  { key: 'chin_down', label: 'Chin Down', hint: 'Tilt your chin slightly down', file: null, preview: null },
]

export const EditUserModal = ({
  user,
  onClose,
  onSaved
}) => {
  const [activeTab, setActiveTab] = useState('profile')

  // Keyboard close
  useEffect(() => {
    const onKeydown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [onClose])

  // ─── Profile Tab State ───
  const [formData, setFormData] = useState({
    email: user.email || '',
    phone: user.phone || '',
    profile: {
      ...user.profile,
      full_name: user.profile?.full_name || '',
      hostel_flag: user.profile?.hostel_flag || false,
      hostel_id: user.profile?.hostel_id || undefined,
      school: user.profile?.school || '',
      department: user.profile?.department || '',
      course: user.profile?.course || '',
      semester: user.profile?.semester || '',
      designation: user.profile?.designation || '',
      employee_id: user.profile?.employee_id || '',
      roll_number: user.profile?.roll_number || '',
      guardian_contact: user.profile?.guardian_contact || '',
    }
  })
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  const handleSaveProfile = async () => {
    setProfileError('')
    setIsProfileLoading(true)
    try {
      await userService.update(user.id, {
        phone: formData.phone,
        profile: formData.profile
      })
      setProfileSuccess(true)
      setTimeout(() => {
        setProfileSuccess(false)
        onSaved()
      }, 1000)
    } catch (e) {
      setProfileError(e.response?.data?.error?.message || 'Update failed')
    } finally {
      setIsProfileLoading(false)
    }
  }

  // ─── Face Tab State ───
  const [poses, setPoses] = useState(INITIAL_POSES)
  const [currentPoseIdx, setCurrentPoseIdx] = useState(0)
  const [isFaceLoading, setIsFaceLoading] = useState(false)
  const [faceError, setFaceError] = useState('')
  const [faceSuccess, setFaceSuccess] = useState(false)

  const currentPose = poses[currentPoseIdx]
  const capturedCount = poses.filter((p) => p.file !== null).length

  const handleAutoCapture = (file) => {
    const updated = [...poses]
    updated[currentPoseIdx] = {
      ...updated[currentPoseIdx],
      file,
      preview: URL.createObjectURL(file)
    }
    setPoses(updated)

    // Advance to next uncaptured pose
    const next = updated.findIndex((p, i) => i > currentPoseIdx && !p.file)
    if (next !== -1) {
      setCurrentPoseIdx(next)
    }
  }

  const handleRegisterFace = async () => {
    const uncaptured = poses.filter((p) => !p.file)
    if (uncaptured.length > 0) {
      setFaceError(`Please capture all 5 poses (${uncaptured.map((p) => p.label).join(', ')} missing)`)
      return
    }

    setFaceError('')
    setIsFaceLoading(true)
    try {
      await registerPerson({
        externalId: user.id,
        name: user.profile?.full_name || user.email,
        personType: user.user_type,
        email: user.email,
        images: poses.map((p) => p.file),
        poses: poses.map((p) => p.key)
      })
      setFaceSuccess(true)
      setTimeout(() => {
        setFaceSuccess(false)
        onSaved()
      }, 1200)
    } catch (e) {
      setFaceError(e.response?.data?.detail || e.message || 'Face enrollment failed')
    } finally {
      setIsFaceLoading(false)
    }
  }

  // ─── RFID Tab State ───
  const [rfidUid, setRfidUid] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isRfidLoading, setIsRfidLoading] = useState(false)
  const [rfidError, setRfidError] = useState('')
  const [rfidSuccess, setRfidSuccess] = useState(false)

  const handleScanRFID = async () => {
    setRfidError('')
    setIsScanning(true)
    try {
      const result = await rfidService.scan()
      setRfidUid(result.uid)
    } catch (e) {
      setRfidError(e.response?.data?.error?.message || 'RFID Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const handleAssignRFID = async () => {
    if (!rfidUid) return
    setRfidError('')
    setIsRfidLoading(true)
    try {
      await userService.enrollRFID(user.id, rfidUid)
      await userService.issueCard(user.id)
      setRfidSuccess(true)
      setTimeout(() => {
        setRfidSuccess(false)
        onSaved()
      }, 1000)
    } catch (e) {
      setRfidError(e.response?.data?.error?.message || 'Failed to assign RFID card')
    } finally {
      setIsRfidLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl glass-panel p-0 overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--bg-card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a2342]/8 text-[#0a2342] flex items-center justify-center font-bold">
              {(user.profile?.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-extrabold">{user.profile?.full_name || 'Edit User'}</h2>
              <p className="text-xs text-muted font-mono">{user.email} · {user.user_type}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted">
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[var(--border-light)] px-6 bg-[var(--bg-card)]">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'profile'
                ? 'border-[#f5bd19] text-[#0a2342]'
                : 'border-transparent text-muted hover:text-[#0a2342]'
            }`}
          >
            <UserIcon size={16} /> Profile Details
          </button>
          <button
            onClick={() => setActiveTab('face')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'face'
                ? 'border-[#f5bd19] text-[#0a2342]'
                : 'border-transparent text-muted hover:text-[#0a2342]'
            }`}
          >
            <Camera size={16} /> Face Enrollment
          </button>
          <button
            onClick={() => setActiveTab('rfid')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'rfid'
                ? 'border-[#f5bd19] text-[#0a2342]'
                : 'border-transparent text-muted hover:text-[#0a2342]'
            }`}
          >
            <CreditCard size={16} /> RFID Credential
          </button>
        </div>

        {/* Tab contents */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ─── Profile Tab ─── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <UserProfileForm
                formData={formData}
                onChange={setFormData}
                persona={user.user_type}
                isEdit={true}
              />
              {profileError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-200">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Profile updated successfully!
                </div>
              )}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveProfile}
                  disabled={isProfileLoading}
                  className="btn btn-primary"
                >
                  {isProfileLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* ─── Face Tab ─── */}
          {activeTab === 'face' && (
            <div className="space-y-6">
              <div className="flex gap-2 justify-center flex-wrap">
                {poses.map((pose, idx) => (
                  <button
                    key={pose.key}
                    type="button"
                    onClick={() => setCurrentPoseIdx(idx)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all w-24 ${
                      idx === currentPoseIdx
                        ? 'border-[#f5bd19] bg-[#f5bd19]/5 scale-105'
                        : pose.file
                        ? 'border-emerald-500/50 bg-emerald-50'
                        : 'border-[var(--border-light)]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden border flex items-center justify-center text-sm font-bold bg-white">
                      {pose.preview ? (
                        <img src={pose.preview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className="text-[11px] font-bold">{pose.label}</span>
                  </button>
                ))}
              </div>

              <div className="text-center">
                <h3 className="text-base font-bold mb-1">{currentPose.label}</h3>
                <p className="text-xs text-muted mb-4">{currentPose.hint}</p>
                <div className="flex justify-center mb-3">
                  <FaceOvalCamera
                    mode="registration"
                    targetPose={currentPose.key}
                    isActive={activeTab === 'face'}
                    onCapture={handleAutoCapture}
                  />
                </div>
                <p className="text-xs text-muted">{capturedCount} / {poses.length} poses captured</p>
              </div>

              {faceError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-200">
                  {faceError}
                </div>
              )}
              {faceSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Face enrolled successfully!
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleRegisterFace}
                  disabled={isFaceLoading || capturedCount < 5}
                  className="btn btn-primary"
                >
                  {isFaceLoading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                  Enroll Face ({capturedCount}/5)
                </button>
              </div>
            </div>
          )}

          {/* ─── RFID Tab ─── */}
          {activeTab === 'rfid' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)]">
                <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Current Hardware Token</p>
                {user.active_rfid ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="text-emerald-600" size={24} />
                      <div>
                        <p className="font-mono font-bold text-base">{user.active_rfid}</p>
                        <span className="badge badge-active">Active</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">No active RFID tag assigned to this user.</p>
                )}
              </div>

              <div className="p-4 rounded-xl border border-[var(--border-light)] bg-[var(--bg-main)] space-y-4">
                <h4 className="font-bold text-sm">Assign New / Replacement RFID Tag</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={rfidUid}
                    onChange={(e) => setRfidUid(e.target.value)}
                    placeholder="Scan or type RFID UID…"
                    className="form-input font-mono flex-1"
                  />
                  <button
                    onClick={handleScanRFID}
                    disabled={isScanning}
                    className="btn btn-outline"
                  >
                    {isScanning ? <Loader2 className="animate-spin" size={16} /> : <Scan size={16} />}
                    Scan
                  </button>
                </div>

                {rfidError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-200">
                    {rfidError}
                  </div>
                )}
                {rfidSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 size={16} /> RFID assigned successfully!
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleAssignRFID}
                    disabled={!rfidUid || isRfidLoading}
                    className="btn btn-primary"
                  >
                    {isRfidLoading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                    Issue Card
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditUserModal
