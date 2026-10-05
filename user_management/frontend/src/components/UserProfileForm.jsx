import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Briefcase,
  BuildingOffice,
  Envelope,
  Hash,
  House,
  Medal,
  Phone,
  UserCircle,
  Users,
  Wrench
} from "@phosphor-icons/react";
import userService from "@/services/userService";
import PassportPhotoCapture from "@/components/PassportPhotoCapture";
import AcademicBatchSelect from "@/components/common/AcademicBatchSelect";

const ID_OPTIONS = {
  indian: [
    "Aadhaar card",
    "Voter ID",
    "Driving licence",
    "PAN card",
    "Passport",
  ],
  international: ["Passport", "Student visa", "National identity card"],
  nri: ["Indian passport", "OCI card", "Overseas passport"],
};
const schoolDepartments = {
  "School of Technology, Communication and Management": [
    "Department of Computer Sciences",
    "Department of Tourism Management",
    "Department of Journalism & Mass Communication",
    "Department of Animation and Visual Effects",
  ],
  "School of Biological Sciences and Sustainability": [
    "Department of Rural Management",
    "Department of Environmental Science",
  ],
  "School of Education, Humanities and Social Sciences": [
    "Department of Education",
    "Department of Psychology",
    "Department of English",
  ],
  "School of Indology": [
    "Department of Sanskrit and Vedic Studies",
    "Department of Hindi",
    "Department of History and Indian Culture",
    "Department of Indian Classical Music",
    "Department of Oriental Studies, Religious Studies & Philosophy",
    "Department of Yogic Sciences and Human Consciousness",
  ],
};

const departmentCourses = {
  "Department of Computer Sciences": ["B.Sc. IT", "BCA", "MCA"],
  "Department of Tourism Management": ["BBA Tourism", "MBA Tourism"],
  "Department of Journalism & Mass Communication": [
    "B.A. Mass Comm",
    "M.A. Mass Comm",
  ],
  "Department of Animation and Visual Effects": [
    "B.Sc. Animation",
    "M.Sc. Animation",
  ],
  "Department of Rural Management": [
    "BBA Rural Management",
    "MBA Rural Management",
  ],
  "Department of Environmental Science": [
    "B.Sc. Environmental Science",
    "M.Sc. Environmental Science",
  ],
  "Department of Education": ["B.Ed.", "M.Ed."],
  "Department of Psychology": ["B.A. Psychology", "M.A. Clinical Psychology"],
  "Department of English": ["B.A. English (Honors)", "M.A. English"],
  "Department of Sanskrit and Vedic Studies": [
    "B.A. Sanskrit (Honors)",
    "M.A. Sanskrit",
  ],
  "Department of Hindi": ["B.A. Hindi (Honors)", "M.A. Hindi"],
  "Department of History and Indian Culture": [
    "B.A. History (Honors)",
    "M. A. History and Indian Culture",
  ],
  "Department of Indian Classical Music": [
    "B.A. Music (Vocal) (Honors)",
    "M.A. Music (Vocal)",
    "B.A. Music Instrumental Mridang/Tabla (Honors)",
    "M.A. Music (Tabla, Pakhaawaj)",
  ],
  "Department of Oriental Studies, Religious Studies & Philosophy": [
    "M.A. Hindu Studies",
    "M.A. Philosophy",
  ],
  "Department of Yogic Sciences and Human Consciousness": [
    "B.Sc. Yogic Science (Honors)",
    "M.Sc. Yoga Therapy",
    "M.A. Human Consciousness & Yogic Science",
    "M.Sc. Human Consciousness & Yogic Science",
    "P. G. Diploma Human Consciousness, Yoga & Alternative Therapy",
    "Certificate In Yoga And Alternative Therapy",
  ],
};

const semesters = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: `Semester ${i + 1}`,
}));
const fallbackDepartments = Object.entries(schoolDepartments).flatMap(
  ([school, names]) => names.map((name) => ({ name, school })),
);

