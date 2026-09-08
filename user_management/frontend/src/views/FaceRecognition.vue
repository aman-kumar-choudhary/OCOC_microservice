<script setup lang="ts">
import { ref, computed } from 'vue'
import { matchFace, massMatch } from '@/services/frecoService'
import api from '@/services/api'
import { formatDateTime } from '@/utils/date'
import type { MatchResult, MassMatchResult, FaceBboxResult } from '@/services/frecoService'
import {
  Camera, Loader2, ShieldCheck, ShieldX,
  ScanFace, Users, RefreshCw, Info, Zap
} from 'lucide-vue-next'
import FaceOvalCamera from '@/components/FaceOvalCamera.vue'
import FaceWideCamera from '@/components/FaceWideCamera.vue'

// ─── shared ───────────────────────────────────────────────
const activeTab = ref<'single' | 'mass'>('single')

// ─── SINGLE FACE VERIFY ───────────────────────────────────
const singleImg = ref<File | null>(null)
const singleImgUrl = ref<string | null>(null)
const singlePersonId = ref('')
const singleEmbeddings = ref<object | null>(null)
const singleResult = ref<MatchResult | null>(null)
const singleLoading = ref(false)
const singleError = ref('')

const FACE_POSES = [
  { key: 'center', label: 'Center', hint: 'Look straight at the camera', emoji: '●' },
  { key: 'left', label: 'Turn Left', hint: 'Turn your head slightly left', emoji: '←' },
  { key: 'right', label: 'Turn Right', hint: 'Turn your head slightly right', emoji: '→' },
  { key: 'chin_up', label: 'Chin Up', hint: 'Tilt your chin slightly up', emoji: '↑' },
  { key: 'chin_down', label: 'Chin Down', hint: 'Tilt your chin slightly down', emoji: '↓' },
] as const
type FacePoseKey = typeof FACE_POSES[number]['key']
const currentPoseIndex = ref(0)
const poseCaptures = ref<Record<FacePoseKey, { file: File | null; url: string | null }>>(
  Object.fromEntries(FACE_POSES.map(pose => [pose.key, { file: null, url: null }])) as Record<FacePoseKey, { file: File | null; url: string | null }>
)
const currentPose = computed(() => FACE_POSES[currentPoseIndex.value])
const capturedPoseCount = computed(() => FACE_POSES.filter(pose => poseCaptures.value[pose.key].file).length)
const allPosesCaptured = computed(() => capturedPoseCount.value === FACE_POSES.length)
const poseReady = ref(false)
const cameraRef = ref<{ captureIfReady: () => boolean } | null>(null)
const captureMessage = ref('')

const singleIsActive = computed(() => activeTab.value === 'single' && !singleImgUrl.value)
const wideCameraRef = ref<any>(null)

function capturePose(file: File) {
  captureMessage.value = ''
  poseReady.value = false
  const pose = currentPose.value
  const previousUrl = poseCaptures.value[pose.key].url
  if (previousUrl) URL.revokeObjectURL(previousUrl)
  poseCaptures.value[pose.key] = { file, url: URL.createObjectURL(file) }

  if (!allPosesCaptured.value) {
    currentPoseIndex.value += 1
    return
  }

  // The existing verification endpoint accepts one image. Use the validated
  // center image after all five guided captures have been completed.
  const centerCapture = poseCaptures.value.center.file
  if (!centerCapture) return
  singleImg.value = centerCapture
  singleImgUrl.value = poseCaptures.value.center.url
  singleResult.value = null
  singleError.value = ''

  runSingleMatch()
}

function confirmPoseCapture() {
  if (!poseReady.value) {
    captureMessage.value = 'The frame is not green yet. Position the face correctly, then try again.'
    return
  }
  if (!cameraRef.value?.captureIfReady()) {
    captureMessage.value = 'Please retake this image when the frame turns green.'
  }
}

