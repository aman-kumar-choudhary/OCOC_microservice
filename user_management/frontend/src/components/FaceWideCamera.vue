<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useLiveFaceInference } from '@/composables/useLiveFaceInference'
import { Loader2, VideoOff } from 'lucide-vue-next'

const videoRef = ref<HTMLVideoElement | null>(null)
const { isStreaming, error, wsError, faces, startStream, stopStream, captureHighQualityImage } = useLiveFaceInference(videoRef, 'multi_recognition')

defineExpose({
  capture: captureHighQualityImage
})

const videoWidth = ref(0)
const videoHeight = ref(0)

// Keep track of original video size to scale boxes correctly
function onVideoPlay() {
  if (videoRef.value) {
    videoWidth.value = videoRef.value.videoWidth
    videoHeight.value = videoRef.value.videoHeight
  }
}

onMounted(() => {
  startStream()
})

onUnmounted(() => {
  stopStream()
})
</script>

<template>
  <div class="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-inner border border-slate-700">
    <video 
      ref="videoRef" 
      class="w-full h-full object-cover scale-x-[-1]" 
      playsinline 
      muted 
      autoplay
      @play="onVideoPlay"
    ></video>
    
    <!-- Offline overlay -->
    <div v-if="!isStreaming" class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white backdrop-blur-sm">
      <Loader2 v-if="!error && !wsError" class="animate-spin mb-2" :size="32" />
      <VideoOff v-if="error || wsError" class="mb-2 text-red-400" :size="48" />
      <p class="text-sm font-medium">{{ error || wsError || 'Starting Camera...' }}</p>
    </div>
    
    <!-- SVG overlay for bounding boxes -->
    <!-- Assuming coordinates from backend are in original video resolution, and video is object-cover -->
    <!-- It's actually tricky to map object-cover coordinates perfectly without ResizeObserver. Let's do a simple percentage mapping. -->
    <svg v-if="isStreaming && videoWidth > 0" class="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]" preserveAspectRatio="xMidYMid slice" :viewBox="`0 0 ${videoWidth} ${videoHeight}`">
      <g v-for="(face, idx) in faces" :key="idx">
        <rect 
          :x="face.bbox[0]" 
          :y="face.bbox[1]" 
          :width="face.bbox[2] - face.bbox[0]" 
          :height="face.bbox[3] - face.bbox[1]" 
          fill="none" 
          stroke="var(--color-emerald-500, #10b981)" 
          stroke-width="3" 
          rx="4"
        />
        <!-- We mirror the text back so it's readable -->
        <g :transform="`translate(${face.bbox[0]}, ${face.bbox[1] - 8}) scale(-1, 1)`">
          <text 
            x="0" 
            y="0" 
            fill="#10b981" 
            font-size="16" 
            font-weight="bold"
            font-family="sans-serif"
            style="text-shadow: 1px 1px 2px black;"
          >
            Live: {{ (face.liveness_score * 100).toFixed(0) }}%
          </text>
        </g>
      </g>
    </svg>
    
    <!-- Active status -->
    <div v-if="isStreaming" class="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-bold border border-white/10">
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      LIVE STREAM
    </div>
  </div>
</template>
