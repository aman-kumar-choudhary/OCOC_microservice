import React, { useState, useEffect, useRef } from "react";
import { recognizeFace, recognizeFaces } from "@/services/frecoService";
import api from "@/services/api";
import { ScanFace, Users, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import FaceOvalCamera from "@/components/FaceOvalCamera";
import FaceWideCamera from "@/components/FaceWideCamera";
export const FaceRecognition = () => {
  const [activeTab, setActiveTab] = useState("single");
  const wideCameraRef = useRef(null);

  const [singleResult, setSingleResult] = useState(null);
  const [multiResult, setMultiResult] = useState(null);
  const [singleError, setSingleError] = useState("");
  const [multiError, setMultiError] = useState("");
  const [singleBusy, setSingleBusy] = useState(false);
  const [multiBusy, setMultiBusy] = useState(false);

  const logRecognition = (result, authType) => {
    const livenessFailed = result.message === "Liveness check failed";
    return api
      .post("/face-auth/log", {
        person_external_id: result.userId || "",
        person_name: result.name || "",
        result: result.recognized
          ? "success"
          : livenessFailed
            ? "liveness_failed"
            : "unknown",
        similarity_score: result.similarity,
        liveness_score: result.liveness_score,
        reason: result.message || "",
        auth_type: authType,
      })
      .catch(() => undefined);
  };

  const onSingleCapture = async (file) => {
    if (singleBusy || activeTab !== "single") return;
    setSingleBusy(true);
    setSingleError("");
    try {
      const res = await recognizeFace(file);
      setSingleResult(res);
      await logRecognition(res, "single");
    } catch (e) {
      setSingleError(e.response?.data?.detail || "Recognition unavailable");
    } finally {
      setSingleBusy(false);
    }
  };

  const recognizeMultiFrame = async () => {
    if (multiBusy || activeTab !== "mass") return;
    const frame = wideCameraRef.current?.capture();
    if (!frame) return;
    setMultiBusy(true);
    setMultiError("");
    try {
      const res = await recognizeFaces(frame);
      setMultiResult(res);
      await Promise.all(res.faces.map((face) => logRecognition(face, "mass")));
    } catch (e) {
      setMultiError(e.response?.data?.detail || "Recognition unavailable");
    } finally {
      setMultiBusy(false);
    }
  };

  useEffect(() => {
    let multiTimer;
    if (activeTab === "mass") {
      multiTimer = window.setInterval(recognizeMultiFrame, 1500);
    }
    return () => {
      if (multiTimer) clearInterval(multiTimer);
    };
  }, [activeTab, multiBusy]);

  const singleState = !singleResult
    ? "Waiting for one live face"
    : singleResult.recognized
      ? "Recognized"
      : "Unknown";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Face Recognition Lab</h1>
        <p className="text-muted text-sm mt-1">
          Continuous camera recognition using stored ArcFace embeddings.
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-[var(--bg-input)] rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("single")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
            activeTab === "single"
              ? "bg-[#0a2342] text-[#f5bd19]"
              : "text-muted hover:text-[#0a2342]"
          }`}
        >
          <ScanFace size={16} /> Single Face
        </button>
        <button
          onClick={() => setActiveTab("mass")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
            activeTab === "mass"
              ? "bg-[#0a2342] text-[#f5bd19]"
              : "text-muted hover:text-[#0a2342]"
          }`}
        >
          <Users size={16} /> Multi Face
        </button>
      </div>

      {activeTab === "single" ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-panel p-5">
            <FaceOvalCamera
              mode="single_recognition"
              targetPose="center"
              isActive={true}
              onCapture={onSingleCapture}
            />
            <p className="text-center text-sm text-muted mt-3">
              Keep exactly one face in the green guide. Recognition runs
              automatically.
            </p>
          </div>

          <div className="glass-panel p-5 flex flex-col justify-center text-center">
            {singleBusy ? (
              <Loader2
                className="animate-spin mx-auto mb-3 text-[#f5bd19]"
                size={40}
              />
            ) : singleResult?.recognized ? (
              <ShieldCheck
                className="text-emerald-500 mx-auto mb-3"
                size={54}
              />
            ) : singleResult ? (
              <ShieldX className="text-red-500 mx-auto mb-3" size={54} />
            ) : null}

            <p className="font-bold text-xl">{singleState}</p>
            {singleResult?.recognized && (
              <>
                <p className="mt-3 text-lg font-bold">{singleResult.name}</p>
                <p className="text-muted">
                  {singleResult.role} ·{" "}
                  {Math.round((singleResult.similarity || 0) * 100)}%
                </p>
              </>
            )}
            {singleError && (
              <p className="text-red-500 text-sm mt-3">{singleError}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-panel p-5">
            <FaceWideCamera ref={wideCameraRef} />
            <p className="text-center text-sm text-muted mt-3">
              Live frames are sampled automatically; each detected face is
              searched independently.
            </p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex gap-2 items-center mb-4">
              {multiBusy && (
                <Loader2 className="animate-spin text-[#f5bd19]" size={18} />
              )}
              <h2 className="font-bold text-lg">Live results</h2>
            </div>

            {!multiResult || multiResult.faces.length === 0 ? (
              <p className="text-muted text-sm mt-5">Waiting for faces…</p>
            ) : (
              <div className="space-y-3">
                {multiResult.faces.map((face) => (
                  <div
                    key={face.faceIndex}
                    className={`rounded-lg border p-3 ${
                      face.recognized
                        ? "border-emerald-500 bg-emerald-50/20 text-emerald-600"
                        : "border-red-400 bg-red-50/20 text-red-500"
                    }`}
                  >
                    <b>
                      Face #{face.faceIndex + 1}:{" "}
                      {face.recognized ? face.name : "Unknown"}
                    </b>
                    {face.recognized && (
                      <span>
                        {" "}
                        · {Math.round((face.similarity || 0) * 100)}%
                      </span>
                    )}
                    <p className="text-xs mt-1">
                      {face.role || face.message} · live{" "}
                      {Math.round((face.liveness_score || 0) * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
            {multiError && (
              <p className="text-red-500 text-sm mt-3">{multiError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceRecognition;