function clearCapture() {
  Object.values(poseCaptures.value).forEach(pose => {
    if (pose.url) URL.revokeObjectURL(pose.url)
  })
  poseCaptures.value = Object.fromEntries(FACE_POSES.map(pose => [pose.key, { file: null, url: null }])) as Record<FacePoseKey, { file: File | null; url: string | null }>
  currentPoseIndex.value = 0
  singleImg.value = null
  singleImgUrl.value = null
  singleResult.value = null
  singleError.value = ''
  poseReady.value = false
  captureMessage.value = ''
}

async function loadCandidateEmbeddings() {
  if (!singlePersonId.value) return
  try {
    const { data } = await api.get(`/onboarding/${singlePersonId.value}/embeddings`).catch(() => ({ data: null }))
    if (data?.data?.embeddings) singleEmbeddings.value = data.data.embeddings
  } catch {}
}

async function runSingleMatch() {
  if (!singleImg.value) { singleError.value = 'Upload an image first'; return }
  if (!singleEmbeddings.value) { singleError.value = 'Load candidate embeddings first'; return }
  singleLoading.value = true
  singleError.value = ''
  singleResult.value = null
  try {
    singleResult.value = await matchFace(singleImg.value, singleEmbeddings.value)
    // Log the auth event
    await api.post('/face-auth/log', {
      person_external_id: singlePersonId.value,
      result: singleResult.value.matched ? 'success' : singleResult.value.reason === 'spoof_detected' ? 'liveness_failed' : 'failed',
      similarity_score: singleResult.value.similarity_score,
      liveness_score: singleResult.value.liveness_score,
      reason: singleResult.value.reason,
      auth_type: 'single',
    }).catch(() => {})
  } catch (e: any) {
    singleError.value = e.response?.data?.detail || e.message || 'Match failed'
  } finally { singleLoading.value = false }
}

const simPct = computed(() => singleResult.value ? Math.round(singleResult.value.similarity_score * 100) : 0)
const livPct = computed(() => singleResult.value?.liveness_score != null ? Math.round((singleResult.value.liveness_score ?? 0) * 100) : null)

// ─── MASS / GROUP RECOGNITION ─────────────────────────────
const massImg = ref<File | null>(null)
const massImgUrl = ref<string | null>(null)
const massEmbedJson = ref('')
const massResult = ref<MassMatchResult | null>(null)
const massLoading = ref(false)
const massError = ref('')
const massCanvasRef = ref<HTMLCanvasElement | null>(null)
const massImageRef = ref<HTMLImageElement | null>(null)


function captureMassFrame() {
  if (!wideCameraRef.value) return
  const file = wideCameraRef.value.capture()
  if (!file) return
  massImg.value = file
  massImgUrl.value = URL.createObjectURL(file)
  massResult.value = null
  massError.value = ''
}

function clearMassCapture() {
  massImg.value = null
  massImgUrl.value = null
  massResult.value = null
  massError.value = ''
}

async function runMassMatch() {
  if (!massImg.value) { massError.value = 'Upload a group photo first'; return }
  let embeddings: object
  try {
    embeddings = massEmbedJson.value ? JSON.parse(massEmbedJson.value) : {}
  } catch { massError.value = 'Invalid JSON for embeddings'; return }

  massLoading.value = true
  massError.value = ''
  massResult.value = null
  try {
    massResult.value = await massMatch(massImg.value, embeddings)
    // draw bbox overlay
    setTimeout(() => drawBboxes(), 100)
    // log mass events
    for (const face of massResult.value.faces) {
      await api.post('/face-auth/log', {
        person_external_id: face.best_match_index?.toString() || '',
        result: face.matched ? 'success' : face.reason === 'spoof_detected' ? 'liveness_failed' : 'failed',
        similarity_score: face.similarity_score,
        liveness_score: face.liveness_score,
        reason: face.reason,
        auth_type: 'mass',
      }).catch(() => {})
    }
  } catch (e: any) {
    massError.value = e.response?.data?.detail || e.message || 'Mass match failed'
  } finally { massLoading.value = false }
}

