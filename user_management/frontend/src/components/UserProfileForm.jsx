import React, { useState, useEffect } from 'react'
import {
  UserRound, Mail, Phone, Hash, Building2, BookOpen,
  Award, Home, Briefcase, Users, Wrench
} from 'lucide-react'
import userService from '@/services/userService'
import PassportPhotoCapture from '@/components/PassportPhotoCapture'

const ID_OPTIONS = {
  indian: ['Aadhaar card', 'Voter ID', 'Driving licence', 'PAN card', 'Passport'],
  international: ['Passport', 'Student visa', 'National identity card'],
  nri: ['Indian passport', 'OCI card', 'Overseas passport'],
}

const schoolDepartments = {
  'School of Technology, Communication and Management': [
    'Department of Computer Sciences',
    'Department of Tourism Management',
    'Department of Journalism & Mass Communication',
    'Department of Animation and Visual Effects',
  ],
  'School of Biological Sciences and Sustainability': [
    'Department of Rural Management',
    'Department of Environmental Science',
  ],
  'School of Education, Humanities and Social Sciences': [
    'Department of Education',
    'Department of Psychology',
    'Department of English',
  ],
  'School of Indology': [
    'Department of Sanskrit and Vedic Studies',
    'Department of Hindi',
    'Department of History and Indian Culture',
    'Department of Indian Classical Music',
    'Department of Oriental Studies, Religious Studies & Philosophy',
    'Department of Yogic Sciences and Human Consciousness',
  ]
}

const departmentCourses = {
  'Department of Computer Sciences': ['B.Sc. IT', 'BCA', 'MCA'],
  'Department of Tourism Management': ['BBA Tourism', 'MBA Tourism'],
  'Department of Journalism & Mass Communication': ['B.A. Mass Comm', 'M.A. Mass Comm'],
  'Department of Animation and Visual Effects': ['B.Sc. Animation', 'M.Sc. Animation'],
  'Department of Rural Management': ['BBA Rural Management', 'MBA Rural Management'],
  'Department of Environmental Science': ['B.Sc. Environmental Science', 'M.Sc. Environmental Science'],
  'Department of Education': ['B.Ed.', 'M.Ed.'],
  'Department of Psychology': ['B.A. Psychology', 'M.A. Clinical Psychology'],
  'Department of English': ['B.A. English (Honors)', 'M.A. English'],
  'Department of Sanskrit and Vedic Studies': ['B.A. Sanskrit (Honors)', 'M.A. Sanskrit'],
  'Department of Hindi': ['B.A. Hindi (Honors)', 'M.A. Hindi'],
  'Department of History and Indian Culture': ['B.A. History (Honors)', 'M. A. History and Indian Culture'],
  'Department of Indian Classical Music': [
    'B.A. Music (Vocal) (Honors)',
    'M.A. Music (Vocal)',
    'B.A. Music Instrumental Mridang/Tabla (Honors)',
    'M.A. Music (Tabla, Pakhaawaj)',
  ],
  'Department of Oriental Studies, Religious Studies & Philosophy': ['M.A. Hindu Studies', 'M.A. Philosophy'],
  'Department of Yogic Sciences and Human Consciousness': [
    'B.Sc. Yogic Science (Honors)',
    'M.Sc. Yoga Therapy',
    'M.A. Human Consciousness & Yogic Science',
    'M.Sc. Human Consciousness & Yogic Science',
    'P. G. Diploma Human Consciousness, Yoga & Alternative Therapy',
    'Certificate In Yoga And Alternative Therapy',
  ],
}

const semesters = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))

