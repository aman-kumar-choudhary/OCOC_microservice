import { useState, useRef, useEffect, useCallback } from "react";

export function useLiveFaceInference(
  videoElementRef,
  mode = "single_recognition",
) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [wsError, setWsError] = useState(null);
  const [faces, setFaces] = useState([]);
  const [frameSize, setFrameSize] = useState({ width: 640, height: 360 });

  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const loopIdRef = useRef(null);
  const frameInFlightRef = useRef(false);
  const canvasRef = useRef(null);
  const isStreamingRef = useRef(false);
  isStreamingRef.current = isStreaming;
  const FPS = 10;
  const intervalMs = 1000 / FPS;

  const getWsUrl = useCallback(() => {
    const frecoUrl = import.meta.env.VITE_FRECO_URL || "http://localhost:8000";
    const wsBase = frecoUrl.replace(/^http/, "ws");
    return `${wsBase}/api/v1/face/stream`;
  }, []);

  const startWebSocket = useCallback(() => {
    if (wsRef.current) return;
    setWsError(null);

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected for face inference");
    };

    ws.onmessage = (event) => {
      frameInFlightRef.current = false;
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setWsError(data.error);
        } else if (
          data.status === "face_detected" ||
          data.status === "faces_detected"
        ) {
          setFaces(data.faces || []);
        } else if (data.status === "no_face_detected") {
          setFaces([]);
        }
      } catch (err) {
        console.error("Error parsing WS message", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setWsError("Failed to connect to face stream backend.");
    };

    ws.onclose = () => {
      frameInFlightRef.current = false;
      wsRef.current = null;
    };
  }, [getWsUrl]);

  const stopWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const captureAndSendFrame = useCallback(() => {
    const video = videoElementRef.current;
    if (
      !video ||
      !isStreamingRef.current ||
      frameInFlightRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const MAX_WIDTH = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > MAX_WIDTH) {
      height = Math.floor(height * (MAX_WIDTH / width));
      width = MAX_WIDTH;
    }

    canvas.width = width;
    canvas.height = height;
    setFrameSize({ width, height });

    ctx?.drawImage(video, 0, 0, width, height);

    const base64Frame = canvas.toDataURL("image/jpeg", 0.6);
    const payload = {
      mode,
      frame: base64Frame,
    };

    frameInFlightRef.current = true;
    wsRef.current.send(JSON.stringify(payload));
  }, [videoElementRef, mode]);

  const loop = useCallback(() => {
    if (!isStreamingRef.current) return;
    captureAndSendFrame();
    setTimeout(() => {
      if (isStreamingRef.current) {
        loopIdRef.current = requestAnimationFrame(loop);
      }
    }, intervalMs);
  }, [captureAndSendFrame, intervalMs]);

  const stopStream = useCallback(() => {
    setIsStreaming(false);
    isStreamingRef.current = false;
    frameInFlightRef.current = false;
    setFaces([]);

    if (loopIdRef.current) {
      cancelAnimationFrame(loopIdRef.current);
      loopIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }
    stopWebSocket();
  }, [videoElementRef, stopWebSocket]);

  const startStream = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
        setIsStreaming(true);
        isStreamingRef.current = true;
        startWebSocket();
        loopIdRef.current = requestAnimationFrame(loop);
      }
    } catch (e) {
      setError("Could not access camera. Please allow camera permissions.");
      console.error(e);
    }
  }, [videoElementRef, startWebSocket, loop]);

  const captureInferenceImage = useCallback(() => {
    const video = videoElementRef.current;
    if (
      !video ||
      !isStreamingRef.current ||
      !video.videoWidth ||
      !video.videoHeight
    )
      return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const maxWidth = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxWidth) {
      height = Math.round(height * (maxWidth / width));
      width = maxWidth;
    }
    canvas.width = width;
    canvas.height = height;
    setFrameSize({ width, height });
    ctx?.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const bytes = atob(dataUrl.split(",")[1]);
    const data = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) data[i] = bytes.charCodeAt(i);
    return new File([data], `live-frame-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
  }, [videoElementRef]);

  const captureHighQualityImage = useCallback(
    (options = {}) => {
      const video = videoElementRef.current;
      if (!video || !isStreamingRef.current) return null;

      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const aspectRatio = options.aspectRatio;
      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;
      let cropX = 0;
      let cropY = 0;

      if (aspectRatio && sourceWidth / sourceHeight > aspectRatio) {
        cropWidth = Math.round(sourceHeight * aspectRatio);
        cropX = Math.round((sourceWidth - cropWidth) / 2);
      } else if (aspectRatio && sourceWidth / sourceHeight < aspectRatio) {
        cropHeight = Math.round(sourceWidth / aspectRatio);
        cropY = Math.round((sourceHeight - cropHeight) / 2);
      }

      const hdCanvas = document.createElement("canvas");
      hdCanvas.width = cropWidth;
      hdCanvas.height = cropHeight;
      const hdCtx = hdCanvas.getContext("2d");
      hdCtx?.drawImage(
        video,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );

      const dataUrl = hdCanvas.toDataURL("image/jpeg", 0.9);
      const byteString = atob(dataUrl.split(",")[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: "image/jpeg" });
      return new File([blob], `capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
    },
    [videoElementRef],
  );

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    isStreaming,
    error,
    wsError,
    faces,
    frameSize,
    startStream,
    stopStream,
    captureHighQualityImage,
    captureInferenceImage,
  };
}

export default useLiveFaceInference;