function drawBboxes() {
  const canvas = massCanvasRef.value
  const img = massImageRef.value
  if (!canvas || !img || !massResult.value) return
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  for (const face of massResult.value.faces) {
    const [x1, y1, x2, y2] = face.bbox
    const color = face.matched ? '#10b981' : '#ef4444'
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    ctx.fillStyle = color + 'cc'
    ctx.fillRect(x1, y1 - 22, x2 - x1, 22)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 13px monospace'
    ctx.fillText(face.matched ? `✓ ${Math.round(face.similarity_score * 100)}%` : '✗ Unknown', x1 + 4, y1 - 6)
  }
}

function faceStatus(f: FaceBboxResult) {
  if (f.matched) return { cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: '✓ Matched' }
  return { cls: 'text-red-400 bg-red-500/10 border-red-500/20', label: '✗ Unknown' }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">Face Recognition Lab</h1>
      <p class="text-muted text-sm mt-1">Test single face verification and mass group recognition</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 p-1 bg-[var(--bg-input)] rounded-xl w-fit">
      <button @click="activeTab = 'single'" :id="'tab-single'"
        :class="['flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all', activeTab === 'single' ? 'bg-navy text-primary shadow-sm' : 'text-muted hover:text-[var(--text-main)]']">
        <ScanFace :size="16" /> Single Verify
      </button>
      <button @click="activeTab = 'mass'" :id="'tab-mass'"
        :class="['flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all', activeTab === 'mass' ? 'bg-navy text-primary shadow-sm' : 'text-muted hover:text-[var(--text-main)]']">
        <Users :size="16" /> Mass Recognition
      </button>
    </div>

    <!-- ── SINGLE VERIFY ── -->
    <div v-if="activeTab === 'single'" class="grid md:grid-cols-2 gap-6">
      <!-- Left: Input -->
      <div class="glass-panel p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-bold flex items-center gap-2"><ScanFace :size="18" /> Capture Face Images</h2>
          <span class="text-xs font-bold text-muted">{{ capturedPoseCount }}/{{ FACE_POSES.length }}</span>
        </div>

        <div v-if="!singleImgUrl" class="grid grid-cols-5 gap-1.5">
          <div v-for="(pose, index) in FACE_POSES" :key="pose.key"
            :class="['rounded-lg border p-1.5 text-center transition-colors',
              poseCaptures[pose.key].file ? 'border-emerald-500 bg-emerald-500/10' :
              index === currentPoseIndex ? 'border-primary bg-primary/10' : 'border-[var(--border-light)]']">
            <div class="text-sm font-extrabold">{{ poseCaptures[pose.key].file ? '✓' : pose.emoji }}</div>
            <div class="text-[10px] font-semibold leading-tight">{{ pose.label }}</div>
          </div>
        </div>

        <!-- Live Camera Stream or Captured Image -->
        <div class="relative rounded-xl border border-[var(--border-light)] overflow-hidden bg-[var(--bg-main)]">
          <template v-if="!singleImgUrl">
            <div class="py-4">
              <FaceOvalCamera 
                ref="cameraRef"
                mode="single_recognition" 
                :targetPose="currentPose.key"
                manualCapture
                :isActive="singleIsActive" 
                @capture="capturePose"
                @ready="poseReady = $event"
              />
              <div class="mt-3 text-center">
                <p class="font-bold text-sm">{{ currentPose.label }}</p>
                <p class="text-xs text-muted">{{ currentPose.hint }} · Hold still when the frame turns green</p>
              </div>
              <button
                @click="confirmPoseCapture"
                :disabled="!poseReady"
                class="btn btn-primary w-full max-w-xs mx-auto mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                id="capture-pose-btn"
              >
                {{ poseReady ? `Capture ${currentPose.label} & Continue` : 'Position face inside frame' }}
              </button>
              <p v-if="captureMessage" class="mt-2 text-xs font-semibold text-red-500">{{ captureMessage }}</p>
              <p v-else-if="!poseReady" class="mt-2 text-xs font-semibold text-red-500">Red frame: retake or reposition your face inside the frame.</p>
            </div>
          </template>
          <template v-else>
            <img :src="singleImgUrl" class="w-full h-full object-contain" />
            <button @click="clearCapture" class="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70">
              <RefreshCw :size="16" />
            </button>
          </template>
        </div>

        <div v-if="allPosesCaptured" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold text-center">
          ✓ All five poses captured. The center image will be used for verification.
        </div>

        <!-- Person ID for embeddings -->
        <div class="space-y-2">
          <label class="form-label">Person ID (User UUID)</label>
          <div class="flex gap-2">
            <input v-model="singlePersonId" class="form-input flex-1 font-mono text-sm" placeholder="e.g. uuid-of-registered-user" id="person-id-input" />
            <button @click="loadCandidateEmbeddings" class="btn btn-outline px-3" title="Load embeddings">
              <RefreshCw :size="15" />
            </button>
          </div>
          <div v-if="singleEmbeddings" class="text-xs text-emerald-400 font-semibold">✓ Embeddings loaded</div>
          <div class="text-xs text-muted flex items-start gap-1">
            <Info :size="12" class="mt-0.5 shrink-0" />
            Enter the user's ID and load their stored ArcFace embeddings, then run verification.
          </div>
        </div>

        <div v-if="singleError" class="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-semibold border border-red-500/20">
          {{ singleError }}
        </div>

        <button @click="runSingleMatch" :disabled="singleLoading || !singleImg" class="btn btn-primary w-full" id="run-single-match-btn">
          <Loader2 v-if="singleLoading" class="animate-spin" :size="16" />
          <Zap v-else :size="16" />
          Run Verification
        </button>
      </div>

      <!-- Right: Result -->
      <div class="glass-panel p-5 flex flex-col">
        <h2 class="font-bold flex items-center gap-2 mb-5"><ShieldCheck :size="18" /> Result</h2>

        <div v-if="!singleResult" class="flex-1 flex items-center justify-center text-center text-muted">
          <div>
            <ShieldCheck :size="48" class="mx-auto mb-3 opacity-20" />
            <p class="text-sm">Run a verification to see results</p>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col gap-5">
          <!-- Big status -->
          <div :class="['rounded-2xl p-6 text-center border', singleResult.matched ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-red-500/10 border-red-500/25']">
            <component :is="singleResult.matched ? ShieldCheck : ShieldX" :size="52" :class="singleResult.matched ? 'text-emerald-400 mx-auto mb-2' : 'text-red-400 mx-auto mb-2'" />
            <div :class="['text-2xl font-extrabold', singleResult.matched ? 'text-emerald-400' : 'text-red-400']">
              {{ singleResult.matched ? 'AUTHENTICATED' : 'REJECTED' }}
            </div>
            <div class="text-sm text-muted mt-1">{{ singleResult.message }}</div>
          </div>

          <!-- Confidence -->
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="font-semibold text-muted">Similarity Score</span>
                <span class="font-extrabold" :class="simPct >= 55 ? 'text-emerald-400' : 'text-red-400'">{{ simPct }}%</span>
              </div>
              <div class="h-3 rounded-full bg-[var(--border-light)] overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" :class="simPct >= 55 ? 'bg-emerald-500' : 'bg-red-500'" :style="`width:${simPct}%`" />
              </div>
            </div>
            <div v-if="livPct !== null">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-semibold text-muted">Liveness Score</span>
                <span class="font-extrabold" :class="(livPct ?? 0) >= 85 ? 'text-emerald-400' : 'text-orange-400'">{{ livPct }}%</span>
              </div>
              <div class="h-3 rounded-full bg-[var(--border-light)] overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" :class="(livPct ?? 0) >= 85 ? 'bg-emerald-500' : 'bg-orange-500'" :style="`width:${livPct}%`" />
              </div>
            </div>
          </div>

          <!-- Meta -->
          <div class="p-3 rounded-xl bg-[var(--bg-main)] space-y-1.5 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Reason</span>
              <span class="font-mono font-semibold">{{ singleResult.reason || '—' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Latency</span>
              <span class="font-mono">{{ singleResult.latency_ms?.toFixed(0) }} ms</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Candidates</span>
              <span>{{ singleResult.candidate_count }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Timestamp</span>
              <span class="font-mono">{{ formatDateTime(new Date().toISOString()) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── MASS RECOGNITION ── -->
    <div v-if="activeTab === 'mass'" class="space-y-5">
      <div class="grid md:grid-cols-3 gap-5">
        <!-- Upload or Live Camera Stream -->
        <div class="glass-panel p-5 space-y-4">
          <h2 class="font-bold flex items-center gap-2"><Users :size="18" /> Group Photo</h2>
          
          <div class="relative w-full rounded-xl border border-[var(--border-light)] overflow-hidden bg-[var(--bg-main)]">
            <template v-if="!massImgUrl">
              <FaceWideCamera ref="wideCameraRef" v-if="activeTab === 'mass'" />
              
              <button @click="captureMassFrame" class="absolute bottom-4 left-1/2 -translate-x-1/2 btn btn-primary px-6 shadow-xl border border-white/10" id="capture-mass-frame-btn">
                <Camera :size="16" /> Capture
              </button>
            </template>
            <template v-else>
              <img :src="massImgUrl" ref="massImageRef" class="hidden" />
              <canvas ref="massCanvasRef" class="w-full h-auto object-contain"></canvas>
              <button @click="clearMassCapture" class="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 z-10" id="clear-mass-capture-btn">
                <RefreshCw :size="16" />
              </button>
            </template>
          </div>
        </div>

        <!-- Embeddings JSON -->
        <div class="glass-panel p-5 space-y-3">
          <h2 class="font-bold">Candidate Embeddings</h2>
          <div class="text-xs text-muted flex items-start gap-1.5">
            <Info :size="12" class="shrink-0 mt-0.5" />
            Paste a JSON object with "color" and/or "grayscale" 512-dim vectors from registered users.
          </div>
          <textarea v-model="massEmbedJson" rows="8" class="form-input font-mono text-xs resize-none w-full" placeholder='{"color": [[0.1, 0.2, ...512 floats]], "grayscale": [...]}' id="mass-embed-json" />
          <div v-if="massError" class="p-3 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20">{{ massError }}</div>
          <button @click="runMassMatch" :disabled="massLoading || !massImg" class="btn btn-primary w-full" id="run-mass-match-btn">
            <Loader2 v-if="massLoading" class="animate-spin" :size="16" />
            <Zap v-else :size="16" />
            Recognize All Faces
          </button>
        </div>

        <!-- Results -->
        <div class="glass-panel p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="font-bold">Detection Results</h2>
            <span v-if="massResult" class="badge badge-active">{{ massResult.faces_detected }} faces</span>
          </div>
          <div v-if="!massResult" class="text-center py-12 text-muted">
            <Users :size="36" class="mx-auto mb-3 opacity-20" />
            <p class="text-sm">Results will appear here</p>
          </div>
          <div v-else class="space-y-2 max-h-80 overflow-y-auto pr-1">
            <div v-for="(face, i) in massResult.faces" :key="i"
              :class="['p-3 rounded-xl border text-sm', faceStatus(face).cls]">
              <div class="flex justify-between items-center">
                <span class="font-extrabold">{{ faceStatus(face).label }}</span>
                <span class="font-mono text-xs">{{ Math.round(face.similarity_score * 100) }}%</span>
              </div>
              <div class="text-xs opacity-70 mt-0.5">{{ face.reason }}</div>
            </div>
            <div class="p-2 rounded-lg bg-[var(--bg-main)] text-xs text-muted">
              Latency: {{ massResult.latency_ms?.toFixed(0) }}ms · {{ massResult.faces_detected }} detected · {{ massResult.candidate_count }} candidates
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
