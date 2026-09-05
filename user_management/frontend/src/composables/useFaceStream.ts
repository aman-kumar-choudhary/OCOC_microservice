import { ref, onMounted, onUnmounted } from 'vue'

export function useFaceStream(videoElementRef: { value: HTMLVideoElement | null }) {
  const isStreaming = ref(false)
  const error = ref('')
  let stream: MediaStream | null = null

  const startStream = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      })
      if (videoElementRef.value) {
        videoElementRef.value.srcObject = stream
        videoElementRef.value.play()
        isStreaming.value = true
      }
    } catch (err: any) {
      error.value = 'Failed to access camera: ' + err.message
      isStreaming.value = false
    }
  }

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
    if (videoElementRef.value) {
      videoElementRef.value.srcObject = null
    }
    isStreaming.value = false
  }

  const captureImage = (canvasRef: HTMLCanvasElement | null): File | null => {
    if (!videoElementRef.value || !canvasRef || !isStreaming.value) return null
    const context = canvasRef.getContext('2d')
    if (!context) return null
    
    // Draw current frame to canvas
    canvasRef.width = videoElementRef.value.videoWidth
    canvasRef.height = videoElementRef.value.videoHeight
    context.drawImage(videoElementRef.value, 0, 0, canvasRef.width, canvasRef.height)
    
    // Convert to file
    const dataUrl = canvasRef.toDataURL('image/jpeg', 0.9)
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], 'capture.jpg', { type: mime || 'image/jpeg' })
  }

  onUnmounted(() => {
    stopStream()
  })

  return {
    isStreaming,
    error,
    startStream,
    stopStream,
    captureImage
  }
}
