import { ref, computed, watch, onUnmounted } from 'vue'

export interface FaceInferenceResult {
  bbox: [number, number, number, number]
  detection_score: number
  pose: 'center' | 'left' | 'right' | 'chin_up' | 'chin_down' | 'unknown'
  is_live: boolean
  liveness_score: number
}

export interface StreamPayload {
  mode: 'registration' | 'single_recognition' | 'multi_recognition'
  frame: string
}

export function useLiveFaceInference(
  videoElementRef: { value: HTMLVideoElement | null },
  mode: 'registration' | 'single_recognition' | 'multi_recognition' = 'single_recognition'
) {
  const isStreaming = ref(false)
  const error = ref<string | null>(null)
  const wsError = ref<string | null>(null)
  const faces = ref<FaceInferenceResult[]>([])
  
  let stream: MediaStream | null = null
  let ws: WebSocket | null = null
  let loopId: number | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  
  const FPS = 10
  const intervalMs = 1000 / FPS
  
  function getWsUrl() {
    const frecoUrl = import.meta.env.VITE_FRECO_URL || 'http://localhost:8000'
    const wsBase = frecoUrl.replace(/^http/, 'ws')
    return `${wsBase}/api/v1/face/stream`
  }

  function startWebSocket() {
    if (ws) return
    wsError.value = null
    
    ws = new WebSocket(getWsUrl())
    ws.onopen = () => {
      console.log('WebSocket connected for face inference')
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.error) {
          wsError.value = data.error
        } else if (data.status === 'face_detected' || data.status === 'faces_detected') {
          faces.value = data.faces || []
        } else if (data.status === 'no_face_detected') {
          faces.value = []
        }
      } catch (err) {
        console.error('Error parsing WS message', err)
      }
    }
    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
      wsError.value = 'Failed to connect to face stream backend.'
    }
    ws.onclose = () => {
      ws = null
    }
  }

  function stopWebSocket() {
    if (ws) {
      ws.close()
      ws = null
    }
  }

  function captureAndSendFrame() {
    if (!videoElementRef.value || !isStreaming.value || !ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    
    const video = videoElementRef.value
    if (video.videoWidth === 0 || video.videoHeight === 0) return

    if (!canvas) {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')
    }
    
    // Resize for efficiency (e.g., max width 640)
    const MAX_WIDTH = 640
    let width = video.videoWidth
    let height = video.videoHeight
    if (width > MAX_WIDTH) {
      height = Math.floor(height * (MAX_WIDTH / width))
      width = MAX_WIDTH
    }
    
    canvas.width = width
    canvas.height = height
    
    ctx?.drawImage(video, 0, 0, width, height)
    
    // Compress to JPEG for bandwidth saving
    const base64Frame = canvas.toDataURL('image/jpeg', 0.6)
    
    const payload: StreamPayload = {
      mode,
      frame: base64Frame
    }
    
    ws.send(JSON.stringify(payload))
  }

  function loop() {
    if (!isStreaming.value) return
    captureAndSendFrame()
    setTimeout(() => {
      if (isStreaming.value) {
        loopId = requestAnimationFrame(loop)
      }
    }, intervalMs)
  }

  async function startStream() {
    error.value = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      if (videoElementRef.value) {
        videoElementRef.value.srcObject = stream
        isStreaming.value = true
        startWebSocket()
        loopId = requestAnimationFrame(loop)
      }
    } catch (e: any) {
      error.value = 'Could not access camera. Please allow camera permissions.'
      console.error(e)
    }
  }

  function stopStream() {
    isStreaming.value = false
    faces.value = []
    if (loopId) cancelAnimationFrame(loopId)
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
    }
    if (videoElementRef.value) {
      videoElementRef.value.srcObject = null
    }
    stopWebSocket()
  }
  
  function captureHighQualityImage(): File | null {
    if (!videoElementRef.value || !isStreaming.value) return null
    const video = videoElementRef.value
    const hdCanvas = document.createElement('canvas')
    hdCanvas.width = video.videoWidth
    hdCanvas.height = video.videoHeight
    const hdCtx = hdCanvas.getContext('2d')
    hdCtx?.drawImage(video, 0, 0)
    
    const dataUrl = hdCanvas.toDataURL('image/jpeg', 0.9)
    const byteString = atob(dataUrl.split(',')[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: 'image/jpeg' })
    return new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }

  onUnmounted(() => {
    stopStream()
  })

  return {
    isStreaming,
    error,
    wsError,
    faces,
    startStream,
    stopStream,
    captureHighQualityImage
  }
}
