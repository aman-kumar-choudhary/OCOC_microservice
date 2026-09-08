<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useLiveFaceInference } from '@/composables/useLiveFaceInference'
import { Loader2, VideoOff } from 'lucide-vue-next'

const props = defineProps<{
  mode: 'registration' | 'single_recognition'
  targetPose?: 'center' | 'left' | 'right' | 'chin_up' | 'chin_down'
  isActive?: boolean // To allow parent to pause capturing
  manualCapture?: boolean // Face Lab confirms each green pose with a button
}>()

const emit = defineEmits<{
  capture: [file: File]
  ready: [value: boolean]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const { isStreaming, error, wsError, faces, frameSize, startStream, stopStream, captureHighQualityImage } = useLiveFaceInference(videoRef, props.mode)

// Camera State
const borderState = ref<'gray' | 'red' | 'green'>('gray')
const progress = ref(0)
const faceIsInFrame = ref(false)
const isReady = ref(false)
let captureTimer: number | null = null
let hasCapturedCurrentPose = false

function setReady(value: boolean) {
  isReady.value = value
  emit('ready', value)
}

const REQUIRED_STABILITY_MS = 1000
const TICK_MS = 50

// The stream is sent at a maximum width of 640px and the camera preview is
// portrait-shaped. A face is accepted only when all four corners of its
// bounding box are inside the visible oval.

function isFaceInsideGuide(face: typeof faces.value[number]) {
  const frameWidth = frameSize.value.width
  const frameHeight = frameSize.value.height
  let [x1, y1, x2, y2] = face.bbox
  if (!frameWidth || !frameHeight || x2 <= x1 || y2 <= y1) return false

  // Accept both common detector formats: pixel coordinates and normalized
  // coordinates (0..1). This keeps the guide working across Freco versions.
  if ([x1, y1, x2, y2].every(value => value >= 0 && value <= 1)) {
    x1 *= frameWidth
    x2 *= frameWidth
    y1 *= frameHeight
    y2 *= frameHeight
  }

  const sourceAspect = frameWidth / frameHeight
  const previewAspect = 4 / 5
  const visibleWidth = Math.min(1, previewAspect / sourceAspect)
  const visibleHeight = Math.min(1, sourceAspect / previewAspect)
  const cropLeft = (1 - visibleWidth) / 2
  const cropTop = (1 - visibleHeight) / 2

  // Convert the detector box from the streamed frame into the same cropped
  // coordinate space used by the object-cover preview.
  const toPreview = (x: number, y: number) => ({
    x: (x / frameWidth - cropLeft) / visibleWidth,
    y: (y / frameHeight - cropTop) / visibleHeight,
  })
  const corners = [
    toPreview(x1, y1), toPreview(x2, y1),
    toPreview(x1, y2), toPreview(x2, y2),
  ]

  // Keep a small gap from the visible border so a clipped face cannot pass.
  // Detector boxes include a little hair/background around the face. A small
  // tolerance prevents valid faces near the oval edge from being rejected.
  const radiusX = 0.49
  const radiusY = 0.49
  return corners.every(({ x, y }) =>
    ((x - 0.5) / radiusX) ** 2 + ((y - 0.5) / radiusY) ** 2 <= 1
  )
}

function normalisePose(pose: string | undefined) {
  const value = (pose || '').toLowerCase().replace(/[\s-]+/g, '_')
  // Freco versions have used equivalent labels for a straight-on face.
  if (['front', 'straight', 'frontal', 'forward'].includes(value)) return 'center'
  return value
}

watch(() => props.targetPose, () => {
  hasCapturedCurrentPose = false
  resetCapture()
  setReady(false)
})

watch(isStreaming, (streaming) => {
  if (streaming && !faces.value.length) borderState.value = 'red'
})

watch([faces, () => props.targetPose, () => props.isActive], ([newFaces, targetPose, isActive]) => {
  if (isActive === false) {
    resetCapture()
    borderState.value = 'gray'
    faceIsInFrame.value = false
    setReady(false)
    return
  }

  if (!newFaces || newFaces.length === 0) {
    // A live camera with no detectable face is not capture-ready. Keep the
    // signal red so the user can distinguish it from the camera starting.
    borderState.value = 'red'
    faceIsInFrame.value = false
    resetCapture()
    setReady(false)
    return
  }
  
  if (newFaces.length > 1) {
    // Only single face allowed in oval
    borderState.value = 'red'
    faceIsInFrame.value = false
    resetCapture()
    setReady(false)
    return
  }
  
  const face = newFaces[0]
  faceIsInFrame.value = isFaceInsideGuide(face)
  if (!faceIsInFrame.value) {
    borderState.value = 'red'
    resetCapture()
    setReady(false)
    return
  }
  
  let isValid = false
  if (props.mode === 'registration') {
    isValid = normalisePose(face.pose) === targetPose
  } else {
    // single_recognition
    const detectedPose = normalisePose(face.pose)
    const requiredPose = targetPose || 'center'
    // The stream is only used to guide capture. Some deployments return no
    // pose/liveness fields there; /match performs the actual liveness check
    // after capture. For the straight-on pose, a detected face is sufficient.
    const poseMatches = requiredPose === 'center'
      ? !detectedPose || detectedPose === 'unknown' || detectedPose === 'center'
      : detectedPose === requiredPose
    isValid = poseMatches
  }
  
  if (isValid && !hasCapturedCurrentPose) {
    borderState.value = 'green'
    setReady(true)
    if (!props.manualCapture) startCaptureSequence()
  } else {
    borderState.value = 'red'
    resetCapture()
    setReady(false)
  }
})

function captureCurrentPose() {
  if (!props.manualCapture || !isReady.value || hasCapturedCurrentPose) return false
  const file = captureHighQualityImage({ aspectRatio: 4 / 5 })
  if (!file) return false
  hasCapturedCurrentPose = true
  setReady(false)
  emit('capture', file)
  return true
}

defineExpose({ captureIfReady: captureCurrentPose })

function startCaptureSequence() {
  if (captureTimer !== null) return // Already running
  
  progress.value = 0
  captureTimer = window.setInterval(() => {
    progress.value += (TICK_MS / REQUIRED_STABILITY_MS) * 100
    if (progress.value >= 100) {
      clearInterval(captureTimer!)
      captureTimer = null
      progress.value = 100
      
      // Auto capture
      const file = captureHighQualityImage({ aspectRatio: 4 / 5 })
      if (file) {
        hasCapturedCurrentPose = true
        emit('capture', file)
      }
    }
  }, TICK_MS)
}

function resetCapture() {
  if (captureTimer !== null) {
    clearInterval(captureTimer)
    captureTimer = null
  }
  progress.value = 0
}

onMounted(() => {
  startStream()
})

onUnmounted(() => {
  stopStream()
  resetCapture()
})
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="relative w-[min(72vw,16rem)] aspect-[4/5]">
      <!-- Fixed capture frame. The camera is visible behind it, but only a
           face fully contained by this guide can start the capture timer. -->
      <div 
        class="absolute inset-0 rounded-[50%] overflow-hidden bg-slate-900 border-4 transition-colors duration-300 shadow-xl"
        :class="{
          'border-slate-300': borderState === 'gray',
          'border-red-500 shadow-red-500/20': borderState === 'red',
          'border-emerald-500 shadow-emerald-500/40': borderState === 'green',
        }"
      >
        <video 
          ref="videoRef" 
          class="w-full h-full object-cover scale-x-[-1]" 
          playsinline 
          muted 
          autoplay
        ></video>

        <div class="absolute inset-0 rounded-[50%] border-2 border-dashed border-white/80 pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.38)]" />

        
        <!-- Offline overlay -->
        <div v-if="!isStreaming" class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white backdrop-blur-sm">
          <Loader2 v-if="!error && !wsError" class="animate-spin mb-2" :size="24" />
          <VideoOff v-if="error || wsError" class="mb-2 text-red-400" :size="32" />
          <p class="text-xs text-center px-4 font-medium">{{ error || wsError || 'Starting Camera...' }}</p>
        </div>
      </div>
      <!-- Always-visible state indicator; the dashed guide can otherwise hide
           the colored border against a bright camera image. -->
      <div
        class="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-lg"
        :class="{
          'bg-slate-700/90': borderState === 'gray',
          'bg-red-600/90': borderState === 'red',
          'bg-emerald-600/90': borderState === 'green',
        }"
      >
        <span class="h-2 w-2 rounded-full bg-current ring-1 ring-white/70" />
        {{ borderState === 'green' ? 'Ready to capture' : borderState === 'red' ? 'Adjust position' : 'Starting camera' }}
      </div>

      <!-- Progress Ring (SVG) -->
      <svg class="absolute inset-[-12px] w-[calc(100%+24px)] h-[calc(100%+24px)] pointer-events-none transform -rotate-90">
        <rect 
          x="6" y="6" width="100%" height="100%" rx="100" ry="100"
          fill="none" 
          stroke="transparent" 
          stroke-width="6" 
          stroke-dasharray="1000"
          :stroke-dashoffset="1000 - (progress / 100) * 1000"
          class="transition-all duration-75 ease-linear"
          :class="borderState === 'green' ? 'stroke-emerald-400' : 'stroke-transparent'"
          style="width: calc(100% - 12px); height: calc(100% - 12px);"
        />
      </svg>
      
      <!-- Instruction Overlay -->
      <div v-if="isStreaming" class="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <div 
          class="px-4 py-1.5 rounded-full text-xs font-bold text-white backdrop-blur-md shadow-lg transition-colors"
          :class="{
            'bg-black/60': borderState === 'gray',
            'bg-red-500/80': borderState === 'red',
            'bg-emerald-500/80': borderState === 'green'
          }"
        >
          <span v-if="borderState === 'gray'">Place face inside the frame</span>
          <span v-else-if="borderState === 'red' && !faceIsInFrame">Move fully inside the frame</span>
          <span v-else-if="borderState === 'red' && mode === 'registration'">Show your {{ targetPose }} pose</span>
          <span v-else-if="borderState === 'red' && mode === 'single_recognition'">Show complete face and {{ targetPose || 'center' }}</span>
          <span v-else-if="borderState === 'green'">Hold Still...</span>
        </div>
      </div>
    </div>
  </div>
</template>
