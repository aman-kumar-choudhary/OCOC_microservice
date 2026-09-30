import React, { useState } from 'react'
import userService from '@/services/userService'
import { X, Loader2, ShieldOff, ShieldCheck, UserX, AlertTriangle } from 'lucide-react'

export const UserStatusModal = ({
  user,
  action,
  onClose,
  onDone
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const getConfig = () => {
    if (action === 'suspend') {
      return {
        icon: ShieldOff,
        title: 'Suspend User',
        verb: 'Suspend',
        color: 'amber',
        bgClass: 'bg-amber-50 border-amber-200 text-amber-800',
        btnClass: 'bg-amber-500 text-white hover:bg-amber-600',
        consequences: [
          ' RFID card access will be immediately revoked',
          ' Keycloak login session will be terminated',
          ' User will be unable to log into any OCOC system',
          ' Can be re-activated by an administrator',
        ]
      }
    }
    if (action === 'activate') {
      return {
        icon: ShieldCheck,
        title: 'Activate User',
        verb: 'Activate',
        color: 'emerald',
        bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        btnClass: 'btn-primary',
        consequences: [
          ' Keycloak account will be re-enabled',
          ' User will be able to log in again',
          ' RFID access must be re-issued separately if revoked',
        ]
      }
    }
    if (action === 'deactivate') {
      return {
        icon: UserX,
        title: 'Permanently Deactivate',
        verb: 'Deactivate',
        color: 'red',
        bgClass: 'bg-red-50 border-red-200 text-red-800',
        btnClass: 'bg-red-600 text-white hover:bg-red-700',
        consequences: [
          ' RFID card access permanently revoked',
          ' Keycloak login session immediately terminated',
          ' User record preserved for audit history',
          ' Cannot be reversed without admin intervention',
        ]
      }
    }
    return {
      icon: UserX,
      title: 'Delete User Permanently',
      verb: 'Delete',
      color: 'red',
      bgClass: 'bg-red-50 border-red-200 text-red-800',
      btnClass: 'bg-red-600 text-white hover:bg-red-700',
      consequences: [
        ' The user profile and related RFID assignments will be deleted',
        ' Face enrollment and stored embeddings will be deleted',
        ' Audit events are retained without the deleted user record',
        'This action cannot be undone',
      ]
    }
  }

  const config = getConfig()
  const Icon = config.icon

  const handleConfirm = async () => {
    setIsLoading(true)
    setError('')
    try {
      if (action === 'suspend') await userService.suspend(user.id)
      else if (action === 'activate') await userService.activate(user.id)
      else if (action === 'deactivate') await userService.deactivate(user.id)
      else await userService.remove(user.id)

      onDone()
      onClose()
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Action failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md glass-panel p-0 overflow-hidden shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border-light)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  action === 'activate'
                    ? 'bg-emerald-100 text-emerald-600'
                    : action === 'suspend'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                <Icon size={20} />
              </div>
              <h2 className="text-lg font-extrabold">{config.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* User info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-main)]">
            <div className="w-10 h-10 rounded-full bg-[#0a2342]/8 flex items-center justify-center text-sm font-bold text-[#0a2342]">
              {(user.profile?.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold">{user.profile?.full_name || user.email}</div>
              <div className="text-xs text-muted">
                {user.email} · {user.user_type}
              </div>
            </div>
          </div>

          {/* Consequences */}
          <div className={`p-4 rounded-xl border ${config.bgClass}`}>
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span className="text-sm font-bold">What will happen:</span>
            </div>
            <ul className="space-y-1">
              {config.consequences.map((c) => (
                <li key={c} className="text-xs leading-relaxed">
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            id={`confirm-${action}-btn`}
            className={`btn ${config.btnClass}`}
          >
            {isLoading ? <Loader2 className="animate-spin" size={15} /> : <Icon size={15} />}
            {config.verb}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserStatusModal
