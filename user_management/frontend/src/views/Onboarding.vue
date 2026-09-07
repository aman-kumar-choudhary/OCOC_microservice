<script setup lang="ts">
import { ref, computed } from 'vue'
import userService from '@/services/userService'
import rfidService from '@/services/rfidService'
import { registerPerson } from '@/services/frecoService'
import {
  GraduationCap, Wrench, UserRound, CreditCard,
  CheckCircle, Loader2, ArrowRight, ArrowLeft, ScanFace, Award
} from 'lucide-vue-next'
import UserProfileForm from '@/components/UserProfileForm.vue'
import FaceOvalCamera from '@/components/FaceOvalCamera.vue'

// ─── Camera state ──────────────────────────────────────────────────
// Removed manual refs since FaceOvalCamera handles them
const capturedImages = ref<string[]>([])
const captureCount = ref(0)

// ─── Face pose capture state ───────────────────────────────────────
const POSES = [
  { key: 'center',    label: 'Center',    description: 'Look straight at the camera', emoji: '👤' },
  { key: 'left',      label: 'Turn Left', description: 'Slowly turn your head left',  emoji: '⬅️' },
  { key: 'right',     label: 'Turn Right',description: 'Slowly turn your head right', emoji: '➡️' },
  { key: 'chin_up',   label: 'Chin Up',   description: 'Tilt your chin slightly up',  emoji: '⬆️' },
  { key: 'chin_down', label: 'Chin Down', description: 'Tilt your chin slightly down', emoji: '⬇️' },
]
const poseCaptures = ref<Record<string, { file: File | null; url: string | null; captured: boolean }>>(
  Object.fromEntries(POSES.map(p => [p.key, { file: null, url: null, captured: false }]))
)
const currentPoseIdx = ref(0)
const faceRegLoading = ref(false)
const faceRegError = ref('')
const faceRegSuccess = ref(false)

const capturedPosesCount = computed(() => POSES.filter(p => poseCaptures.value[p.key]?.captured).length)
const allPosesCaptured = computed(() => capturedPosesCount.value === POSES.length)
const currentPose = computed(() => POSES[currentPoseIdx.value])

function handleAutoCapture(file: File) {
  const key = currentPose.value.key
  poseCaptures.value[key].file = file
  poseCaptures.value[key].url = URL.createObjectURL(file)
  poseCaptures.value[key].captured = true
  
  if (currentPoseIdx.value < POSES.length - 1) {
    setTimeout(() => { currentPoseIdx.value++ }, 600)
  }
}

async function handleFaceRegister() {
  if (!allPosesCaptured.value) { faceRegError.value = 'Please capture all 5 poses first'; return }
  faceRegLoading.value = true
  faceRegError.value = ''
  try {
    const images = POSES.map(p => poseCaptures.value[p.key].file!)
    const poses = POSES.map(p => p.key)
    const p = userForm.value.profile
    await registerPerson({
      externalId: createdUserId.value,
      name: p.full_name || userForm.value.email,
      personType: persona.value,
      email: userForm.value.email,
      images,
      poses,
    })
    faceRegSuccess.value = true
    setTimeout(() => { step.value = 4 }, 1200)
  } catch (e: any) {
    faceRegError.value = e.response?.data?.detail || e.message || 'Face registration failed'
  } finally { faceRegLoading.value = false }
}

function skipFaceReg() {
  step.value = 4
}

// ─── Step management ───────────────────────────────────────────────
const step = ref<1 | 2 | 3 | 4 | 5>(1)

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

