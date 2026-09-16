import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useLiveFaceInference } from '@/hooks/useLiveFaceInference'
import { Loader2, VideoOff } from 'lucide-react'

export const FaceWideCamera = forwardRef((_props, ref) => {
  const videoRef = useRef(null)
  const {
    isStreaming,
    error,
    wsError,
    faces,
    frameSize,
    startStream,
    stopStream,
    captureInferenceImage
  } = useLiveFaceInference(videoRef, 'multi_recognition')

  useImperativeHandle(ref, () => ({
    capture: captureInferenceImage
  }))

  useEffect(() => {
    startStream()
    return () => {
      stopStream()
    }
  }, [startStream, stopStream])

  return (
    <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-inner border border-slate-700">
      <video
        ref={videoRef}
        className="w-full h-full object-cover scale-x-[-1]"
        playsInline
        muted
        autoPlay
      ></video>

      {/* Offline overlay */}
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white backdrop-blur-sm">
          {!error && !wsError && <Loader2 className="animate-spin mb-2" size={32} />}
          {(error || wsError) && <VideoOff className="mb-2 text-red-400" size={48} />}
          <p className="text-sm font-medium">{error || wsError || 'Starting Camera...'}</p>
        </div>
      )}

      {/* SVG overlay for bounding boxes */}
      {isStreaming && frameSize.width > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
          viewBox={`0 0 ${frameSize.width} ${frameSize.height}`}
        >
          <g transform={`translate(${frameSize.width} 0) scale(-1 1)`}>
            {faces.map((face, idx) => (
              <g key={idx}>
                <rect
                  x={face.bbox[0]}
                  y={face.bbox[1]}
                  width={face.bbox[2] - face.bbox[0]}
                  height={face.bbox[3] - face.bbox[1]}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  rx="4"
                />
                <g transform={`translate(${frameSize.width - face.bbox[0]}, ${face.bbox[1] - 8}) scale(-1, 1)`}>
                  <text
                    x="0"
                    y="0"
                    fill="#10b981"
                    fontSize="16"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                    style={{ textShadow: '1px 1px 2px black' }}
                  >
                    Live: {(face.liveness_score * 100).toFixed(0)}%
                  </text>
                </g>
              </g>
            ))}
          </g>
        </svg>
      )}

      {/* Active status */}
      {isStreaming && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-bold border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          LIVE STREAM
        </div>
      )}
    </div>
  )
})

FaceWideCamera.displayName = 'FaceWideCamera'

export default FaceWideCamera
