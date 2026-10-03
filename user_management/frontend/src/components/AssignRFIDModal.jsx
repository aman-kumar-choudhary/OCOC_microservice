import React, { useState } from "react";
import rfidService from "@/services/rfidService";
import {
  CreditCard,
  SpinnerGap,
  Warning,
  X
} from "@phosphor-icons/react";
export const AssignRFIDModal = ({ card, onClose, onDone }) => {
  const [newUid, setNewUid] = useState("");
  const [reason, setReason] = useState("lost");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newUid.trim()) {
      setError("New UID is required");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await rfidService.replace(card.user_id, newUid.trim(), reason);
      onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Replace failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 glass-panel p-0 w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <h2 className="font-extrabold">Assign Replacement Tag</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4">
            {/* Current card */}
            <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-light)]">
              <div className="text-xs text-muted mb-1 font-semibold uppercase tracking-wide">
                Current Card (will be marked as {reason})
              </div>
              <div className="font-mono font-bold tracking-widest">
                {card.uid}
              </div>
            </div>

            <div>
              <label className="form-label">Reason for Replacement</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="form-input form-select"
              >
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="damaged">Damaged</option>
                <option value="upgrade">Upgrade</option>
              </select>
            </div>

            <div>
              <label className="form-label">New Tag UID</label>
              <input
                value={newUid}
                onChange={(e) => setNewUid(e.target.value)}
                className="form-input font-mono"
                placeholder="Scan or type new UID…"
                id="new-uid-input"
              />
            </div>

            {reason === "stolen" && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-semibold flex items-start gap-2">
                <Warning size={14} className="mt-0.5 shrink-0" />
                The old card will be flagged as stolen and immediately revoked.
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm font-semibold border border-red-500/20">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              id="confirm-replace-btn"
            >
              {isLoading ? (
                <SpinnerGap className="animate-spin" size={15} />
              ) : (
                <CreditCard size={15} />
              )}
              Assign New Tag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignRFIDModal;
