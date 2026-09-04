<script setup lang="ts">
import { ref, computed } from 'vue'
import userService from '@/services/userService'
import rfidService from '@/services/rfidService'
import {
  GraduationCap, Briefcase, Wrench, UserRound, CreditCard,
  CheckCircle, Loader2, ArrowRight, ArrowLeft, ChevronDown,
  Building2, Phone, Mail, Hash, Home, Users, BookOpen, Award
} from 'lucide-vue-next'

// ─── Step management ───────────────────────────────────────────────
const step = ref<1 | 2 | 3 | 4>(1)

// ─── Persona Selection ─────────────────────────────────────────────
const persona = ref('')

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

// ─── DSVV Academic Hierarchy ───────────────────────────────────────
const schoolDepartments: Record<string, string[]> = {
  'School of Technology, Communication and Management': [
    'Department of Computer Sciences',
    'Department of Tourism Management',
    'Department of Journalism & Mass Communication',
    'Department of Animation and Visual Effects',
  ],
  'School of Biological Sciences and Sustainability': [
    'Department of Rural Studies and Sustainability',
  ],
  'School of Indology': [
    'Department of Sanskrit and Vedic Studies',
    'Department of Hindi',
    'Department of Indian Classical Music',
    'Department of History and Indian Culture',
  ],
  'School of Humanities, Social Sciences and Foundation Courses': [
    'Department of English',
    'Department of Education',
    'Department of Psychology',
    'Department of Life Management',
    'Department of Scientific Spirituality',
    'Department of Oriental Studies, Religious Studies & Philosophy',
    'Department of Yogic Sciences and Human Consciousness',
  ],
}

const departmentCourses: Record<string, string[]> = {
  'Department of Computer Sciences': [
    'B.Sc. Information Technology (Honors)',
    'Bachelor of Computer Application (Honors)',
    'Master of Computer Application (Data Science)',
  ],
  'Department of Tourism Management': [
    'B.B.A Tourism & Travel Management (Honors)',
    'M.B.A. Tourism & Travel Management',
  ],
  'Department of Journalism & Mass Communication': [
    'B.A. Journalism and Mass Communication (Honors)',
    'M. A. Journalism and Mass Communication',
    'M. A. Spiritual Journalism',
  ],
  'Department of Animation and Visual Effects': [
    'B.Voc. (Bachelor of Vocation) in 3D Animation and VFX (Honors)',
  ],
  'Department of Rural Studies and Sustainability': ['Bachelor of Rural Studies (Honors)'],
  'Department of English': ['B.A. English (Honors)'],
  'Department of Education': ['B.Ed. (Bachelor of Education)'],
  'Department of Psychology': [
    'B.A. Psychology (Honors)',
    'M.A. Counselling Psychology',
    'M.Sc. Counselling Psychology',
  ],
  'Department of Life Management': ['Life Management - Compulsory Program for PG and UG'],
  'Department of Scientific Spirituality': [
    'M.Sc. Herbal Medicine and Natural Product Chemistry',
    'M.Sc. Molecular Physiology and Traditional Health Sciences',
    'M.Sc. Indigenous Approaches for Child Development & Generational Dynamics',
    'M.Sc. Indian Knowledge Systems',
    'M.A. Indian Knowledge Systems',
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
  'Department of Sanskrit and Vedic Studies': ['B.A. Sanskrit (Honors)', 'M.A. Sanskrit'],
  'Department of Hindi': ['B.A. Hindi (Honors)', 'M.A. Hindi'],
  'Department of Indian Classical Music': [
    'B.A. Music (Vocal) (Honors)',
    'M.A. Music (Vocal)',
    'B.A. Music Instrumental Mridang/Tabla (Honors)',
    'M.A. Music (Tabla, Pakhaawaj)',
  ],
  'Department of History and Indian Culture': ['B.A. History (Honors)', 'M. A. History and Indian Culture'],
}

const semesters = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))

// ─── Form State ────────────────────────────────────────────────────
const userForm = ref({
  email: '',
  phone: '',
  password: 'Welcome@123!',
  profile: {
    full_name: '',
    // Student
    roll_number: '',
    school: '',
    department: '',
    course: '',
    semester: '',
    hostel: false,
    guardian_contact: '',
    // Faculty
    employee_id: '',
    designation: '',
    // Worker
    worker_role: '',
    // Visitor
    gov_id_type: '',
    gov_id_number: '',
    visit_purpose: '',
    host_contact: '',
  }
})

// Cascading dropdown state
const availableDepartments = computed(() => {
  if (!userForm.value.profile.school) return []
  return schoolDepartments[userForm.value.profile.school] || []
})

const availableCourses = computed(() => {
  if (!userForm.value.profile.department) return []
  return departmentCourses[userForm.value.profile.department] || []
})

function onSchoolChange() {
  userForm.value.profile.department = ''
  userForm.value.profile.course = ''
}

function onDeptChange() {
  userForm.value.profile.course = ''
}

// ─── RFID state ────────────────────────────────────────────────────
const rfidUid = ref('')
const isScanning = ref(false)
const createdUserId = ref('')
const isLoading = ref(false)
const error = ref('')
const successMsg = ref('')

// ─── Handlers ──────────────────────────────────────────────────────
async function handleCreateUser() {
  error.value = ''
  isLoading.value = true
  try {
    const p = userForm.value.profile
    const profilePayload: Record<string, any> = {
      full_name: p.full_name,
    }

    if (persona.value === 'student') {
      Object.assign(profilePayload, {
        roll_number: p.roll_number,
        school: p.school,
        department: p.department,
        course: p.course,
        semester: p.semester,
        hostel: p.hostel,
        guardian_contact: p.guardian_contact,
      })
    } else if (persona.value === 'faculty') {
      Object.assign(profilePayload, {
        employee_id: p.employee_id,
        department: p.department,
        designation: p.designation,
      })
    } else if (persona.value === 'worker') {
      Object.assign(profilePayload, {
        employee_id: p.employee_id,
        designation: p.worker_role,
      })
    } else if (persona.value === 'visitor') {
      Object.assign(profilePayload, {
        gov_id_type: p.gov_id_type,
        gov_id_number: p.gov_id_number,
        visit_purpose: p.visit_purpose,
        host_contact: p.host_contact,
      })
    }

    const payload = {
      user: {
        email: userForm.value.email,
        phone: userForm.value.phone,
        password: userForm.value.password,
        profile: profilePayload,
      }
    }
    const result = await userService.onboard(persona.value, payload)
    createdUserId.value = result.user.id
    step.value = 3
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to create user'
  } finally {
    isLoading.value = false
  }
}

async function scanRFID() {
  error.value = ''
  isScanning.value = true
  try {
    const result = await rfidService.scan()
    rfidUid.value = result.uid
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'RFID Scan Failed'
  } finally {
    isScanning.value = false
  }
}

async function handleEnrollRFID() {
  if (!rfidUid.value) return
  error.value = ''
  isLoading.value = true
  try {
    await userService.enrollRFID(createdUserId.value, rfidUid.value)
    await userService.issueCard(createdUserId.value)
    step.value = 4
    successMsg.value = `${userForm.value.profile.full_name || 'User'} successfully onboarded with RFID Card ${rfidUid.value}`
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to enroll RFID'
  } finally {
    isLoading.value = false
  }
}

function skipRFID() {
  step.value = 4
  successMsg.value = `${userForm.value.profile.full_name || 'User'} successfully onboarded. RFID card can be assigned later.`
}

function resetForm() {
  step.value = 1
  persona.value = ''
  rfidUid.value = ''
  error.value = ''
  createdUserId.value = ''
  userForm.value = {
    email: '', phone: '', password: 'Welcome@123!',
    profile: {
      full_name: '', roll_number: '', school: '', department: '', course: '',
      semester: '', hostel: false, guardian_contact: '', employee_id: '',
      designation: '', worker_role: '', gov_id_type: '', gov_id_number: '',
      visit_purpose: '', host_contact: '',
    }
  }
}

