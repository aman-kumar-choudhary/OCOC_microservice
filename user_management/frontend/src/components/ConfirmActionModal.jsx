import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, ShieldAlert, X, Loader2, Lock } from 'lucide-react'

export const ConfirmActionModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  requireReason = false,
  reasonPlaceholder = 'Please specify reason...',
  isDanger = false,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('A justification reason is required for this action.')
      return
    }
    setError('')
    onConfirm(reason.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${
          isDanger ? 'bg-red-50/80 border-red-100 text-red-900' : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-2.5 font-extrabold text-sm sm:text-base">
            {isDanger ? (
              <AlertTriangle size={20} className="text-red-600 shrink-0" />
            ) : (
              <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            )}
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {description && (
            <p className="text-slate-600 leading-relaxed">
              {description}
            </p>
          )}

          {requireReason && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Reason / Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (error) setError('')
                }}
                placeholder={reasonPlaceholder}
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
                disabled={isLoading}
                autoFocus
              />
              {error && (
                <p className="text-red-600 font-semibold">{error}</p>
              )}
            </div>
          )}

          {/* Audit Trail Disclaimer Notice */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed">
            <Lock size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <span>
              <strong>Audit Ledger Notice:</strong> This action is cryptographically tied to your active Keycloak session and recorded in the append-only audit trail with your Actor ID, timestamp, and IP address.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl font-bold text-white shadow-xs transition flex items-center gap-1.5 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0a2342] hover:bg-[#12365f]'
            }`}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmActionModal
