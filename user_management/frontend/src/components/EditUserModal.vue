<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import userService from '@/services/userService'
import rfidService from '@/services/rfidService'
import frecoService from '@/services/frecoService'
import { useLiveFaceInference } from '@/composables/useLiveFaceInference'
import FaceOvalCamera from '@/components/FaceOvalCamera.vue'
import type { User } from '@/types'
import UserProfileForm from '@/components/UserProfileForm.vue'
import {
  X, Loader2, Save, Camera, CreditCard, User as UserIcon,
  CheckCircle2, AlertCircle, Video, VideoOff,
  Scan, Shield, RotateCcw
} from 'lucide-vue-next'

// ── Props / Emits ──────────────────────────────────────────────────────────
const props = defineProps<{ user: User }>()
const emit  = defineEmits<{ close: []; saved: [] }>()

// ── Active Tab ─────────────────────────────────────────────────────────────
type Tab = 'profile' | 'face' | 'rfid'
const activeTab = ref<Tab>('profile')

// ── Keyboard close ─────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => { window.removeEventListener('keydown', onKeydown); stopStream() })

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — PROFILE
// ═══════════════════════════════════════════════════════════════════════════
const isProfileLoading = ref(false)
const profileError     = ref('')
const profileSuccess   = ref(false)

const form = ref({
  email:   props.user.email   || '',
  phone:   props.user.phone   || '',
  profile: {
    ...props.user.profile,
    full_name:    props.user.profile?.full_name    || '',
    hostel_flag:  props.user.profile?.hostel_flag  || false,
    hostel_id:    props.user.profile?.hostel_id    || undefined,
    school:       props.user.profile?.school       || '',
    department:   props.user.profile?.department   || '',
    course:       props.user.profile?.course       || '',
    semester:     props.user.profile?.semester     || '',
    designation:  props.user.profile?.designation  || '',
    employee_id:  props.user.profile?.employee_id  || '',
    roll_number:  props.user.profile?.roll_number  || '',
    guardian_contact: props.user.profile?.guardian_contact || '',
  }
})

async function saveProfile() {
  profileError.value   = ''
  isProfileLoading.value = true
  try {
    await userService.update(props.user.id, {
      phone:   form.value.phone,
      profile: form.value.profile,
    })
    profileSuccess.value = true
    setTimeout(() => { profileSuccess.value = false; emit('saved') }, 1000)
  } catch (e: any) {
    profileError.value = e.response?.data?.error?.message || 'Update failed'
  } finally {
    isProfileLoading.value = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — FACE ENROLLMENT
// ═══════════════════════════════════════════════════════════════════════════
// Camera handled by FaceOvalCamera now

// Pose capture state
interface PoseCapture { key: string; label: string; hint: string; file: File | null; preview: string | null }
const poses = ref<PoseCapture[]>([
  { key: 'center', label: 'Center',    hint: 'Look straight at the camera', file: null, preview: null },
  { key: 'left',   label: 'Left',      hint: 'Turn slightly to the left',   file: null, preview: null },
  { key: 'right',  label: 'Right',     hint: 'Turn slightly to the right',  file: null, preview: null },
])
const currentPoseIdx = ref(0)
const currentPose    = computed(() => poses.value[currentPoseIdx.value])
const capturedCount    = computed(() => poses.value.filter(p => p.file !== null).length)

const isFaceLoading  = ref(false)
const faceError      = ref('')
const faceSuccess    = ref(false)
const faceResult     = ref<{ face_embeddings_created: number } | null>(null)

// Stop camera when leaving face tab - handled via isActive prop now
watch(activeTab, (tab, prev) => {
  // If we wanted we could reset state here
})

function handleAutoCapture(file: File) {
  const pose = poses.value[currentPoseIdx.value]
  pose.file    = file
  pose.preview = URL.createObjectURL(file)
  // Advance to next uncaptured pose
  const next = poses.value.findIndex((p, i) => i > currentPoseIdx.value && !p.file)
  if (next !== -1) currentPoseIdx.value = next
}

function retakePose(idx: number) {
  const p = poses.value[idx]
  if (p.preview) URL.revokeObjectURL(p.preview)
  p.file    = null
  p.preview = null
  currentPoseIdx.value = idx
}

async function enrollFace() {
  const captured = poses.value.filter(p => p.file !== null)
  if (captured.length === 0) { faceError.value = 'Capture at least one pose'; return }
  faceError.value   = ''
  isFaceLoading.value = true
  try {
    const result = await frecoService.registerPerson({
      externalId: props.user.id,
      name:       props.user.profile?.full_name || props.user.email,
      personType: props.user.user_type,
      email:      props.user.email,
      images:     captured.map(p => p.file!),
      poses:      captured.map(p => p.key),
    })
    faceResult.value  = result
    faceSuccess.value = true
    emit('saved')
  } catch (e: any) {
    const msg = e.response?.data?.detail || e.response?.data?.error?.message || e.message || 'Face enrollment failed'
    if (e.response?.status === 409) {
      faceError.value = 'This user is already enrolled in FRECO. Re-enrolling will update their embeddings.'
    } else {
      faceError.value = msg
    }
  } finally {
    isFaceLoading.value = false
  }
}

function resetFaceCapture() {
  poses.value.forEach(p => {
    if (p.preview) URL.revokeObjectURL(p.preview)
    p.file    = null
    p.preview = null
  })
  currentPoseIdx.value = 0
  faceError.value   = ''
  faceSuccess.value = false
  faceResult.value  = null
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — RFID TAG
// ═══════════════════════════════════════════════════════════════════════════
const rfidUid       = ref('')
const replaceReason = ref('lost')
const isRfidLoading = ref(false)
const rfidError     = ref('')
const rfidSuccess   = ref('')

const hasRfid = computed(() => !!props.user.active_rfid)

async function assignRfid() {
  if (!rfidUid.value.trim()) { rfidError.value = 'Please enter or scan a UID'; return }
  rfidError.value   = ''
  isRfidLoading.value = true
  try {
    if (hasRfid.value) {
      await rfidService.replace(props.user.id, rfidUid.value.trim(), replaceReason.value)
      rfidSuccess.value = `Card replaced → new UID: ${rfidUid.value.trim()}`
    } else {
      await rfidService.assign(props.user.id, rfidUid.value.trim())
      rfidSuccess.value = `RFID tag assigned: ${rfidUid.value.trim()}`
    }
    rfidUid.value = ''
    emit('saved')
  } catch (e: any) {
    rfidError.value = e.response?.data?.error?.message || 'RFID operation failed'
  } finally {
    isRfidLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end" @click.self="emit('close')">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />

      <!-- Drawer -->
      <div class="relative z-10 w-full max-w-2xl h-full bg-[var(--bg-main)] shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">

        <!-- ── Header ──────────────────────────────────────────────────── -->
        <div class="flex items-center justify-between px-6 py-4 bg-[var(--bg-card)] border-b border-[var(--border-light)] shrink-0 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-11 h-11 rounded-full bg-navy/8 flex items-center justify-center text-base font-bold text-navy shrink-0">
              {{ (user.profile?.full_name || user.email).charAt(0).toUpperCase() }}
            </div>
            <div>
              <h2 class="text-base font-extrabold text-[var(--text-main)] leading-tight">
                {{ user.profile?.full_name || 'Unnamed User' }}
              </h2>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="badge border text-[10px] uppercase font-bold tracking-wider"
                  :class="user.user_type === 'student' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'">
                  {{ user.user_type }}
                </span>
                <span class="text-xs text-muted">{{ user.email }}</span>
              </div>
            </div>
          </div>
          <button @click="emit('close')" class="p-2 rounded-lg hover:bg-slate-100 transition-colors text-muted">
            <X :size="20" />
          </button>
        </div>

        <!-- ── Tab Bar ─────────────────────────────────────────────────── -->
        <div class="flex border-b border-[var(--border-light)] bg-[var(--bg-card)] shrink-0 px-6">
          <button
            v-for="tab in ([
              { key: 'profile', label: 'Profile',         icon: UserIcon  },
              { key: 'face',    label: 'Face Enrollment', icon: Camera    },
              { key: 'rfid',    label: 'RFID Tag',        icon: CreditCard },
            ] as const)"
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="[
              'flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors -mb-px',
              activeTab === tab.key
                ? 'border-navy text-navy'
                : 'border-transparent text-muted hover:text-[var(--text-main)]'
            ]"
          >
            <component :is="tab.icon" :size="14" />
            {{ tab.label }}
            <!-- Status chips -->
            <span v-if="tab.key === 'face' && user.has_face_auth"
              class="ml-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Enrolled" />
            <span v-else-if="tab.key === 'face'"
              class="ml-1 w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Not enrolled" />
            <span v-if="tab.key === 'rfid' && user.active_rfid"
              class="ml-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Has RFID" />
          </button>
        </div>

        <!-- ── Body ───────────────────────────────────────────────────── -->
        <div class="flex-1 overflow-y-auto">

          <!-- ══ PROFILE TAB ══════════════════════════════════════════ -->
          <div v-if="activeTab === 'profile'" class="px-6 py-5 space-y-4">
            <div v-if="profileSuccess" class="p-3 rounded-xl bg-emerald-50 text-emerald-800 font-semibold text-sm flex items-center gap-2 border border-emerald-200">
              <CheckCircle2 :size="16" /> Profile updated successfully!
            </div>
            <div v-if="profileError" class="p-3 rounded-xl bg-red-50 text-red-800 font-semibold text-sm border border-red-200 flex items-center gap-2">
              <AlertCircle :size="16" /> {{ profileError }}
            </div>
            <UserProfileForm v-model="form" :persona="user.user_type" :isEdit="true" />
          </div>

          <!-- ══ FACE ENROLLMENT TAB ══════════════════════════════════ -->
          <div v-else-if="activeTab === 'face'" class="px-6 py-5 space-y-4">

            <!-- Already enrolled banner -->
            <div v-if="user.has_face_auth && !faceSuccess"
              class="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
              <CheckCircle2 :size="18" class="shrink-0" />
              <div>
                <p>Face already enrolled in FRECO.</p>
                <p class="font-normal text-xs mt-0.5">You can capture new poses below to update / add embeddings.</p>
              </div>
            </div>

            <!-- Success state -->
            <div v-if="faceSuccess" class="flex flex-col items-center gap-3 py-10">
              <div class="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 :size="32" class="text-emerald-600" />
              </div>
              <p class="font-bold text-lg">Face enrolled!</p>
              <p class="text-sm text-muted">{{ faceResult?.face_embeddings_created }} embedding(s) created.</p>
              <button @click="resetFaceCapture" class="btn btn-outline mt-2">
                <RotateCcw :size="14" /> Enroll Again
              </button>
            </div>

            <template v-else>
              <!-- Pose progress -->
              <div class="flex items-center gap-2">
                <span
                  v-for="(pose, i) in poses" :key="pose.key"
                  :class="[
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all',
                    pose.file
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : i === currentPoseIdx
                        ? 'bg-navy text-white border-navy'
                        : 'bg-slate-50 text-muted border-slate-200'
                  ]"
                >
                  <CheckCircle2 v-if="pose.file" :size="11" />
                  {{ pose.label }}
                </span>
                <span class="ml-auto text-xs text-muted font-semibold">{{ capturedCount }}/{{ poses.length }} poses</span>
              </div>

              <!-- Camera preview via FaceOvalCamera -->
              <div class="flex flex-col items-center justify-center my-4">
                <FaceOvalCamera 
                  mode="registration"
                  :targetPose="(currentPose.key as any)"
                  :isActive="activeTab === 'face' && capturedCount < poses.length && !faceSuccess"
                  @capture="handleAutoCapture"
                />
              </div>



              <!-- Captured pose previews -->
              <div v-if="capturedCount > 0" class="grid grid-cols-3 gap-3">
                <div v-for="(pose, i) in poses" :key="pose.key"
                  class="relative rounded-xl overflow-hidden border border-[var(--border-light)] aspect-square bg-slate-100">
                  <img v-if="pose.preview" :src="pose.preview" class="w-full h-full object-cover" :alt="pose.label" />
                  <div v-else class="w-full h-full flex items-center justify-center text-muted text-xs font-semibold">
                    {{ pose.label }}
                  </div>
                  <button v-if="pose.file"
                    @click="retakePose(i)"
                    class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center text-muted hover:text-red-500 shadow-sm"
                    title="Retake"
                  >
                    <RotateCcw :size="11" />
                  </button>
                  <span class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/50 text-white">
                    {{ pose.label }}
                  </span>
                </div>
              </div>

              <div v-if="faceError" class="p-3 rounded-xl bg-red-50 text-red-800 text-sm font-semibold border border-red-200 flex items-center gap-2">
                <AlertCircle :size="15" /> {{ faceError }}
              </div>
            </template>
          </div>

          <!-- ══ RFID TAG TAB ══════════════════════════════════════════ -->
          <div v-else-if="activeTab === 'rfid'" class="px-6 py-5 space-y-4">

            <!-- Current card status -->
            <div class="rounded-xl border border-[var(--border-light)] p-4 bg-[var(--bg-card)]">
              <p class="text-xs font-extrabold uppercase tracking-widest text-muted mb-3">Current RFID Tag</p>
              <div v-if="user.active_rfid" class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CreditCard :size="20" />
                </div>
                <div>
                  <p class="font-mono font-bold text-sm">{{ user.active_rfid }}</p>
                  <p class="text-xs text-emerald-600 font-semibold">Active</p>
                </div>
              </div>
              <div v-else class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                  <CreditCard :size="20" />
                </div>
                <div>
                  <p class="font-semibold text-sm text-muted">No RFID tag assigned</p>
                  <p class="text-xs text-muted">Assign a tag below</p>
                </div>
              </div>
            </div>

            <!-- Replace reason (only if has existing RFID) -->
            <div v-if="hasRfid" class="form-group !mb-0">
              <label class="form-label">Reason for Replacement</label>
              <select v-model="replaceReason" class="form-input form-select">
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="damaged">Damaged / Malfunctioning</option>
                <option value="upgrade">Upgrade</option>
              </select>
            </div>

            <!-- UID input -->
            <div class="form-group !mb-0">
              <label class="form-label">{{ hasRfid ? 'New Tag UID' : 'Tag UID to Assign' }} <span class="text-red-500">*</span></label>
              <div class="relative">
                <Scan :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  v-model="rfidUid"
                  type="text"
                  class="form-input pl-9 font-mono"
                  placeholder="Scan RFID tag or type UID…"
                  id="rfid-uid-input"
                  @keyup.enter="assignRfid"
                />
              </div>
              <p class="text-xs text-muted mt-1">Scan the physical tag or type the UID manually, then click assign.</p>
            </div>

            <!-- Success/Error feedback -->
            <div v-if="rfidSuccess" class="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 :size="15" /> {{ rfidSuccess }}
            </div>
            <div v-if="rfidError" class="p-3 rounded-xl bg-red-50 text-red-800 text-sm font-semibold border border-red-200 flex items-center gap-2">
              <AlertCircle :size="15" /> {{ rfidError }}
            </div>

            <div v-if="hasRfid" class="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <Shield :size="14" class="mt-0.5 shrink-0" />
              The existing tag will be revoked and replaced with the new UID.
            </div>
          </div>

        </div><!-- /body -->

        <!-- ── Footer ─────────────────────────────────────────────────── -->
        <div class="px-6 py-4 bg-[var(--bg-card)] border-t border-[var(--border-light)] flex justify-end gap-3 shrink-0">
          <button @click="emit('close')" class="btn btn-outline">Cancel</button>

          <!-- Profile tab footer -->
          <button
            v-if="activeTab === 'profile'"
            @click="saveProfile"
            :disabled="isProfileLoading"
            class="btn btn-primary shadow-lg shadow-primary/20"
            id="save-edit-user-btn"
          >
            <Loader2 v-if="isProfileLoading" class="animate-spin" :size="15" />
            <Save v-else :size="15" />
            Save Changes
          </button>

          <!-- Face tab footer -->
          <template v-else-if="activeTab === 'face'">
            <button
              v-if="!faceSuccess"
              @click="enrollFace"
              :disabled="isFaceLoading || capturedCount === 0"
              class="btn btn-primary shadow-lg shadow-primary/20 disabled:opacity-40"
              id="enroll-face-btn"
            >
              <Loader2 v-if="isFaceLoading" class="animate-spin" :size="15" />
              <Camera v-else :size="15" />
              {{ isFaceLoading ? 'Enrolling…' : `Enroll Face (${capturedCount} pose${capturedCount !== 1 ? 's' : ''})` }}
            </button>
          </template>

          <!-- RFID tab footer -->
          <button
            v-else-if="activeTab === 'rfid'"
            @click="assignRfid"
            :disabled="isRfidLoading || !rfidUid.trim()"
            class="btn btn-primary shadow-lg shadow-primary/20 disabled:opacity-40"
            id="assign-rfid-btn"
          >
            <Loader2 v-if="isRfidLoading" class="animate-spin" :size="15" />
            <CreditCard v-else :size="15" />
            {{ hasRfid ? 'Replace Tag' : 'Assign Tag' }}
          </button>
        </div>

      </div><!-- /drawer -->
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.animate-slide-in-right {
  animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
