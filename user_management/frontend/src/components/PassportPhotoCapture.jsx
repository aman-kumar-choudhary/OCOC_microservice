import React, { useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  Camera,
  CheckCircle,
  ImageSquare,
  SpinnerGap,
  UploadSimple,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Professional Identity Passport Photo Component (3:4 Portrait Aspect Ratio)
 */
export const PassportPhotoCapture = ({
  value,
  onChange,
  required = false,
  label = "Passport Photo",
  helperText = "Standard 35×45mm format, front-facing, neutral background (max 2 MB)",
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => () => stopCamera(), []);

  const openCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOpen(true);
    } catch {
      setError("Camera is unavailable or permission was denied. Please upload an image file instead.");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    setIsProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      const sourceRatio = video.videoWidth / video.videoHeight;
      const targetRatio = 3 / 4;
      const cropWidth =
        sourceRatio > targetRatio
          ? video.videoHeight * targetRatio
          : video.videoWidth;
      const cropHeight = cropWidth / targetRatio;
      const sx = (video.videoWidth - cropWidth) / 2;
      const sy = (video.videoHeight - cropHeight) / 2;
      canvas.width = 450;
      canvas.height = 600;
      canvas
        .getContext("2d")
        .drawImage(
          video,
          sx,
          sy,
          cropWidth,
          cropHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setImgError(false);
      onChange(dataUrl);
      stopCamera();
    } catch (err) {
      setError("Failed to capture image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Photo must be smaller than 2 MB.");
      return;
    }
    setError("");
    setIsProcessing(true);
    try {
      const dataUrl = await toDataUrl(file);
      setImgError(false);
      onChange(dataUrl);
    } catch {
      setError("Unable to process selected image.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        {/* Photo Box with Strict 3:4 Aspect Ratio */}
        <div className="relative w-32 h-[170px] shrink-0 rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex flex-col items-center justify-center shadow-xs">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-1.5 text-slate-500">
              <SpinnerGap size={24} className="animate-spin text-[#0a2342]" />
              <span className="text-[10px] font-bold">Processing...</span>
            </div>
          ) : value && !imgError ? (
            <>
              <img
                src={value}
                alt="Passport portrait"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur-xs shadow-xs">
                3:4 OK
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-1 text-slate-400">
                <User size={26} weight="duotone" />
              </div>
              <span className="text-[11px] font-bold text-slate-600">No Photo</span>
              <span className="text-[9px] text-slate-400 mt-0.5">3:4 Portrait</span>
            </div>
          )}
        </div>

        {/* Identity & Action Details */}
        <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch text-center sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-sm font-bold text-slate-900">
                {label} {required && <span className="text-rose-500">*</span>}
              </span>
              {value && !imgError && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                  <CheckCircle size={12} weight="fill" /> Ready
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              {helperText}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <button
              type="button"
              onClick={openCamera}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0a2342] shadow-2xs transition disabled:opacity-50"
            >
              <Camera size={14} weight="bold" className="text-[#0a2342]" />
              <span>Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0a2342] shadow-2xs transition disabled:opacity-50"
            >
              <UploadSimple size={14} weight="bold" className="text-[#0a2342]" />
              <span>Upload Image</span>
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setImgError(false);
                }}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 text-xs font-bold text-rose-600 transition disabled:opacity-50"
                title="Remove photo"
              >
                <X size={13} weight="bold" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={chooseFile}
          />

          {error && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-600">
              <WarningCircle size={14} weight="bold" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Camera Capture Dialog */}
      {cameraOpen && (
        <div className="mt-4 border-t border-slate-100 pt-4 animate-fade-in">
          <div className="relative mx-auto w-full max-w-xs rounded-2xl overflow-hidden bg-slate-950 aspect-[3/4] shadow-md border-2 border-slate-700">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* 3:4 Framing guide overlay */}
            <div className="absolute inset-4 rounded-xl border border-dashed border-white/40 pointer-events-none flex flex-col items-center justify-between p-3 text-center">
              <span className="text-[10px] text-white/70 font-bold bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                Position Face Within Frame
              </span>
              <span className="text-[9px] text-white/50 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                Look straight ahead
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={capture}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0a2342] hover:bg-[#163a66] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {isProcessing ? (
                <SpinnerGap size={14} className="animate-spin" />
              ) : (
                <Camera size={14} weight="bold" className="text-[#f5bd19]" />
              )}
              <span>Capture Photo</span>
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
            >
              <ArrowCounterClockwise size={14} weight="bold" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassportPhotoCapture;
