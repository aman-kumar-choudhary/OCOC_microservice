<script setup lang="ts">
import { computed } from 'vue'
import { UserRound, Mail, Phone, Hash, Building2, BookOpen, ChevronDown, Award, Home, Briefcase, Users, Wrench } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: {
    email: string
    phone: string
    profile: any
  }
  persona: string
  isEdit?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

// ─── DSVV Academic Hierarchy ───────────────────────────────────────
const schoolDepartments: Record<string, string[]> = {
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

const departmentCourses: Record<string, string[]> = {
  'Department of Computer Sciences': ['B.Sc. IT', 'BCA', 'M.Sc. Data Science', 'MCA'],
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

const availableDepartments = computed(() => {
  if (!props.modelValue.profile.school) return []
  return schoolDepartments[props.modelValue.profile.school] || []
})

const availableCourses = computed(() => {
  if (!props.modelValue.profile.department) return []
  return departmentCourses[props.modelValue.profile.department] || []
})

function onSchoolChange() {
  const v = { ...props.modelValue }
  v.profile.department = ''
  v.profile.course = ''
  emit('update:modelValue', v)
}

function onDeptChange() {
  const v = { ...props.modelValue }
  v.profile.course = ''
  emit('update:modelValue', v)
}
</script>

<template>
  <div>
    <!-- ── Common fields ── -->
    <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
      <Users :size="14" /> Personal Information
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div class="form-group !mb-0">
        <label class="form-label">Full Name *</label>
        <div class="relative">
          <UserRound :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input v-model="modelValue.profile.full_name" type="text" required class="form-input pl-9" placeholder="e.g. Arjun Sharma" />
        </div>
      </div>
      <div class="form-group !mb-0">
        <label class="form-label">Email Address *</label>
        <div class="relative">
          <Mail :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input v-model="modelValue.email" type="email" required :disabled="isEdit" class="form-input pl-9 disabled:opacity-50" placeholder="arjun@dsvv.ac.in" />
        </div>
      </div>
      <div class="form-group !mb-0 md:col-span-2">
        <label class="form-label">Phone Number</label>
        <div class="relative">
          <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input v-model="modelValue.phone" type="tel" class="form-input pl-9" placeholder="+91 9876543210" />
        </div>
      </div>
    </div>

    <!-- ── Student Fields ── -->
    <template v-if="persona === 'student'">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2 pt-2 border-t border-[var(--border-light)]">
        <Hash :size="14" /> Student Identity
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="form-group !mb-0">
          <label class="form-label">Roll Number *</label>
          <div class="relative">
            <Hash :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.roll_number" type="text" required class="form-input pl-9" placeholder="CS24001" />
          </div>
        </div>
        <div class="form-group !mb-0">
          <label class="form-label">Guardian Contact</label>
          <div class="relative">
            <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.guardian_contact" type="tel" class="form-input pl-9" placeholder="+91 9876543210" />
          </div>
        </div>
      </div>

      <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2 pt-4 border-t border-[var(--border-light)]">
        <BookOpen :size="14" /> Academic Information
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <!-- School -->
        <div class="form-group !mb-0 md:col-span-2">
          <label class="form-label">School *</label>
          <div class="relative">
            <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <select
              v-model="modelValue.profile.school"
              @change="onSchoolChange"
              required
              class="form-input form-select pl-9 pr-9 appearance-none"
            >
              <option value="">Select School…</option>
              <option v-for="school in Object.keys(schoolDepartments)" :key="school" :value="school">{{ school }}</option>
            </select>
          </div>
        </div>

        <!-- Department -->
        <div class="form-group !mb-0 md:col-span-2">
          <label class="form-label">Department *</label>
          <div class="relative">
            <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <select
              v-model="modelValue.profile.department"
              @change="onDeptChange"
              required
              :disabled="!modelValue.profile.school"
              class="form-input form-select pl-9 pr-9 appearance-none disabled:opacity-50"
            >
              <option value="">{{ modelValue.profile.school ? 'Select Department…' : 'Select school first' }}</option>
              <option v-for="dept in availableDepartments" :key="dept" :value="dept">{{ dept }}</option>
            </select>
          </div>
        </div>

        <!-- Course -->
        <div class="form-group !mb-0 md:col-span-2">
          <label class="form-label">Course / Programme *</label>
          <div class="relative">
            <BookOpen :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <select
              v-model="modelValue.profile.course"
              required
              :disabled="!modelValue.profile.department"
              class="form-input form-select pl-9 pr-9 appearance-none disabled:opacity-50"
            >
              <option value="">{{ modelValue.profile.department ? 'Select Course…' : 'Select department first' }}</option>
              <option v-for="course in availableCourses" :key="course" :value="course">{{ course }}</option>
            </select>
          </div>
        </div>

        <!-- Semester -->
        <div class="form-group !mb-0">
          <label class="form-label">Semester *</label>
          <div class="relative">
            <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <select v-model="modelValue.profile.semester" required class="form-input form-select pr-9 appearance-none">
              <option value="">Select Semester…</option>
              <option v-for="s in semesters" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
        </div>

        <!-- Hostel Dropdown -->
        <div class="form-group !mb-0">
          <label class="form-label">Hostel Resident</label>
          <div class="relative mt-1">
            <Home :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <select v-model="modelValue.profile.hostel_flag" class="form-input form-select pl-9 pr-9 appearance-none">
              <option :value="false">No (Day Scholar)</option>
              <option :value="true">Yes (Hostel)</option>
            </select>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Faculty Fields ── -->
    <template v-else-if="persona === 'faculty'">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2 pt-2 border-t border-[var(--border-light)]">
        <Briefcase :size="14" /> Faculty Information
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="form-group !mb-0">
          <label class="form-label">Employee ID *</label>
          <div class="relative">
            <Hash :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.employee_id" type="text" required class="form-input pl-9" placeholder="FAC001" />
          </div>
        </div>
        <div class="form-group !mb-0">
          <label class="form-label">Designation *</label>
          <div class="relative">
            <Award :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.designation" type="text" required class="form-input pl-9" placeholder="e.g. Assistant Professor" />
          </div>
        </div>
        <div class="form-group !mb-0 md:col-span-2">
          <label class="form-label">Department *</label>
          <div class="relative">
            <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.department" type="text" required class="form-input pl-9" placeholder="e.g. Department of Computer Sciences" />
          </div>
        </div>
      </div>
    </template>

    <!-- ── Worker Fields ── -->
    <template v-else-if="persona === 'worker'">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2 pt-2 border-t border-[var(--border-light)]">
        <Wrench :size="14" /> Worker Information
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="form-group !mb-0">
          <label class="form-label">Employee ID *</label>
          <div class="relative">
            <Hash :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.employee_id" type="text" required class="form-input pl-9" placeholder="WRK001" />
          </div>
        </div>
        <div class="form-group !mb-0">
          <label class="form-label">Role / Designation *</label>
          <div class="relative">
            <Briefcase :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.worker_role" type="text" required class="form-input pl-9" placeholder="e.g. Security Staff" />
          </div>
        </div>
      </div>
    </template>

    <!-- ── Visitor Fields ── -->
    <template v-else-if="persona === 'visitor'">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2 pt-2 border-t border-[var(--border-light)]">
        <UserRound :size="14" /> Visitor Information
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="form-group !mb-0">
          <label class="form-label">Government ID Type *</label>
          <select v-model="modelValue.profile.gov_id_type" required class="form-input form-select">
            <option value="">Select ID type…</option>
            <option value="Aadhaar">Aadhaar</option>
            <option value="PAN">PAN</option>
            <option value="Passport">Passport</option>
            <option value="Driving License">Driving License</option>
          </select>
        </div>
        <div class="form-group !mb-0">
          <label class="form-label">Government ID Number *</label>
          <div class="relative">
            <Hash :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.gov_id_number" type="text" required class="form-input pl-9" placeholder="ID number" />
          </div>
        </div>
        <div class="form-group !mb-0">
          <label class="form-label">Visit Purpose *</label>
          <div class="relative">
            <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.visit_purpose" type="text" required class="form-input pl-9" placeholder="e.g. Meeting with IT Dept" />
          </div>
        </div>
        <div class="form-group !mb-0">
          <label class="form-label">Host Contact *</label>
          <div class="relative">
            <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.host_contact" type="text" required class="form-input pl-9" placeholder="Who are you visiting?" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