const selectedCard = computed(() => personaCards.find((c) => c.id === persona.value))
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold">Onboarding</h1>
      <p class="text-muted text-sm mt-1">Unified workflow for creating campus identities and issuing RFID cards.</p>
    </div>

    <!-- Progress Steps -->
    <div class="app-panel p-4 mb-8">
      <div class="flex items-center gap-0">
        <template v-for="(s, i) in [
          { n: 1, label: 'Select Type' },
          { n: 2, label: 'User Details' },
          { n: 3, label: 'RFID Card' },
          { n: 4, label: 'Complete' }
        ]" :key="s.n">
          <div class="flex flex-col items-center flex-1">
            <div
              :class="[
                'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300',
                step > s.n
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : step === s.n
                    ? 'bg-primary text-navy shadow-md ring-4 ring-primary/20'
                    : 'bg-[var(--border-light)] text-muted',
              ]"
            >
              <CheckCircle v-if="step > s.n" :size="18" />
              <span v-else>{{ s.n }}</span>
            </div>
            <span
              :class="[
                'text-xs font-semibold mt-1.5 hidden sm:block',
                step >= s.n ? 'text-[var(--text-main)]' : 'text-muted',
              ]"
            >{{ s.label }}</span>
          </div>
          <div v-if="i < 3" :class="['h-0.5 flex-1 mb-5 transition-all duration-500', step > s.n ? 'bg-emerald-400' : 'bg-[var(--border-light)]']" />
        </template>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="error" class="mb-6 p-4 rounded-xl bg-[var(--status-error-bg)] text-[var(--status-error)] flex items-center gap-3 border border-red-200">
      <div class="w-1 self-stretch rounded bg-[var(--status-error)] shrink-0" />
      {{ error }}
    </div>

    <!-- ─── STEP 1: Person Type Cards ─── -->
    <div v-if="step === 1" class="animate-fade-in">
      <div class="app-panel p-6 sm:p-8">
        <h2 class="text-xl font-extrabold mb-2">Who are you onboarding?</h2>
        <p class="text-muted text-sm mb-8">Select the person type to load the appropriate registration form.</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            v-for="card in personaCards"
            :key="card.id"
            @click="persona = card.id"
            :class="[
              'group relative flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left',
              persona === card.id
                ? `border-transparent bg-gradient-to-br ${card.gradient} text-white shadow-lg scale-[1.02]`
                : `border-[var(--border-light)] hover:border-current ${card.border} hover:${card.bg} hover:shadow-md`,
            ]"
            :id="`persona-${card.id}-btn`"
          >
            <div
              :class="[
                'grid h-12 w-12 place-items-center rounded-xl shrink-0 transition-all',
                persona === card.id ? 'bg-white/20' : card.bg,
              ]"
            >
              <component
                :is="card.icon"
                :size="24"
                :class="persona === card.id ? 'text-white' : card.iconColor"
              />
            </div>
            <div>
              <p :class="['font-extrabold text-base', persona === card.id ? 'text-white' : 'text-[var(--text-main)]']">
                {{ card.label }}
              </p>
              <p :class="['text-sm mt-0.5', persona === card.id ? 'text-white/75' : 'text-muted']">
                {{ card.subtitle }}
              </p>
            </div>
            <div
              v-if="persona === card.id"
              class="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/25 flex items-center justify-center"
            >
              <CheckCircle :size="16" class="text-white" />
            </div>
          </button>
        </div>

        <div class="mt-8 flex justify-end">
          <button
            class="btn btn-primary px-8 py-3 text-base"
            :disabled="!persona"
            @click="step = 2"
            id="proceed-to-form-btn"
          >
            Continue <ArrowRight :size="18" />
          </button>
        </div>
      </div>
    </div>

    <!-- ─── STEP 2: User Details Form ─── -->
    <div v-else-if="step === 2" class="animate-fade-in">
      <div class="app-panel p-6 sm:p-8">
        <!-- Selected persona badge -->
        <div class="flex items-center gap-3 mb-6 pb-5 border-b border-[var(--border-light)]">
          <button @click="step = 1" class="btn btn-outline py-1.5 px-3 text-xs">
            <ArrowLeft :size="14" /> Back
          </button>
          <div
            v-if="selectedCard"
            :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-white bg-gradient-to-r', selectedCard.gradient]"
          >
            <component :is="selectedCard.icon" :size="15" />
            {{ selectedCard.label }} Registration
          </div>
        </div>

        <form @submit.prevent="handleCreateUser">
          <!-- ── Common fields ── -->
          <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
            <Users :size="14" /> Personal Information
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="form-group !mb-0">
              <label class="form-label">Full Name *</label>
              <div class="relative">
                <UserRound :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input v-model="userForm.profile.full_name" type="text" required class="form-input pl-9" placeholder="e.g. Arjun Sharma" />
              </div>
            </div>
            <div class="form-group !mb-0">
              <label class="form-label">Email Address *</label>
              <div class="relative">
                <Mail :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input v-model="userForm.email" type="email" required class="form-input pl-9" placeholder="arjun@dsvv.ac.in" />
              </div>
            </div>
            <div class="form-group !mb-0 md:col-span-2">
              <label class="form-label">Phone Number</label>
              <div class="relative">
                <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input v-model="userForm.phone" type="tel" class="form-input pl-9" placeholder="+91 9876543210" />
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
                  <input v-model="userForm.profile.roll_number" type="text" required class="form-input pl-9" placeholder="CS24001" />
                </div>
              </div>
              <div class="form-group !mb-0">
                <label class="form-label">Guardian Contact</label>
                <div class="relative">
                  <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input v-model="userForm.profile.guardian_contact" type="tel" class="form-input pl-9" placeholder="+91 9876543210" />
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
                    v-model="userForm.profile.school"
                    @change="onSchoolChange"
                    required
                    class="form-input form-select pl-9 pr-9 appearance-none"
                    id="student-school-select"
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
                    v-model="userForm.profile.department"
                    @change="onDeptChange"
                    required
                    :disabled="!userForm.profile.school"
                    class="form-input form-select pl-9 pr-9 appearance-none disabled:opacity-50"
                    id="student-dept-select"
                  >
                    <option value="">{{ userForm.profile.school ? 'Select Department…' : 'Select school first' }}</option>
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
                    v-model="userForm.profile.course"
                    required
                    :disabled="!userForm.profile.department"
                    class="form-input form-select pl-9 pr-9 appearance-none disabled:opacity-50"
                    id="student-course-select"
                  >
                    <option value="">{{ userForm.profile.department ? 'Select Course…' : 'Select department first' }}</option>
                    <option v-for="course in availableCourses" :key="course" :value="course">{{ course }}</option>
                  </select>
                </div>
              </div>

              <!-- Semester -->
              <div class="form-group !mb-0">
                <label class="form-label">Semester *</label>
                <div class="relative">
                  <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
                  <select v-model="userForm.profile.semester" required class="form-input form-select pr-9 appearance-none" id="student-semester-select">
                    <option value="">Select Semester…</option>
                    <option v-for="s in semesters" :key="s.value" :value="s.value">{{ s.label }}</option>
                  </select>
                </div>
              </div>

              <!-- Hostel Toggle -->
              <div class="form-group !mb-0">
                <label class="form-label">Hostel Resident</label>
                <div class="flex gap-3 mt-1">
                  <button
                    type="button"
                    :class="['flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all', userForm.profile.hostel ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'border-[var(--border-light)] text-muted hover:border-emerald-300']"
                    @click="userForm.profile.hostel = true"
                    id="hostel-yes-btn"
                  >
                    <Home :size="15" class="inline mr-1" /> Yes, hostel resident
                  </button>
                  <button
                    type="button"
                    :class="['flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all', !userForm.profile.hostel ? 'bg-[var(--border-light)] border-[var(--border-light)] text-[var(--text-main)]' : 'border-[var(--border-light)] text-muted hover:border-gray-300']"
                    @click="userForm.profile.hostel = false"
                    id="hostel-no-btn"
                  >
                    No
                  </button>
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
                  <input v-model="userForm.profile.employee_id" type="text" required class="form-input pl-9" placeholder="FAC001" />
                </div>
              </div>
              <div class="form-group !mb-0">
                <label class="form-label">Designation *</label>
                <div class="relative">
                  <Award :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input v-model="userForm.profile.designation" type="text" required class="form-input pl-9" placeholder="e.g. Assistant Professor" />
                </div>
              </div>
              <div class="form-group !mb-0 md:col-span-2">
                <label class="form-label">Department *</label>
                <div class="relative">
                  <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input v-model="userForm.profile.department" type="text" required class="form-input pl-9" placeholder="e.g. Department of Computer Sciences" />
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
                  <input v-model="userForm.profile.employee_id" type="text" required class="form-input pl-9" placeholder="WRK001" />
                </div>
              </div>
              <div class="form-group !mb-0">
                <label class="form-label">Role / Designation *</label>
                <div class="relative">
                  <Briefcase :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input v-model="userForm.profile.worker_role" type="text" required class="form-input pl-9" placeholder="e.g. Security Staff" />
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
                <select v-model="userForm.profile.gov_id_type" required class="form-input form-select" id="visitor-gov-id-type">
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
                  <input v-model="userForm.profile.gov_id_number" type="text" required class="form-input pl-9" placeholder="ID number" />
                </div>
              </div>
              <div class="form-group !mb-0">
                <label class="form-label">Visit Purpose *</label>
                <div class="relative">
                  <Building2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input v-model="userForm.profile.visit_purpose" type="text" required class="form-input pl-9" placeholder="e.g. Meeting with IT Dept" />
                </div>
              </div>
              <div class="form-group !mb-0">
                <label class="form-label">Host Contact *</label>
                <div class="relative">
                  <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input v-model="userForm.profile.host_contact" type="text" required class="form-input pl-9" placeholder="Who are you visiting?" />
                </div>
              </div>
            </div>
          </template>

          <!-- Submit -->
          <div class="mt-8 flex justify-end gap-3">
            <button type="submit" class="btn btn-primary px-8 py-3 text-base" :disabled="isLoading" id="create-user-btn">
              <Loader2 v-if="isLoading" class="animate-spin" :size="18" />
              <span v-else class="flex items-center gap-2">Continue to RFID <ArrowRight :size="18" /></span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ─── STEP 3: RFID Enrollment ─── -->
    <div v-else-if="step === 3" class="glass-panel p-6 sm:p-12 animate-fade-in text-center">
      <div class="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
        <CreditCard :size="32" />
        <span v-if="isScanning" class="absolute inset-0 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
      </div>

      <h2 class="text-2xl font-bold mb-2">Scan RFID Card</h2>
      <p class="text-muted mb-2 max-w-md mx-auto">Place the new RFID card on the reader to associate it with <strong>{{ userForm.profile.full_name }}</strong>.</p>
      <p class="text-xs text-muted mb-8 max-w-sm mx-auto">You can also skip this step and assign an RFID card later from the User Directory.</p>

      <div class="max-w-xs mx-auto mb-8 relative">
        <input
          v-model="rfidUid"
          type="text"
          readonly
          class="form-input text-center font-mono text-lg tracking-widest"
          placeholder="WAITING FOR SCAN..."
        />
      </div>

      <div class="flex justify-center gap-4 flex-wrap">
        <button @click="scanRFID" class="btn btn-outline" :disabled="isScanning || isLoading">
          <Loader2 v-if="isScanning" class="animate-spin" :size="16" />
          <span>{{ isScanning ? 'Scanning…' : 'Trigger Scanner' }}</span>
        </button>
        <button @click="handleEnrollRFID" class="btn btn-primary" :disabled="!rfidUid || isLoading" id="issue-card-btn">
          <Loader2 v-if="isLoading" class="animate-spin" :size="16" />
          <span v-else>Issue Card</span>
        </button>
        <button @click="skipRFID" class="btn btn-outline text-muted text-sm" id="skip-rfid-btn">
          Skip for now
        </button>
      </div>
    </div>

    <!-- ─── STEP 4: Success ─── -->
    <div v-else class="glass-panel p-12 animate-fade-in text-center">
      <div class="w-24 h-24 bg-[var(--status-active-bg)] text-[var(--status-active)] rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-100">
        <CheckCircle :size="48" />
      </div>
      <h2 class="text-3xl font-bold mb-4 text-[var(--status-active)]">Onboarding Complete!</h2>
      <p class="text-lg text-muted mb-8 max-w-md mx-auto">{{ successMsg }}</p>
      <button @click="resetForm" class="btn btn-primary px-8 py-3 text-base" id="start-new-onboarding-btn">
        <UserRound :size="18" /> Start New Onboarding
      </button>
    </div>
  </div>
</template>