export const UserProfileForm = ({
  formData,
  onChange,
  persona,
  isEdit = false,
}) => {
  const [dbDepartments, setDbDepartments] = useState([]);
  const [dbHostels, setDbHostels] = useState([]);
  const [dbLocations, setDbLocations] = useState([]);

  useEffect(() => {
    userService
      .getDepartments()
      .then((items) =>
        setDbDepartments(items?.length ? items : fallbackDepartments),
      )
      .catch(() => setDbDepartments(fallbackDepartments));
    userService.getHostels().then(setDbHostels).catch(console.error);
    userService.getLocations().then(setDbLocations).catch(console.error);
  }, []);

  const profile = formData.profile || {};

  const updateField = (field, value) => {
    if (field === "email" || field === "phone") {
      onChange({ ...formData, [field]: value });
    } else {
      onChange({
        ...formData,
        profile: {
          ...profile,
          [field]: value,
        },
      });
    }
  };

  const handleSchoolChange = (school) => {
    onChange({
      ...formData,
      profile: {
        ...profile,
        school,
        department: "",
        department_id: null,
        course: "",
      },
    });
  };

  const handleDeptChange = (department) => {
    const dbDept = (dbDepartments || []).find((d) => d.name === department);
    onChange({
      ...formData,
      profile: {
        ...profile,
        department,
        department_id: dbDept ? dbDept.id : null,
        course: "",
      },
    });
  };

  const handleNationalityChange = (nationality) => {
    // Keep the nationality and the dependent ID selection in one state update.
    // Two consecutive updateField calls use the same render snapshot and can
    // otherwise restore the old nationality, leaving the ID dropdown disabled.
    onChange({
      ...formData,
      profile: {
        ...profile,
        nationality,
        gov_id_type: "",
      },
    });
  };

  const availableDepartments = profile.school
    ? schoolDepartments[profile.school] || []
    : [];
  const availableCourses = profile.department
    ? departmentCourses[profile.department] || []
    : [];

  return (
    <div className="space-y-6">
      {/* ─── Identity Information ─── */}
      <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
          <UserCircle size={16} className="text-[#f5bd19]" />
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
                  value={profile.full_name || ""}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  className="form-input"
                  placeholder="Enter name"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <div className="relative">
                <Envelope
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="email"
                  required
                  disabled={isEdit}
                  value={formData.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="form-input pl-9"
                  placeholder="Enter email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="tel"
                  required
                  value={formData.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="form-input pl-9"
                  placeholder="Enter phone no."
                />
              </div>
            </div>
          </div>
          <div>
            <PassportPhotoCapture
              value={profile.photo_reference || ""}
              onChange={(value) => updateField("photo_reference", value)}
              required={!isEdit}
            />
          </div>
        </div>
      </div>

      {/* ─── Persona Specific Details ─── */}
      {persona === "student" && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <BookOpen size={16} className="text-[#f5bd19]" />
            <span>Academic Programme & Enrollment</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Roll Number *</label>
              <div className="relative">
                <Hash
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  value={profile.roll_number || ""}
                  onChange={(e) => updateField("roll_number", e.target.value)}
                  className="form-input pl-9 font-mono"
                  placeholder="Enter Scholar id"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nationality *</label>
              <select
                required
                value={profile.nationality || ""}
                onChange={(e) => handleNationalityChange(e.target.value)}
                className="form-input form-select"
              >
                <option value="">Select nationality...</option>
                <option value="indian">Indian</option>
                <option value="international">International student</option>
                <option value="nri">NRI</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Government ID type *</label>
              <select
                required
                disabled={!profile.nationality}
                value={profile.gov_id_type || ""}
                onChange={(e) => updateField("gov_id_type", e.target.value)}
                className="form-input form-select"
              >
                <option value="">Select proof...</option>
                {(ID_OPTIONS[profile.nationality] || []).map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Government ID number *</label>
              <input
                type="text"
                required
                value={profile.gov_id_number || ""}
                onChange={(e) => updateField("gov_id_number", e.target.value)}
                className="form-input"
                placeholder="Enter ID number"
              />
            </div>

            <div className="form-group">
              <label className="form-label">School / Faculty *</label>
              <select
                required
                value={profile.school || ""}
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
                <BuildingOffice
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <select
                  required
                  disabled={!profile.school}
                  value={profile.department || ""}
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
                value={profile.course || ""}
                onChange={(e) => updateField("course", e.target.value)}
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
                value={profile.semester || ""}
                onChange={(e) => updateField("semester", e.target.value)}
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

            <div className="form-group sm:col-span-2 xl:col-span-1">
              <AcademicBatchSelect
                value={profile.batch || ""}
                onChange={(val) => updateField("batch", val)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Guardian Contact Number</label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="tel"
                  value={profile.guardian_contact || ""}
                  onChange={(e) =>
                    updateField("guardian_contact", e.target.value)
                  }
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
                    const checked = e.target.checked;
                    updateField("hostel", checked);
                    updateField("hostel_flag", checked);
                    if (!checked) {
                      updateField("hostel_id", null);
                      updateField("room_number", "");
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-[#f5bd19] focus:ring-[#f5bd19]"
                />
                <label
                  htmlFor="hostel-checkbox"
                  className="text-sm font-bold cursor-pointer"
                >
                  Student is residing in University Hostel
                </label>
              </div>

              {(profile.hostel || profile.hostel_flag) && (
                <div className="mt-3 pt-3 border-t border-[var(--border-light)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Hostel Residence</label>
                    <div className="relative">
                      <House
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <select
                        value={profile.hostel_id || ""}
                        onChange={(e) =>
                          updateField("hostel_id", e.target.value || null)
                        }
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
                  <div>
                    <label className="form-label">Hostel Room Number</label>
                    <input
                      type="text"
                      value={profile.room_number || ""}
                      onChange={(e) =>
                        updateField("room_number", e.target.value)
                      }
                      className="form-input"
                      placeholder="e.g. Room 304, 3rd Floor"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(persona === "faculty" || persona === "faculty_warden") && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <Medal size={16} className="text-[#f5bd19]" />
            <span>Faculty & Academic Appointment</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Faculty ID / Employee ID *</label>
              <div className="relative">
                <Hash
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  value={profile.employee_id || ""}
                  onChange={(e) => updateField("employee_id", e.target.value)}
                  className="form-input pl-9 font-mono"
                  placeholder="e.g. FAC001"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Designation *</label>
              <div className="relative">
                <Briefcase
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="text"
                  required
                  value={profile.designation || ""}
                  onChange={(e) => updateField("designation", e.target.value)}
                  className="form-input pl-9"
                  placeholder="e.g. Associate Professor"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Department *</label>
              <div className="relative">
                <BuildingOffice
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <select
                  required
                  value={profile.department || ""}
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

            {!isEdit && (
              <div className="form-group sm:col-span-2 xl:col-span-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={Boolean(profile.is_warden)}
                    onChange={(e) => updateField("is_warden", e.target.checked)}
                  />
                  Also assigned as a hostel warden
                </label>
                {profile.is_warden && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">
                        Hostel Block / Location
                      </label>
                      <input
                        value={profile.hostel_block || ""}
                        onChange={(e) =>
                          updateField("hostel_block", e.target.value)
                        }
                        className="form-input"
                        placeholder="e.g. Block A · Senior Wing"
                      />
                    </div>
                    <div>
                      <label className="form-label">
                        Warden Responsibilities
                      </label>
                      <input
                        value={profile.warden_responsibilities || ""}
                        onChange={(e) =>
                          updateField("warden_responsibilities", e.target.value)
                        }
                        className="form-input"
                        placeholder="Brief responsibilities"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-group sm:col-span-2">
              <label className="form-label">Courses / Subjects Taught *</label>
              <input
                type="text"
                value={profile.courses || ""}
                onChange={(e) => updateField("courses", e.target.value)}
                className="form-input"
                placeholder="e.g. Data Structures, Cloud Computing, AI"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Students / Advisees</label>
              <input
                type="text"
                value={profile.assigned_students || ""}
                onChange={(e) =>
                  updateField("assigned_students", e.target.value)
                }
                className="form-input"
                placeholder="e.g. 25 Advisees (Batch 2024)"
              />
            </div>
          </div>
        </div>
      )}

      {(persona === "faculty_warden" || persona === "warden") && (
        <div className="rounded-xl border border-amber-300 p-5 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-amber-950 border-b border-amber-200 pb-2">
            <House size={16} className="text-amber-600" />
            <span>Hostel Warden Governance Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Assigned Hostel *</label>
              <select
                required
                value={profile.hostel_id || ""}
                onChange={(e) =>
                  updateField("hostel_id", e.target.value || null)
                }
                className="form-input form-select"
              >
                <option value="">Select assigned hostel...</option>
                {dbHostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Hostel Block / Location *</label>
              <input
                type="text"
                required
                value={profile.hostel_block || ""}
                onChange={(e) => updateField("hostel_block", e.target.value)}
                className="form-input"
                placeholder="e.g. Block A - Senior Wing"
              />
            </div>

            <div className="form-group sm:col-span-2 xl:col-span-3">
              <label className="form-label">Warden Responsibilities</label>
              <input
                type="text"
                value={
                  profile.warden_responsibilities ||
                  profile.responsibilities ||
                  ""
                }
                onChange={(e) => {
                  updateField("warden_responsibilities", e.target.value);
                  updateField("responsibilities", e.target.value);
                }}
                className="form-input"
                placeholder="e.g. Hostel Caretaker, Discipline, Curfew & Gate Pass Approvals"
              />
            </div>
          </div>
        </div>
      )}

      {persona === "worker" && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <Wrench size={16} className="text-[#f5bd19]" />
            <span>Support & Operational Staff Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Worker ID *</label>
              <div className="relative">
                <Hash
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  value={profile.employee_id || ""}
                  onChange={(e) => updateField("employee_id", e.target.value)}
                  className="form-input pl-9 font-mono"
                  placeholder="e.g. WRK001"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Job Type / Trade *</label>
              <select
                value={profile.job_type || profile.worker_role || ""}
                onChange={(e) => {
                  updateField("job_type", e.target.value);
                  updateField("worker_role", e.target.value);
                  updateField("designation", e.target.value);
                }}
                className="form-input form-select"
              >
                <option value="">Select job type...</option>
                <option value="Electrician">Electrician</option>
                <option value="HVAC / Air Conditioning">
                  HVAC / Air Conditioning
                </option>
                <option value="Plumber">Plumbing</option>
                <option value="Housekeeping / Cleaning">
                  Housekeeping / Cleaning
                </option>
                <option value="Security Personnel">Security Personnel</option>
                <option value="Gardener">Gardener</option>
                <option value="Carpenter">Carpenter</option>
                <option value="IT Support">IT & Network Tech</option>
                <option value="General Maintenance">General Maintenance</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                value={profile.department || ""}
                onChange={(e) => handleDeptChange(e.target.value)}
                className="form-input form-select"
              >
                <option value="">Estate & Campus Maintenance</option>
                {dbDepartments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Campus / Building *</label>
              <select
                value={profile.assigned_location_id || ""}
                onChange={(e) =>
                  updateField("assigned_location_id", e.target.value || null)
                }
                className="form-input form-select"
              >
                <option value="">Select campus location...</option>
                {dbLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type || "Zone"})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Work Area *</label>
              <input
                type="text"
                value={profile.work_area || ""}
                onChange={(e) => updateField("work_area", e.target.value)}
                className="form-input"
                placeholder="e.g. Ground floor sub-station & labs"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shift *</label>
              <select
                value={profile.shift || "General Shift (09:00 - 17:00)"}
                onChange={(e) => updateField("shift", e.target.value)}
                className="form-input form-select"
              >
                <option value="Morning Shift (06:00 - 14:00)">
                  Morning Shift (06:00 - 14:00)
                </option>
                <option value="General Shift (09:00 - 17:00)">
                  General Shift (09:00 - 17:00)
                </option>
                <option value="Evening Shift (14:00 - 22:00)">
                  Evening Shift (14:00 - 22:00)
                </option>
                <option value="Night Shift (22:00 - 06:00)">
                  Night Shift (22:00 - 06:00)
                </option>
              </select>
            </div>
          </div>
        </div>
      )}

      {persona === "visitor" && (
        <div className="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-[#0a2342] border-b border-[var(--border-light)] pb-2">
            <Users size={16} className="text-[#f5bd19]" />
            <span>Visitor Pass Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Government ID Type *</label>
              <select
                value={profile.gov_id_type || "Aadhaar"}
                onChange={(e) => updateField("gov_id_type", e.target.value)}
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
                value={profile.gov_id_number || ""}
                onChange={(e) => updateField("gov_id_number", e.target.value)}
                className="form-input font-mono"
                placeholder="XXXX-XXXX-XXXX"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Host / Person to Visit *</label>
              <input
                type="text"
                value={profile.host_person || ""}
                onChange={(e) => updateField("host_person", e.target.value)}
                className="form-input"
                placeholder="e.g. Dr. Rajesh Verma"
              />
            </div>

            <div className="form-group sm:col-span-2">
              <label className="form-label">Purpose of Visit *</label>
              <input
                type="text"
                required
                value={profile.visit_purpose || ""}
                onChange={(e) => updateField("visit_purpose", e.target.value)}
                className="form-input"
                placeholder="Enter purpose of visit"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Host Contact (Phone/Email)</label>
              <input
                type="text"
                value={profile.host_contact || ""}
                onChange={(e) => updateField("host_contact", e.target.value)}
                className="form-input"
                placeholder="e.g. rajesh.faculty@ococ.edu"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Visit Validity / Duration</label>
              <select
                value={profile.visit_duration_days || "1"}
                onChange={(e) =>
                  updateField("visit_duration_days", e.target.value)
                }
                className="form-input form-select"
              >
                <option value="1">1 Day Pass</option>
                <option value="2">2 Days Pass</option>
                <option value="3">3 Days Pass</option>
                <option value="7">7 Days Pass</option>
                <option value="14">14 Days Pass</option>
                <option value="30">30 Days Pass</option>
              </select>
            </div>

            <div className="form-group sm:col-span-2 xl:col-span-3">
              <label className="form-label">Allowed Campus Locations</label>
              <div className="flex flex-wrap gap-2 p-2.5 rounded-lg border border-[var(--border-light)] bg-white max-h-28 overflow-y-auto">
                {dbLocations.map((loc) => {
                  const locIds = profile.allowed_location_ids || [];
                  const isChecked = locIds.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        const updated = isChecked
                          ? locIds.filter((id) => id !== loc.id)
                          : [...locIds, loc.id];
                        updateField("allowed_location_ids", updated);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-bold border transition ${
                        isChecked
                          ? "bg-orange-500 text-white border-orange-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {isChecked ? "✓ " : "+ "}
                      {loc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileForm;
