<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { recognizeFace, recognizeFaces, type RecognitionResult, type MultiRecognitionResult } from '@/services/frecoService'
import api from '@/services/api'
import { ScanFace, Users, Loader2, ShieldCheck, ShieldX } from 'lucide-vue-next'
import FaceOvalCamera from '@/components/FaceOvalCamera.vue'
import FaceWideCamera from '@/components/FaceWideCamera.vue'

const activeTab = ref<'single' | 'mass'>('single')
const wideCamera = ref<{ capture: () => File | null } | null>(null)
const singleResult = ref<RecognitionResult | null>(null)
const multiResult = ref<MultiRecognitionResult | null>(null)
const singleError = ref('')
const multiError = ref('')
const singleBusy = ref(false)
const multiBusy = ref(false)
let multiTimer: number | undefined

function logRecognition(result: RecognitionResult, authType: 'single' | 'mass') {
  const livenessFailed = result.message === 'Liveness check failed'
  return api.post('/face-auth/log', {
    person_external_id: result.userId || '', person_name: result.name || '',
    result: result.recognized ? 'success' : livenessFailed ? 'liveness_failed' : 'unknown',
    similarity_score: result.similarity, liveness_score: (result as any).liveness_score,
    reason: result.message || '', auth_type: authType,
  }).catch(() => undefined) // Recognition results remain useful if monitoring is unavailable.
}

// The camera stays open. Frames are sampled only after the oval guide has
// accepted a face and multi-face ArcFace work is throttled to one every 1.5s.
async function onSingleCapture(file: File) {
  if (singleBusy.value || activeTab.value !== 'single') return
  singleBusy.value = true; singleError.value = ''
  try { singleResult.value = await recognizeFace(file); await logRecognition(singleResult.value, 'single') }
  catch (e: any) { singleError.value = e.response?.data?.detail || 'Recognition unavailable' }
  finally { singleBusy.value = false }
}
async function recognizeMultiFrame() {
  if (multiBusy.value || activeTab.value !== 'mass') return
  const frame = wideCamera.value?.capture()
  if (!frame) return
  multiBusy.value = true; multiError.value = ''
  try {
    multiResult.value = await recognizeFaces(frame)
    await Promise.all(multiResult.value.faces.map((face) => logRecognition(face, 'mass')))
  }
  catch (e: any) { multiError.value = e.response?.data?.detail || 'Recognition unavailable' }
  finally { multiBusy.value = false }
}
function updateTimer() {
  window.clearInterval(multiTimer)
  if (activeTab.value === 'mass') multiTimer = window.setInterval(recognizeMultiFrame, 1500)
}
watch(activeTab, updateTimer, { immediate: true })
onBeforeUnmount(() => window.clearInterval(multiTimer))
const singleState = computed(() => !singleResult.value ? 'Waiting for one live face' : singleResult.value.recognized ? 'Recognized' : 'Unknown')
</script>

<template>
  <div class="space-y-6">
    <div><h1 class="text-2xl font-bold">Face Recognition Lab</h1><p class="text-muted text-sm mt-1">Continuous camera recognition using stored ArcFace embeddings.</p></div>
    <div class="flex gap-2 p-1 bg-[var(--bg-input)] rounded-xl w-fit">
      <button @click="activeTab='single'" :class="['px-5 py-2 rounded-lg font-semibold text-sm', activeTab==='single' ? 'bg-navy text-primary' : 'text-muted']"><ScanFace :size="16" class="inline" /> Single Face</button>
      <button @click="activeTab='mass'" :class="['px-5 py-2 rounded-lg font-semibold text-sm', activeTab==='mass' ? 'bg-navy text-primary' : 'text-muted']"><Users :size="16" class="inline" /> Multi Face</button>
    </div>
    <div v-if="activeTab==='single'" class="grid md:grid-cols-2 gap-6">
      <div class="glass-panel p-5"><FaceOvalCamera mode="single_recognition" targetPose="center" :isActive="true" @capture="onSingleCapture" /><p class="text-center text-sm text-muted mt-3">Keep exactly one face in the green guide. Recognition runs automatically.</p></div>
      <div class="glass-panel p-5 flex flex-col justify-center text-center"><Loader2 v-if="singleBusy" class="animate-spin mx-auto mb-3" /><ShieldCheck v-else-if="singleResult?.recognized" class="text-emerald-500 mx-auto mb-3" :size="54" /><ShieldX v-else-if="singleResult" class="text-red-500 mx-auto mb-3" :size="54" /><p class="font-bold text-xl">{{ singleState }}</p><template v-if="singleResult?.recognized"><p class="mt-3 text-lg">{{ singleResult.name }}</p><p class="text-muted">{{ singleResult.role }} · {{ Math.round((singleResult.similarity || 0)*100) }}%</p></template><p v-if="singleError" class="text-red-500 text-sm mt-3">{{ singleError }}</p></div>
    </div>
    <div v-else class="grid md:grid-cols-2 gap-6">
      <div class="glass-panel p-5"><FaceWideCamera ref="wideCamera" /><p class="text-center text-sm text-muted mt-3">Live frames are sampled automatically; each detected face is searched independently.</p></div>
      <div class="glass-panel p-5"><div class="flex gap-2 items-center"><Loader2 v-if="multiBusy" class="animate-spin" /><h2 class="font-bold">Live results</h2></div><p v-if="!multiResult" class="text-muted text-sm mt-5">Waiting for faces…</p><div v-for="face in multiResult?.faces" :key="face.faceIndex" class="mt-3 rounded-lg border p-3" :class="face.recognized ? 'border-emerald-500 text-emerald-600' : 'border-red-400 text-red-500'"><b>Face #{{ face.faceIndex + 1 }}: {{ face.recognized ? face.name : 'Unknown' }}</b><span v-if="face.recognized"> · {{ Math.round((face.similarity || 0)*100) }}%</span><p class="text-xs">{{ face.role || face.message }} · live {{ Math.round((face.liveness_score || 0)*100) }}%</p></div><p v-if="multiError" class="text-red-500 text-sm mt-3">{{ multiError }}</p></div>
    </div>
  </div>
</template>
