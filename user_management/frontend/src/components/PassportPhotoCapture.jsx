import React, { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, X } from "lucide-react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** A compact passport-photo capture control that stores a portable data URL. */
export const PassportPhotoCapture = ({ value, onChange, required = false }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => () => stopCamera(), []);

  const openCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOpen(true);
    } catch {
      setError("Camera is unavailable. Choose an image file instead.");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
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
    onChange(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setError("Please choose an image file.");
    if (file.size > MAX_IMAGE_BYTES)
      return setError("Photo must be smaller than 2 MB.");
    setError("");
    onChange(await toDataUrl(file));
  };

  return (
    <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-main)] p-4">
      <div className="flex gap-4 items-start">
        <div className="h-28 w-21 shrink-0 overflow-hidden rounded-lg border border-[var(--border-light)] bg-slate-100 grid place-items-center">
          {value ? (
            <img
              src={value}
              alt="Passport photo preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-slate-400 text-center px-2">
              Passport photo
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            Passport-size photo {required && "*"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Use the camera or upload a clear front-facing photo (max 2 MB).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCamera}
              className="btn btn-outline py-1.5 px-3 text-xs"
            >
              <Camera size={14} /> Take photo
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn btn-outline py-1.5 px-3 text-xs"
            >
              <ImagePlus size={14} /> Upload
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="btn btn-outline py-1.5 px-3 text-xs text-red-600"
              >
                <X size={14} /> Remove
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={chooseFile}
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
      {cameraOpen && (
        <div className="mt-4 border-t border-[var(--border-light)] pt-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="mx-auto aspect-[3/4] max-h-72 rounded-lg bg-slate-900 object-cover"
          />
          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={capture}
              className="btn btn-primary py-2 px-4 text-sm"
            >
              <Camera size={15} /> Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="btn btn-outline py-2 px-4 text-sm"
            >
              <RotateCcw size={15} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassportPhotoCapture;