export const UserProfileForm = ({
  formData,
  onChange,
  persona,
  isEdit = false
}) => {
  const [dbDepartments, setDbDepartments] = useState([])
  const [dbHostels, setDbHostels] = useState([])

  useEffect(() => {
    userService.getDepartments().then(setDbDepartments).catch(console.error)
    userService.getHostels().then(setDbHostels).catch(console.error)
  }, [])

  const profile = formData.profile || {}

  const updateField = (field, value) => {
    if (field === 'email' || field === 'phone') {
      onChange({ ...formData, [field]: value })
    } else {
      onChange({
        ...formData,
        profile: {
          ...profile,
          [field]: value
        }
      })
    }
  }

  const handleSchoolChange = (school) => {
    onChange({
      ...formData,
      profile: {
        ...profile,
        school,
        department: '',
        department_id: null,
        course: ''
      }
    })
  }

  const handleDeptChange = (department) => {
    const dbDept = (dbDepartments || []).find((d) => d.name === department)
    onChange({
      ...formData,
      profile: {
        ...profile,
        department,
        department_id: dbDept ? dbDept.id : null,
        course: ''
      }
    })
  }

  const handleNationalityChange = (nationality) => {
    // Keep the nationality and the dependent ID selection in one state update.
    // Two consecutive updateField calls use the same render snapshot and can
    // otherwise restore the old nationality, leaving the ID dropdown disabled.
    onChange({
      ...formData,
      profile: {
        ...profile,
        nationality,
        gov_id_type: '',
      },
    })
  }

  const availableDepartments = profile.school ? schoolDepartments[profile.school] || [] : []
  const availableCourses = profile.department ? departmentCourses[profile.department] || [] : []

  return (
    <div className="space-y-6">
      {/* ─── Identity Information ─── */}
      <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
          <UserRound size={16} className="text-[#f5bd19]" />
          <span>General Information</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-5 xl:items-end">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group col-span-1 sm:col-span-2">
            <label className="form-label">Full Name *</label>
            <div className="relative">
              <input
                type="text"
                required
                value={profile.full_name || ''}
                onChange={(e) => updateField('full_name', e.target.value)}
                className="form-input"
                placeholder="Enter name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="email"
                required
                disabled={isEdit}
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                className="form-input pl-9"
                placeholder="Enter email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="tel"
                required
                value={formData.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className="form-input pl-9"
                placeholder="Enter phone no."
              />
            </div>
          </div>
          </div>
          <div>
          <PassportPhotoCapture value={profile.photo_reference || ''} onChange={(value) => updateField('photo_reference', value)} required={!isEdit} />
          </div>
        </div>
      </div>

      {/* ─── Persona Specific Details ─── */}
      {persona === 'student' && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <BookOpen size={16} className="text-[#f5bd19]" />
            <span>Academic Programme & Enrollment</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Roll Number *</label>
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  value={profile.roll_number || ''}
                  onChange={(e) => updateField('roll_number', e.target.value)}
                  className="form-input pl-9 font-mono"
                  placeholder="Enter Scholar id"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nationality *</label>
              <select required value={profile.nationality || ''} onChange={(e) => handleNationalityChange(e.target.value)} className="form-input form-select">
                <option value="">Select nationality...</option>
                <option value="indian">Indian</option>
                <option value="international">International student</option>
                <option value="nri">NRI</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Government ID type *</label>
              <select required disabled={!profile.nationality} value={profile.gov_id_type || ''} onChange={(e) => updateField('gov_id_type', e.target.value)} className="form-input form-select">
                <option value="">Select proof...</option>
                {(ID_OPTIONS[profile.nationality] || []).map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Government ID number *</label>
              <input type="text" required value={profile.gov_id_number || ''} onChange={(e) => updateField('gov_id_number', e.target.value)} className="form-input" placeholder="Enter ID number" />
            </div>

            <div className="form-group">
              <label className="form-label">School / Faculty *</label>
              <select
                required
                value={profile.school || ''}
                onChange={(e) => handleSchoolChange(e.target.value)}
                className="form-input form-select"
              >
                <option value="">Select school...</option>
                {Object.keys(schoolDepartments).map((sch) => (
                  <option key={sch} value={sch}>
                    {sch}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Department *</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <select
                  required
                  disabled={!profile.school}
                  value={profile.department || ''}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="form-input form-select pl-9"
                >
                  <option value="">Select department...</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Degree / Course *</label>
              <select
                required
                disabled={!profile.department}
                value={profile.course || ''}
                onChange={(e) => updateField('course', e.target.value)}
                className="form-input form-select"
              >
                <option value="">Select course...</option>
                {availableCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Current Semester *</label>
              <select
                required
                value={profile.semester || ''}
                onChange={(e) => updateField('semester', e.target.value)}
                className="form-input form-select"
              >
                <option value="">Select semester...</option>
                {semesters.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Guardian Contact Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="tel"
                  value={profile.guardian_contact || ''}
                  onChange={(e) => updateField('guardian_contact', e.target.value)}
                  className="form-input pl-9"
                  placeholder="Enter Guardian contact no"
                />
              </div>
            </div>

            {/* Hostel Residence */}
            <div className="form-group sm:col-span-2 xl:col-span-3 p-4 rounded-xl border border-[var(--border-light)] bg-[var(--bg-main)]">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hostel-checkbox"
                  checked={!!(profile.hostel || profile.hostel_flag)}
                  onChange={(e) => {
                    const checked = e.target.checked
                    updateField('hostel', checked)
                    updateField('hostel_flag', checked)
                    if (!checked) updateField('hostel_id', null)
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-[#f5bd19] focus:ring-[#f5bd19]"
                />
                <label htmlFor="hostel-checkbox" className="text-sm font-bold cursor-pointer">
                  Student is residing in University Hostel
                </label>
              </div>

              {(profile.hostel || profile.hostel_flag) && (
                <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
                  <label className="form-label">Hostel Residence</label>
                  <div className="relative">
                    <Home size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <select
                      value={profile.hostel_id || ''}
                      onChange={(e) => updateField('hostel_id', e.target.value || null)}
                      className="form-input form-select pl-9"
                    >
                      <option value="">Select hostel building...</option>
                      {dbHostels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {persona === 'faculty' && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <Award size={16} className="text-[#f5bd19]" />
            <span>Faculty & Appointment Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Employee ID *</label>
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  value={profile.employee_id || ''}
                  onChange={(e) => updateField('employee_id', e.target.value)}
                  className="form-input pl-9 font-mono"
                  placeholder="Enter employee id"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Designation *</label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  required
                  value={profile.designation || ''}
                  onChange={(e) => updateField('designation', e.target.value)}
                  className="form-input pl-9"
                  placeholder="Enter designation"
                />
              </div>
            </div>

            <div className="form-group sm:col-span-2 xl:col-span-3">
              <label className="form-label">Department *</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <select
                  required
                  value={profile.department || ''}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="form-input form-select pl-9"
                >
                  <option value="">Select department...</option>
                  {dbDepartments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {persona === 'worker' && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <Wrench size={16} className="text-[#f5bd19]" />
            <span>Support & Staff Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Worker ID *</label>
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  value={profile.employee_id || ''}
                  onChange={(e) => updateField('employee_id', e.target.value)}
                  className="form-input pl-9 font-mono"
                  placeholder="Enter worker id"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Role / Designation *</label>
              <input
                type="text"
                required
                value={profile.worker_role || profile.designation || ''}
                onChange={(e) => {
                  updateField('worker_role', e.target.value)
                  updateField('designation', e.target.value)
                }}
                className="form-input"
                placeholder="Enter worker role"
              />
            </div>
          </div>
        </div>
      )}

      {persona === 'visitor' && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <Users size={16} className="text-[#f5bd19]" />
            <span>Visitor Pass Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Government ID Type *</label>
              <select
                value={profile.gov_id_type || 'Aadhaar'}
                onChange={(e) => updateField('gov_id_type', e.target.value)}
                className="form-input form-select"
              >
                <option value="Aadhaar">Aadhaar Card</option>
                <option value="PAN">PAN Card</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
                <option value="Voter ID">Voter ID</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">ID Number *</label>
              <input
                type="text"
                required
                value={profile.gov_id_number || ''}
                onChange={(e) => updateField('gov_id_number', e.target.value)}
                className="form-input font-mono"
                placeholder="XXXX-XXXX-XXXX"
              />
            </div>

            <div className="form-group sm:col-span-2 xl:col-span-3">
              <label className="form-label">Purpose of Visit *</label>
              <input
                type="text"
                required
                value={profile.visit_purpose || ''}
                onChange={(e) => updateField('visit_purpose', e.target.value)}
                className="form-input"
                placeholder="Enter purpose of visit"
              />
            </div>

            <div className="form-group sm:col-span-2 xl:col-span-3">
              <label className="form-label">Host Contact / Department(Optional)</label>
              <input
                type="text"
                value={profile.host_contact || ''}
                onChange={(e) => updateField('host_contact', e.target.value)}
                className="form-input"
                placeholder="Enter host /contact"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfileForm
