<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useLiveFaceInference } from '@/composables/useLiveFaceInference'
import { Loader2, VideoOff } from 'lucide-vue-next'

const props = defineProps<{
  mode: 'registration' | 'single_recognition'
  targetPose?: 'center' | 'left' | 'right' | 'chin_up' | 'chin_down'
  isActive?: boolean // To allow parent to pause capturing
}>()

const emit = defineEmits<{
  capture: [file: File]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const { isStreaming, error, wsError, faces, startStream, stopStream, captureHighQualityImage } = useLiveFaceInference(videoRef, props.mode)

// Camera State
const borderState = ref<'gray' | 'red' | 'green'>('gray')
const progress = ref(0)
let captureTimer: number | null = null

const REQUIRED_STABILITY_MS = 1000
const TICK_MS = 50

watch([faces, () => props.targetPose, () => props.isActive], ([newFaces, targetPose, isActive]) => {
  if (isActive === false) {
    resetCapture()
    borderState.value = 'gray'
    return
  }

  if (!newFaces || newFaces.length === 0) {
    borderState.value = 'gray'
    resetCapture()
    return
  }
  
  if (newFaces.length > 1) {
    // Only single face allowed in oval
    borderState.value = 'red'
    resetCapture()
    return
  }
  
  const face = newFaces[0]
  
  let isValid = false
  if (props.mode === 'registration') {
    isValid = face.pose === targetPose
  } else {
    // single_recognition
    isValid = face.pose === 'center' && face.is_live
  }
  
  if (isValid) {
    borderState.value = 'green'
    startCaptureSequence()
  } else {
    borderState.value = 'red'
    resetCapture()
  }
})

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
      const file = captureHighQualityImage()
      if (file) {
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
      <!-- Oval Container -->
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
        
        <!-- Offline overlay -->
        <div v-if="!isStreaming" class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white backdrop-blur-sm">
          <Loader2 v-if="!error && !wsError" class="animate-spin mb-2" :size="24" />
          <VideoOff v-if="error || wsError" class="mb-2 text-red-400" :size="32" />
          <p class="text-xs text-center px-4 font-medium">{{ error || wsError || 'Starting Camera...' }}</p>
        </div>
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
          <span v-if="borderState === 'gray'">Position Face</span>
          <span v-else-if="borderState === 'red' && mode === 'registration'">Pose: {{ targetPose }}</span>
          <span v-else-if="borderState === 'red' && mode === 'single_recognition'">Spoof / Look Center</span>
          <span v-else-if="borderState === 'green'">Hold Still...</span>
        </div>
      </div>
    </div>
  </div>
</template>
