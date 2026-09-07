<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { UserRound, Mail, Phone, Hash, Building2, BookOpen, ChevronDown, Award, Home, Briefcase, Users, Wrench } from 'lucide-vue-next'
import userService from '@/services/userService'

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

const dbDepartments = ref<any[]>([])
const dbHostels = ref<any[]>([])

onMounted(async () => {
  try {
    dbDepartments.value = await userService.getDepartments()
    dbHostels.value = await userService.getHostels()
  } catch (err) {
    console.error('Failed to load reference data', err)
  }
})

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
  
  // Find department ID from DB
  const dbDept = (dbDepartments.value || []).find(d => d.name === v.profile.department)
  if (dbDept) {
    v.profile.department_id = dbDept.id
  } else {
    v.profile.department_id = null
  }
  
  emit('update:modelValue', v)
}

function onHostelFlagChange() {
  const v = { ...props.modelValue }
  if (!v.profile.hostel_flag) {
    v.profile.hostel_id = null
  }
  emit('update:modelValue', v)
}
</script>

<template>
  <div class="space-y-6">
    <!-- ── Personal & Contact Information ── -->
    <div class="rounded-xl border border-[var(--border-light)] p-5 bg-slate-50/50">
      <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 flex items-center gap-2">
        <Users :size="15" class="text-primary" /> Personal Information
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="form-group !mb-0 md:col-span-2 lg:col-span-1">
          <label class="form-label">Full Name <span class="text-red-500">*</span></label>
          <div class="relative">
            <UserRound :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input v-model="modelValue.profile.full_name" type="text" required class="form-input pl-9" placeholder="e.g. Arjun Sharma" />
          </div>
        </div>
        <div class="form-group !mb-0 md:col-span-2 lg:col-span-1">
          <label class="form-label">Email Address <span class="text-red-500">*</span></label>
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
    </div>

    <!-- ── Student Fields ── -->
    <template v-if="persona === 'student'">
      <div class="rounded-xl border border-[var(--border-light)] p-5 bg-slate-50/50">
        <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 flex items-center gap-2">
          <BookOpen :size="15" class="text-primary" /> Academic Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div class="form-group !mb-0">
            <label class="form-label">Roll Number <span class="text-red-500">*</span></label>
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

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- School -->
          <div class="form-group !mb-0 md:col-span-2">
            <label class="form-label">School <span class="text-red-500">*</span></label>
            <div class="relative">
              <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <select v-model="modelValue.profile.school" @change="onSchoolChange" required class="form-input form-select pl-9 pr-9 appearance-none">
                <option value="">Select School…</option>
                <option v-for="school in Object.keys(schoolDepartments)" :key="school" :value="school">{{ school }}</option>
              </select>
            </div>
          </div>

          <!-- Department -->
          <div class="form-group !mb-0 md:col-span-2">
            <label class="form-label">Department <span class="text-red-500">*</span></label>
            <div class="relative">
              <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <select v-model="modelValue.profile.department" @change="onDeptChange" required :disabled="!modelValue.profile.school" class="form-input form-select pl-9 pr-9 appearance-none disabled:opacity-50">
                <option value="">{{ modelValue.profile.school ? 'Select Department…' : 'Select school first' }}</option>
                <option v-for="dept in availableDepartments" :key="dept" :value="dept">{{ dept }}</option>
              </select>
            </div>
          </div>

          <!-- Course -->
          <div class="form-group !mb-0 md:col-span-2">
            <label class="form-label">Course / Programme <span class="text-red-500">*</span></label>
            <div class="relative">
              <BookOpen :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <select v-model="modelValue.profile.course" required :disabled="!modelValue.profile.department" class="form-input form-select pl-9 pr-9 appearance-none disabled:opacity-50">
                <option value="">{{ modelValue.profile.department ? 'Select Course…' : 'Select department first' }}</option>
                <option v-for="course in availableCourses" :key="course" :value="course">{{ course }}</option>
              </select>
            </div>
          </div>

          <!-- Semester -->
          <div class="form-group !mb-0 md:col-span-2 lg:col-span-1">
            <label class="form-label">Semester <span class="text-red-500">*</span></label>
            <div class="relative">
              <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <select v-model="modelValue.profile.semester" required class="form-input form-select pr-9 appearance-none">
                <option value="">Select Semester…</option>
                <option v-for="s in semesters" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Hostel Information ── -->
      <div class="rounded-xl border border-[var(--border-light)] p-5 bg-slate-50/50">
        <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 flex items-center gap-2">
          <Home :size="15" class="text-primary" /> Hostel Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- Hostel Dropdown -->
          <div class="form-group !mb-0 md:col-span-2">
            <label class="form-label">Hostel Resident?</label>
            <div class="relative">
              <Home :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <select v-model="modelValue.profile.hostel_flag" @change="onHostelFlagChange" class="form-input form-select pl-9 pr-9 appearance-none">
                <option :value="false">No (Day Scholar)</option>
                <option :value="true">Yes (Hostel Resident)</option>
              </select>
            </div>
          </div>
          
          <!-- Select Specific Hostel -->
          <div v-if="modelValue.profile.hostel_flag" class="form-group !mb-0 md:col-span-2">
            <label class="form-label">Select Hostel <span class="text-red-500">*</span></label>
            <div class="relative">
              <Home :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
              <select v-model="modelValue.profile.hostel_id" required class="form-input form-select pl-9 pr-9 appearance-none">
                <option :value="undefined">Select Hostel…</option>
                <option v-for="h in dbHostels" :key="h.id" :value="h.id">{{ h.name }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Faculty Fields ── -->
    <template v-else-if="persona === 'faculty'">
      <div class="rounded-xl border border-[var(--border-light)] p-5 bg-slate-50/50">
        <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 flex items-center gap-2">
          <Briefcase :size="15" class="text-primary" /> Faculty Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="form-group !mb-0 md:col-span-2 lg:col-span-1">
            <label class="form-label">Employee ID <span class="text-red-500">*</span></label>
            <div class="relative">
              <Hash :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.employee_id" type="text" required class="form-input pl-9" placeholder="FAC001" />
            </div>
          </div>
          <div class="form-group !mb-0 md:col-span-2 lg:col-span-1">
            <label class="form-label">Designation <span class="text-red-500">*</span></label>
            <div class="relative">
              <Award :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.designation" type="text" required class="form-input pl-9" placeholder="e.g. Assistant Professor" />
            </div>
          </div>
          <div class="form-group !mb-0 md:col-span-2">
            <label class="form-label">Department <span class="text-red-500">*</span></label>
            <div class="relative">
              <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.department" type="text" required class="form-input pl-9" placeholder="e.g. Department of Computer Sciences" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Worker Fields ── -->
    <template v-else-if="persona === 'worker'">
      <div class="rounded-xl border border-[var(--border-light)] p-5 bg-slate-50/50">
        <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 flex items-center gap-2">
          <Wrench :size="15" class="text-primary" /> Worker Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="form-group !mb-0 md:col-span-2 lg:col-span-1">
            <label class="form-label">Employee ID <span class="text-red-500">*</span></label>
            <div class="relative">
              <Hash :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.employee_id" type="text" required class="form-input pl-9" placeholder="WRK001" />
            </div>
          </div>
          <div class="form-group !mb-0 md:col-span-2 lg:col-span-1">
            <label class="form-label">Role / Designation <span class="text-red-500">*</span></label>
            <div class="relative">
              <Briefcase :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.designation" type="text" required class="form-input pl-9" placeholder="e.g. Security Staff" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Visitor Fields ── -->
    <template v-else-if="persona === 'visitor'">
      <div class="rounded-xl border border-[var(--border-light)] p-5 bg-slate-50/50">
        <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 flex items-center gap-2">
          <UserRound :size="15" class="text-primary" /> Visitor Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="form-group !mb-0">
            <label class="form-label">Government ID Type <span class="text-red-500">*</span></label>
            <div class="relative">
              <select v-model="modelValue.profile.gov_id_type" required class="form-input form-select pl-4">
                <option value="">Select ID type…</option>
                <option value="Aadhaar">Aadhaar</option>
                <option value="PAN">PAN</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
              </select>
            </div>
          </div>
          <div class="form-group !mb-0">
            <label class="form-label">Government ID Number <span class="text-red-500">*</span></label>
            <div class="relative">
              <Hash :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.gov_id_number" type="text" required class="form-input pl-9" placeholder="ID number" />
            </div>
          </div>
          <div class="form-group !mb-0">
            <label class="form-label">Visit Purpose <span class="text-red-500">*</span></label>
            <div class="relative">
              <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.visit_purpose" type="text" required class="form-input pl-9" placeholder="e.g. Meeting with IT Dept" />
            </div>
          </div>
          <div class="form-group !mb-0">
            <label class="form-label">Host Contact <span class="text-red-500">*</span></label>
            <div class="relative">
              <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input v-model="modelValue.profile.host_contact" type="text" required class="form-input pl-9" placeholder="Who are you visiting?" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