// ─── Form State ────────────────────────────────────────────────────
const userForm = ref({
  email: '',
  phone: '',
  password: 'Welcome@123!',
  profile: {
    full_name: '',
    photo_reference: '',
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
      photo_reference: p.photo_reference,
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
    step.value = 3  // go to face capture step
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
    step.value = 5
    successMsg.value = `${userForm.value.profile.full_name || 'User'} successfully onboarded with RFID Card ${rfidUid.value}`
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to enroll RFID'
  } finally {
    isLoading.value = false
  }
}

function skipRFID() {
  step.value = 5
  successMsg.value = `${userForm.value.profile.full_name || 'User'} successfully onboarded. RFID card can be assigned later.`
}

function resetForm() {
  step.value = 1
  persona.value = ''
  rfidUid.value = ''
  error.value = ''
  createdUserId.value = ''
  capturedImages.value = []
  captureCount.value = 0
  userForm.value = {
    email: '', phone: '', password: 'Welcome@123!',
    profile: {
      full_name: '', photo_reference: '', roll_number: '', school: '', department: '', course: '',
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
          { n: 2, label: 'Face Capture' },
          { n: 3, label: 'User Details' },
          { n: 4, label: 'RFID Card' },
          { n: 5, label: 'Complete' }
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
          <div v-if="i < 4" :class="['h-0.5 flex-1 mb-5 transition-all duration-500', step > s.n ? 'bg-emerald-400' : 'bg-[var(--border-light)]']" />
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

    <!-- ─── STEP 2: skipped (now part of step 1 flow) — placeholder ─── -->

    <!-- ─── STEP 3: Face Registration (5-pose Freco) ─── -->
    <div v-else-if="step === 3" class="animate-fade-in">
      <div class="glass-panel p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6 pb-5 border-b border-[var(--border-light)]">
          <div class="w-10 h-10 rounded-xl bg-primary/10 text-navy flex items-center justify-center">
            <ScanFace :size="22" />
          </div>
          <div>
            <h2 class="text-xl font-extrabold">Face Registration</h2>
            <p class="text-sm text-muted">Capture 5 poses for ArcFace embedding generation</p>
          </div>
        </div>

        <!-- Success flash -->
        <div v-if="faceRegSuccess" class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-center mb-5 flex items-center justify-center gap-2">
          <CheckCircle :size="20" /> Face registered successfully! Continuing…
        </div>

        <!-- Pose strip -->
        <div class="flex gap-3 justify-center flex-wrap mb-8">
          <div v-for="(pose, idx) in POSES" :key="pose.key"
            @click="currentPoseIdx = idx"
            :class="['cursor-pointer flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all w-28',
              idx === currentPoseIdx ? 'border-primary bg-primary/5 scale-105' :
              poseCaptures[pose.key]?.captured ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-[var(--border-light)] hover:border-primary/40']">
            <div :class="['w-14 h-14 rounded-xl overflow-hidden border-2 flex items-center justify-center text-2xl',
              poseCaptures[pose.key]?.captured ? 'border-emerald-500' : 'border-[var(--border-light)] bg-[var(--bg-input)]']">
              <img v-if="poseCaptures[pose.key]?.url" :src="poseCaptures[pose.key].url || undefined" class="w-full h-full object-cover" />
              <span v-else>{{ pose.emoji }}</span>
            </div>
            <span class="text-xs font-bold">{{ pose.label }}</span>
            <CheckCircle v-if="poseCaptures[pose.key]?.captured" class="text-emerald-400" :size="14" />
          </div>
        </div>

        <!-- Current pose instruction -->
        <div v-if="!allPosesCaptured" class="text-center mb-6">
          <div class="text-4xl mb-2">{{ currentPose.emoji }}</div>
          <h3 class="text-lg font-extrabold mb-1">{{ currentPose.label }}</h3>
          <p class="text-muted text-sm mb-4">{{ currentPose.description }}</p>
          
          <div class="mb-4">
            <FaceOvalCamera 
              mode="registration" 
              :targetPose="(currentPose.key as any)"
              :isActive="step === 3 && !allPosesCaptured"
              @capture="handleAutoCapture"
            />
          </div>
          
          <div class="mt-3 text-xs text-muted">{{ capturedPosesCount }} / {{ POSES.length }} poses captured</div>
        </div>

        <!-- All captured -->
        <div v-else class="text-center mb-6">
          <CheckCircle class="text-emerald-400 mx-auto mb-2" :size="40" />
          <p class="text-emerald-400 font-bold text-lg">All 5 poses captured!</p>
          <p class="text-muted text-sm">Ready to register with Freco</p>
        </div>

        <!-- Progress bar -->
        <div class="h-2 rounded-full bg-[var(--border-light)] overflow-hidden mb-6">
          <div class="h-full bg-emerald-500 rounded-full transition-all duration-500" :style="`width:${(capturedPosesCount / POSES.length) * 100}%`" />
        </div>

        <!-- Error -->
        <div v-if="faceRegError" class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold mb-4">
          {{ faceRegError }}
        </div>

        <!-- Actions -->
        <div class="flex justify-between gap-3">
          <button @click="skipFaceReg" class="btn btn-outline text-muted">
            Skip Face Registration
          </button>
          <button @click="handleFaceRegister" :disabled="faceRegLoading || !allPosesCaptured || faceRegSuccess"
            class="btn btn-primary px-8" id="register-face-btn">
            <Loader2 v-if="faceRegLoading" class="animate-spin" :size="16" />
            <ScanFace v-else :size="16" />
            Register Face
          </button>
        </div>
      </div>
    </div>


    <!-- ─── STEP 2: User Details ─── -->
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
          <UserProfileForm v-model="userForm" :persona="persona" />

          <!-- Submit -->
          <div class="mt-8 flex justify-end gap-3">
            <button type="submit" class="btn btn-primary px-8 py-3 text-base" :disabled="isLoading" id="create-user-btn">
              <Loader2 v-if="isLoading" class="animate-spin" :size="18" />
              <span v-else class="flex items-center gap-2">Continue to Face Registration <ArrowRight :size="18" /></span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ─── STEP 4: RFID Enrollment ─── -->
    <div v-else-if="step === 4" class="glass-panel p-6 sm:p-12 animate-fade-in text-center">
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

    <!-- ─── STEP 5: Success ─── -->
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
