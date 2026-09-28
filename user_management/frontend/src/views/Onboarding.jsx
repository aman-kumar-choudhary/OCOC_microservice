import React, { useState, useMemo } from 'react'
import userService from '@/services/userService'
import rfidService from '@/services/rfidService'
import { registerPerson } from '@/services/frecoService'
import {
  GraduationCap, Wrench, UserRound, CreditCard,
  CheckCircle, Loader2, ArrowRight, ArrowLeft, ScanFace, Award, Shield
} from 'lucide-react'
import UserProfileForm from '@/components/UserProfileForm'
import FaceOvalCamera from '@/components/FaceOvalCamera'

const POSES = [
  { key: 'center', label: 'Center', description: 'Look straight at the camera', emoji: '👤' },
  { key: 'left', label: 'Turn Left', description: 'Slowly turn your head left', emoji: '⬅️' },
  { key: 'right', label: 'Turn Right', description: 'Slowly turn your head right', emoji: '➡️' },
  { key: 'chin_up', label: 'Chin Up', description: 'Tilt your chin slightly up', emoji: '⬆️' },
  { key: 'chin_down', label: 'Chin Down', description: 'Tilt your chin slightly down', emoji: '⬇️' },
]

const personaCards = [
  {
    id: 'student',
    label: 'Student',
    subtitle: 'Enrolled in a DSVV programme',
    icon: GraduationCap,
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    iconColor: 'text-blue-600',
    activeBg: 'bg-blue-600',
  },
  {
    id: 'faculty',
    label: 'Faculty',
    subtitle: 'Teaching or research staff',
    icon: Award,
    gradient: 'from-violet-500 to-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    iconColor: 'text-violet-600',
    activeBg: 'bg-violet-600',
  },
  {
    id: 'faculty_warden',
    label: 'Faculty + Warden',
    subtitle: 'Faculty staff with hostel administration',
    icon: Shield,
    gradient: 'from-amber-500 to-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    iconColor: 'text-amber-600',
    activeBg: 'bg-amber-600',
  },
  {
    id: 'worker',
    label: 'Worker',
    subtitle: 'Support or administrative staff',
    icon: Wrench,
    gradient: 'from-emerald-500 to-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    iconColor: 'text-emerald-600',
    activeBg: 'bg-emerald-600',
  },
  {
    id: 'visitor',
    label: 'Visitor',
    subtitle: 'Guest or short-term visitor',
    icon: UserRound,
    gradient: 'from-orange-500 to-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    iconColor: 'text-orange-600',
    activeBg: 'bg-orange-600',
  },
]

