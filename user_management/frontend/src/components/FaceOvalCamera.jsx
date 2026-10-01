import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { useLiveFaceInference } from "@/hooks/useLiveFaceInference";
import { Loader2, VideoOff } from "lucide-react";

const REQUIRED_STABILITY_MS = 1000;
const TICK_MS = 50;
export const FaceOvalCamera = forwardRef(
  (
    {
      mode,
      targetPose = "center",
      isActive = true,
      manualCapture = false,
      onCapture,
      onReady,
    },
    ref,
  ) => {
    const videoRef = useRef(null);
    const {
      isStreaming,
      error,
      wsError,
      faces,
      frameSize,
      startStream,
      stopStream,
      captureHighQualityImage,
    } = useLiveFaceInference(videoRef, mode);

    const [borderState, setBorderState] = useState("gray");
    const [progress, setProgress] = useState(0);
    const [isReady, setIsReady] = useState(false);

    const captureTimerRef = useRef(null);
    const hasCapturedRef = useRef(false);
    const isReadyRef = useRef(false);
    isReadyRef.current = isReady;

    const setReady = useCallback(
      (value) => {
        setIsReady(value);
        onReady?.(value);
      },
      [onReady],
    );

    const resetCapture = useCallback(() => {
      if (captureTimerRef.current !== null) {
        clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
      }
      setProgress(0);
    }, []);

    const normalisePose = (pose) => {
      const value = (pose || "").toLowerCase().replace(/[\s-]+/g, "_");
      if (["front", "straight", "frontal", "forward"].includes(value))
        return "center";
      return value;
    };

    const isFaceInsideGuide = useCallback(
      (face) => {
        const frameWidth = frameSize.width;
        const frameHeight = frameSize.height;
        let [x1, y1, x2, y2] = face.bbox;
        if (!frameWidth || !frameHeight || x2 <= x1 || y2 <= y1) return false;

        if ([x1, y1, x2, y2].every((value) => value >= 0 && value <= 1)) {
          x1 *= frameWidth;
          x2 *= frameWidth;
          y1 *= frameHeight;
          y2 *= frameHeight;
        }

        const sourceAspect = frameWidth / frameHeight;
        const previewAspect = 4 / 5;
        const visibleWidth = Math.min(1, previewAspect / sourceAspect);
        const visibleHeight = Math.min(1, sourceAspect / previewAspect);
        const cropLeft = (1 - visibleWidth) / 2;
        const cropTop = (1 - visibleHeight) / 2;

        const toPreview = (x, y) => ({
          x: (x / frameWidth - cropLeft) / visibleWidth,
          y: (y / frameHeight - cropTop) / visibleHeight,
        });
        const corners = [
          toPreview(x1, y1),
          toPreview(x2, y1),
          toPreview(x1, y2),
          toPreview(x2, y2),
        ];

        const radiusX = 0.49;
        const radiusY = 0.49;
        return corners.every(
          ({ x, y }) =>
            ((x - 0.5) / radiusX) ** 2 + ((y - 0.5) / radiusY) ** 2 <= 1,
        );
      },
      [frameSize],
    );

    const startCaptureSequence = useCallback(() => {
      if (captureTimerRef.current !== null) return;

      setProgress(0);
      captureTimerRef.current = window.setInterval(() => {
        setProgress((prev) => {
          const next = prev + (TICK_MS / REQUIRED_STABILITY_MS) * 100;
          if (next >= 100) {
            if (captureTimerRef.current !== null) {
              clearInterval(captureTimerRef.current);
              captureTimerRef.current = null;
            }
            const file = captureHighQualityImage({ aspectRatio: 4 / 5 });
            if (file) {
              hasCapturedRef.current = true;
              onCapture(file);
              if (mode === "single_recognition") {
                window.setTimeout(() => {
                  if (isActive) {
                    hasCapturedRef.current = false;
                    startCaptureSequence();
                  }
                }, 1500);
              }
            }
            return 100;
          }
          return next;
        });
      }, TICK_MS);
    }, [captureHighQualityImage, onCapture, mode, isActive]);

    // Reset captured status when targetPose changes
    useEffect(() => {
      hasCapturedRef.current = false;
      resetCapture();
      setReady(false);
    }, [targetPose, resetCapture, setReady]);

    // Evaluation effect on faces/pose
    useEffect(() => {
      if (!isActive) {
        resetCapture();
        setBorderState("gray");
        setReady(false);
        return;
      }

      if (!faces || faces.length === 0) {
        setBorderState(isStreaming ? "red" : "gray");
        resetCapture();
        setReady(false);
        return;
      }

      if (faces.length > 1) {
        setBorderState("red");
        resetCapture();
        setReady(false);
        return;
      }

      const face = faces[0];
      const inGuide = isFaceInsideGuide(face);
      if (!inGuide) {
        setBorderState("red");
        resetCapture();
        setReady(false);
        return;
      }

      let isValid = false;
      if (mode === "registration") {
        isValid = normalisePose(face.pose) === targetPose;
      } else {
        const detectedPose = normalisePose(face.pose);
        const requiredPose = targetPose || "center";
        const poseMatches =
          requiredPose === "center"
            ? !detectedPose ||
              detectedPose === "unknown" ||
              detectedPose === "center"
            : detectedPose === requiredPose;
        isValid = poseMatches;
      }

      if (isValid && !hasCapturedRef.current) {
        setBorderState("green");
        setReady(true);
        if (!manualCapture) {
          startCaptureSequence();
        }
      } else {
        setBorderState("red");
        resetCapture();
        setReady(false);
      }
    }, [
      faces,
      targetPose,
      isActive,
      isStreaming,
      manualCapture,
      isFaceInsideGuide,
      mode,
      resetCapture,
      setReady,
      startCaptureSequence,
    ]);

    const captureCurrentPose = useCallback(() => {
      if (!manualCapture || !isReadyRef.current || hasCapturedRef.current)
        return false;
      const file = captureHighQualityImage({ aspectRatio: 4 / 5 });
      if (!file) return false;
      hasCapturedRef.current = true;
      setReady(false);
      onCapture(file);
      return true;
    }, [manualCapture, captureHighQualityImage, onCapture, setReady]);

    useImperativeHandle(ref, () => ({
      captureIfReady: captureCurrentPose,
    }));

    useEffect(() => {
      startStream();
      return () => {
        stopStream();
        resetCapture();
      };
    }, [startStream, stopStream, resetCapture]);

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-[min(72vw,16rem)] aspect-[4/5]">
          {/* Fixed capture frame with oval border */}
          <div
            className={`absolute inset-0 rounded-[50%] overflow-hidden bg-slate-900 border-4 transition-colors duration-300 shadow-xl ${
              borderState === "gray"
                ? "border-slate-300"
                : borderState === "red"
                  ? "border-red-500 shadow-red-500/20"
                  : "border-emerald-500 shadow-emerald-500/40"
            }`}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              playsInline
              muted
              autoPlay
            ></video>

            <div className="absolute inset-0 rounded-[50%] border-2 border-dashed border-white/80 pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.38)]" />

            {/* Offline / Connecting overlay */}
            {!isStreaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-sm p-4 text-center">
                {!error && !wsError && (
                  <Loader2 className="animate-spin mb-2" size={32} />
                )}
                {(error || wsError) && (
                  <VideoOff className="mb-2 text-red-400" size={40} />
                )}
                <p className="text-xs font-semibold">
                  {error || wsError || "Starting Camera..."}
                </p>
              </div>
            )}

            {/* Progress bar on capture */}
            {progress > 0 && progress < 100 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-32 h-2 bg-black/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

FaceOvalCamera.displayName = "FaceOvalCamera";

export default FaceOvalCamera;