export const Onboarding = () => {
  const [step, setStep] = useState(1)
  const [persona, setPersona] = useState('')

  // Form State
  const [userForm, setUserForm] = useState({
    email: '',
    phone: '',
    profile: {
      full_name: '',
      photo_reference: '',
      roll_number: '',
      batch: '2024-2028',
      school: '',
      department: '',
      department_id: null,
      course: '',
      semester: '',
      hostel: false,
      hostel_id: null,
      room_number: '',
      guardian_contact: '',
      employee_id: '',
      designation: '',
      courses: '',
      assigned_students: '',
      hostel_block: '',
      warden_responsibilities: '',
      worker_role: '',
      job_type: '',
      work_area: '',
      shift: '',
      assigned_location_id: null,
      gov_id_type: '',
      gov_id_number: '',
      nationality: '',
      visit_purpose: '',
      host_person: '',
      host_contact: '',
      valid_until: '',
      allowed_location_ids: [],
    }
  })

  // Face Pose State
  const [poseCaptures, setPoseCaptures] = useState(() =>
    Object.fromEntries(POSES.map((p) => [p.key, { file: null, url: null, captured: false }]))
  )
  const [currentPoseIdx, setCurrentPoseIdx] = useState(0)
  const [faceRegLoading, setFaceRegLoading] = useState(false)
  const [faceRegError, setFaceRegError] = useState('')
  const [faceRegSuccess, setFaceRegSuccess] = useState(false)

  // RFID State
  const [rfidUid, setRfidUid] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [createdUserId, setCreatedUserId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const capturedPosesCount = POSES.filter((p) => poseCaptures[p.key]?.captured).length
  const allPosesCaptured = capturedPosesCount === POSES.length
  const currentPose = POSES[currentPoseIdx]

  const selectedCard = useMemo(
    () => personaCards.find((c) => c.id === persona),
    [persona]
  )

  const handleAutoCapture = (file) => {
    const key = currentPose.key
    setPoseCaptures((prev) => ({
      ...prev,
      [key]: {
        file,
        url: URL.createObjectURL(file),
        captured: true
      }
    }))

    if (currentPoseIdx < POSES.length - 1) {
      setTimeout(() => {
        setCurrentPoseIdx((idx) => Math.min(idx + 1, POSES.length - 1))
      }, 600)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const p = userForm.profile
      if (!p.photo_reference) throw new Error('A passport-size photo is required.')
      if (persona === 'student' && (!p.nationality || !p.gov_id_type || !p.gov_id_number)) {
        throw new Error('Nationality and government ID type and number are required for students.')
      }
      const profilePayload = {
        full_name: p.full_name,
        photo_reference: p.photo_reference,
      }

      if (persona === 'student') {
        Object.assign(profilePayload, {
          roll_number: p.roll_number,
          school: p.school,
          department: p.department,
          department_id: p.department_id,
          course: p.course,
          semester: p.semester,
          hostel: p.hostel,
          hostel_id: p.hostel_id,
          guardian_contact: p.guardian_contact,
          nationality: p.nationality,
          gov_id_type: p.gov_id_type,
          gov_id_number: p.gov_id_number,
        })
      } else if (persona === 'faculty') {
        Object.assign(profilePayload, {
          employee_id: p.employee_id,
          department: p.department,
          department_id: p.department_id,
          designation: p.designation,
        })
      } else if (persona === 'worker') {
        Object.assign(profilePayload, {
          employee_id: p.employee_id,
          designation: p.worker_role || p.designation,
        })
      } else if (persona === 'visitor') {
        Object.assign(profilePayload, {
          gov_id_type: p.gov_id_type,
          gov_id_number: p.gov_id_number,
          visit_purpose: p.visit_purpose,
          host_contact: p.host_contact,
        })
      }

      const payload = {
        user: {
          email: userForm.email,
          phone: userForm.phone,
          password: 'Welcome@123!',
          profile: profilePayload,
        }
      }
      const result = await userService.onboard(persona, payload)
      setCreatedUserId(result.user.id)
      setStep(3) // Face Capture
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to create user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFaceRegister = async () => {
    if (!allPosesCaptured) {
      setFaceRegError('Please capture all 5 poses first')
      return
    }
    setFaceRegLoading(true)
    setFaceRegError('')
    try {
      const images = POSES.map((p) => poseCaptures[p.key].file)
      const poses = POSES.map((p) => p.key)
      const p = userForm.profile
      await registerPerson({
        externalId: createdUserId,
        name: p.full_name || userForm.email,
        personType: persona,
        email: userForm.email,
        images,
        poses,
      })
      setFaceRegSuccess(true)
      setTimeout(() => {
        setStep(4)
      }, 1200)
    } catch (err) {
      setFaceRegError(err.response?.data?.detail || err.message || 'Face registration failed')
    } finally {
      setFaceRegLoading(false)
    }
  }

  const scanRFID = async () => {
    setError('')
    setIsScanning(true)
    try {
      const result = await rfidService.scan()
      setRfidUid(result.uid)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'RFID Scan Failed')
    } finally {
      setIsScanning(false)
    }
  }

  const handleEnrollRFID = async () => {
    if (!rfidUid) return
    setError('')
    setIsLoading(true)
    try {
      await userService.enrollRFID(createdUserId, rfidUid)
      await userService.issueCard(createdUserId)
      setStep(5)
      setSuccessMsg(
        `${userForm.profile.full_name || 'User'} successfully onboarded with RFID Card ${rfidUid}`
      )
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to enroll RFID')
    } finally {
      setIsLoading(false)
    }
  }

  const skipRFID = () => {
    setStep(5)
    setSuccessMsg(
      `${userForm.profile.full_name || 'User'} successfully onboarded. RFID card can be assigned later.`
    )
  }

  const resetForm = () => {
    setStep(1)
    setPersona('')
    setRfidUid('')
    setError('')
    setCreatedUserId('')
    setPoseCaptures(Object.fromEntries(POSES.map((p) => [p.key, { file: null, url: null, captured: false }])))
    setCurrentPoseIdx(0)
    setFaceRegSuccess(false)
    setUserForm({
      email: '',
      phone: '',
      profile: {
        full_name: '',
        photo_reference: '',
        roll_number: '',
        school: '',
        department: '',
        department_id: null,
        course: '',
        semester: '',
        hostel: false,
        hostel_id: null,
        guardian_contact: '',
        employee_id: '',
        designation: '',
        worker_role: '',
        gov_id_type: '',
        gov_id_number: '',
        nationality: '',
        visit_purpose: '',
        host_contact: '',
      }
    })
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <p className="text-muted text-sm mt-1">Unified workflow for creating campus identities and issuing RFID cards.</p>
      </div>

      {/* Progress Steps */}
      <div className="app-panel p-4 mb-8">
        <div className="flex items-center gap-0">
          {[
            { n: 1, label: 'Select Type' },
            { n: 2, label: 'User Details' },
            { n: 3, label: 'Face Capture' },
            { n: 4, label: 'RFID Card' },
            { n: 5, label: 'Complete' }
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                    step > s.n
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : step === s.n
                      ? 'bg-[#f5bd19] text-[#0a2342] shadow-md ring-4 ring-[#f5bd19]/20'
                      : 'bg-[var(--border-light)] text-muted'
                  }`}
                >
                  {step > s.n ? <CheckCircle size={18} /> : <span>{s.n}</span>}
                </div>
                <span
                  className={`text-xs font-semibold mt-1.5 hidden sm:block ${
                    step >= s.n ? 'text-[var(--text-main)]' : 'text-muted'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < 4 && (
                <div
                  className={`h-0.5 flex-1 mb-5 transition-all duration-500 ${
                    step > s.n ? 'bg-emerald-400' : 'bg-[var(--border-light)]'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--status-error-bg)] text-[var(--status-error)] flex items-center gap-3 border border-red-200">
          <div className="w-1 self-stretch rounded bg-[var(--status-error)] shrink-0" />
          {error}
        </div>
      )}

      {/* ─── STEP 1: Person Type Cards ─── */}
      {step === 1 && (
        <div className="animate-fade-in">
          <div className="app-panel p-6 sm:p-8">
            <h2 className="text-xl font-extrabold mb-2">Who are you onboarding?</h2>
            <p className="text-muted text-sm mb-8">Select the person type to load the appropriate registration form.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {personaCards.map((card) => {
                const Icon = card.icon
                const isSelected = persona === card.id
                return (
                  <button
                    key={card.id}
                    onClick={() => setPersona(card.id)}
                    className={`group relative flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
                      isSelected
                        ? `border-transparent bg-gradient-to-br ${card.gradient} text-white shadow-lg scale-[1.02]`
                        : `border-[var(--border-light)] hover:border-current ${card.border} hover:${card.bg} hover:shadow-md`
                    }`}
                    id={`persona-${card.id}-btn`}
                  >
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-xl shrink-0 transition-all ${
                        isSelected ? 'bg-white/20' : card.bg
                      }`}
                    >
                      <Icon size={24} className={isSelected ? 'text-white' : card.iconColor} />
                    </div>
                    <div>
                      <p className={`font-extrabold text-base ${isSelected ? 'text-white' : 'text-[var(--text-main)]'}`}>
                        {card.label}
                      </p>
                      <p className={`text-sm mt-0.5 ${isSelected ? 'text-white/75' : 'text-muted'}`}>
                        {card.subtitle}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/25 flex items-center justify-center">
                        <CheckCircle size={16} className="text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                className="btn btn-primary px-8 py-3 text-base"
                disabled={!persona}
                onClick={() => setStep(2)}
                id="proceed-to-form-btn"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 2: User Details ─── */}
      {step === 2 && (
        <div className="animate-fade-in">
          <div className="app-panel p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-[var(--border-light)]">
              <button onClick={() => setStep(1)} className="btn btn-outline py-1.5 px-3 text-xs">
                <ArrowLeft size={14} /> Back
              </button>
              {selectedCard && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-white bg-gradient-to-r ${selectedCard.gradient}`}
                >
                  <selectedCard.icon size={15} />
                  {selectedCard.label} Registration
                </div>
              )}
            </div>

            <form onSubmit={handleCreateUser}>
              <UserProfileForm
                formData={userForm}
                onChange={setUserForm}
                persona={persona}
              />

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="submit"
                  className="btn btn-primary px-8 py-3 text-base"
                  disabled={isLoading}
                  id="create-user-btn"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <span className="flex items-center gap-2">
                      Continue to Face Registration <ArrowRight size={18} />
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Face Registration ─── */}
      {step === 3 && (
        <div className="animate-fade-in">
          <div className="glass-panel p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-[var(--border-light)]">
              <div className="w-10 h-10 rounded-xl bg-[#f5bd19]/10 text-[#0a2342] flex items-center justify-center">
                <ScanFace size={22} />
              </div>
              <div>
                <h2 className="text-xl font-extrabold">Face Registration</h2>
                <p className="text-sm text-muted">Capture 5 poses for ArcFace embedding generation</p>
              </div>
            </div>

            {/* Success banner */}
            {faceRegSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-center mb-5 flex items-center justify-center gap-2">
                <CheckCircle size={20} /> Face registered successfully! Continuing…
              </div>
            )}

            {/* Pose strip */}
            <div className="flex gap-3 justify-center flex-wrap mb-8">
              {POSES.map((pose, idx) => {
                const isCur = idx === currentPoseIdx
                const isCaptured = poseCaptures[pose.key]?.captured
                return (
                  <div
                    key={pose.key}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all w-28 ${
                      isCur
                        ? 'border-[#f5bd19] bg-[#f5bd19]/5 scale-105'
                        : isCaptured
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-[var(--border-light)] hover:border-[#f5bd19]/40'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex items-center justify-center text-2xl ${
                        isCaptured ? 'border-emerald-500' : 'border-[var(--border-light)] bg-[var(--bg-input)]'
                      }`}
                    >
                      {poseCaptures[pose.key]?.url ? (
                        <img src={poseCaptures[pose.key].url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{pose.emoji}</span>
                      )}
                    </div>
                    <span className="text-xs font-bold">{pose.label}</span>
                    {isCaptured && <CheckCircle className="text-emerald-500" size={14} />}
                  </div>
                )
              })}
            </div>

            {/* Current pose instruction */}
            {!allPosesCaptured ? (
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">{currentPose.emoji}</div>
                <h3 className="text-lg font-extrabold mb-1">{currentPose.label}</h3>
                <p className="text-muted text-sm mb-4">{currentPose.description}</p>

                <div className="mb-4">
                  <FaceOvalCamera
                    mode="registration"
                    targetPose={currentPose.key}
                    isActive={step === 3 && !allPosesCaptured}
                    onCapture={handleAutoCapture}
                  />
                </div>

                <div className="mt-3 text-xs text-muted">
                  {capturedPosesCount} / {POSES.length} poses captured
                </div>
              </div>
            ) : (
              <div className="text-center mb-6">
                <CheckCircle className="text-emerald-500 mx-auto mb-2" size={40} />
                <p className="text-emerald-600 font-bold text-lg">All 5 poses captured!</p>
                <p className="text-muted text-sm">Ready to register with Freco</p>
              </div>
            )}

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-[var(--border-light)] overflow-hidden mb-6">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(capturedPosesCount / POSES.length) * 100}%` }}
              />
            </div>

            {/* Error */}
            {faceRegError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold mb-4">
                {faceRegError}
              </div>
            )}

            <div className="flex justify-between gap-3">
              <button onClick={() => setStep(4)} className="btn btn-outline text-muted">
                Skip Face Registration
              </button>
              <button
                onClick={handleFaceRegister}
                disabled={faceRegLoading || !allPosesCaptured || faceRegSuccess}
                className="btn btn-primary px-8"
                id="register-face-btn"
              >
                {faceRegLoading ? <Loader2 className="animate-spin" size={16} /> : <ScanFace size={16} />}
                Register Face
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 4: RFID Enrollment ─── */}
      {step === 4 && (
        <div className="glass-panel p-6 sm:p-12 animate-fade-in text-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <CreditCard size={32} />
            {isScanning && (
              <span className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2">Scan RFID Card</h2>
          <p className="text-muted mb-2 max-w-md mx-auto">
            Place the new RFID card on the reader to associate it with{' '}
            <strong>{userForm.profile.full_name}</strong>.
          </p>
          <p className="text-xs text-muted mb-8 max-w-sm mx-auto">
            You can also skip this step and assign an RFID card later from the User Directory.
          </p>

          <div className="max-w-xs mx-auto mb-8 relative">
            <input
              value={rfidUid}
              type="text"
              readOnly
              className="form-input text-center font-mono text-lg tracking-widest"
              placeholder="WAITING FOR SCAN..."
            />
          </div>

          <div className="flex justify-center gap-4 flex-wrap">
            <button onClick={scanRFID} className="btn btn-outline" disabled={isScanning || isLoading}>
              {isScanning ? <Loader2 className="animate-spin" size={16} /> : <span>Trigger Scanner</span>}
            </button>
            <button
              onClick={handleEnrollRFID}
              className="btn btn-primary"
              disabled={!rfidUid || isLoading}
              id="issue-card-btn"
            >
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : <span>Issue Card</span>}
            </button>
            <button onClick={skipRFID} className="btn btn-outline text-muted text-sm" id="skip-rfid-btn">
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 5: Success ─── */}
      {step === 5 && (
        <div className="glass-panel p-12 animate-fade-in text-center">
          <div className="w-24 h-24 bg-[var(--status-active-bg)] text-[var(--status-active)] rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-100">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-[var(--status-active)]">Onboarding Complete!</h2>
          <p className="text-lg text-muted mb-8 max-w-md mx-auto">{successMsg}</p>
          <button onClick={resetForm} className="btn btn-primary px-8 py-3 text-base" id="start-new-onboarding-btn">
            <UserRound size={18} /> Start New Onboarding
          </button>
        </div>
      )}
    </div>
  )
}

export default Onboarding
