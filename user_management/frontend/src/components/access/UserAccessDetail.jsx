import React, { useState, useEffect } from 'react'
import {
  X, User, Shield, MapPin, Key, Clock, Calendar, CheckCircle2,
  AlertTriangle, Trash2, Plus, RefreshCw, Loader2, Sparkles,
  ExternalLink, ChevronRight, History, Layers, Check, Edit3,
  AlertCircle, Building, Award, UserCheck, ShieldAlert, Copy, Eye, EyeOff, Lock
} from 'lucide-react'
import accessService from '@/services/accessService'
import userService from '@/services/userService'
import AssignAccessModal from './AssignAccessModal'

const OPERATIONAL_ROLES = [
  { id: 'STUDENT', label: 'Student', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'FACULTY', label: 'Faculty', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'GUARD', label: 'Guard', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { id: 'SECURITY_GUARD', label: 'Security Guard', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'WARDEN', label: 'Hostel Warden', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'STAFF', label: 'Staff Member', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'WORKER', label: 'Campus Worker', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'VISITOR', label: 'Campus Visitor', color: 'bg-purple-50 text-purple-700 border-purple-200' },
]

export const UserAccessDetail = ({
  userId,
  onClose,
  onUserUpdated
}) => {
  const [detail, setDetail] = useState(null)
  const [effectivePerms, setEffectivePerms] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [hostelsList, setHostelsList] = useState([])
  const [locationTree, setLocationTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('grants') // 'grants' | 'roles' | 'credentials' | 'effective' | 'history'

  // Credentials & Workspace
  const [issuedCredentials, setIssuedCredentials] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')
  const [issuingCredentials, setIssuingCredentials] = useState(false)
  const [autoIssuePassword, setAutoIssuePassword] = useState(true)
  const [customPasswordInput, setCustomPasswordInput] = useState('')

  // Role editing
  const [selectedRoles, setSelectedRoles] = useState([])
  const [selectedHostels, setSelectedHostels] = useState([])
  const [savingRoles, setSavingRoles] = useState(false)
  const [roleMessage, setRoleMessage] = useState('')

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [revokingGrantId, setRevokingGrantId] = useState(null)
  const [extendingGrant, setExtendingGrant] = useState(null)
  const [newExpiryDate, setNewExpiryDate] = useState('')
  const [extendLoading, setExtendLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (userId) {
      loadAllData()
    }
  }, [userId])

  const loadAllData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [userDetail, userAccess, perms, logs, tree, hostels] = await Promise.all([
        accessService.getAccessUserDetail(userId),
        accessService.getUserAccess(userId).catch(() => ({ roles: [], hostels: [] })),
        accessService.getUserEffectivePermissions(userId).catch(() => []),
        accessService.getAccessAuditLogs({ user_id: userId, page: 1, page_size: 15 }).catch(() => ({ logs: [] })),
        accessService.getLocationTree().catch(() => []),
        userService.getHostels().catch(() => [])
      ])

      setDetail(userDetail)
      setEffectivePerms(perms || [])
      setAuditLogs(logs.logs || [])
      setLocationTree(tree || [])
      setHostelsList(hostels || [])

      setSelectedRoles(userAccess.roles || userDetail.roles || [])
      setSelectedHostels(
        (userAccess.hostels || []).map(h => (typeof h === 'string' ? h : h.id))
      )
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to load user access details.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2500)
  }

  const handleIssueCredentials = async (customPwd = null) => {
    setIssuingCredentials(true)
    setRoleMessage('')
    try {
      const res = await accessService.issueUserCredentials(userId, customPwd)
      setIssuedCredentials(res)
      setActiveTab('credentials')
      setRoleMessage(`Credentials successfully generated and synchronized for ${res.email}!`)
      await loadAllData()
      if (onUserUpdated) onUserUpdated()
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to issue credentials.')
    } finally {
      setIssuingCredentials(false)
      setCustomPasswordInput('')
    }
  }

  // Save role updates
  const handleSaveRoles = async () => {
    setSavingRoles(true)
    setRoleMessage('')
    try {
      const res = await accessService.updateUserAccess(userId, {
        roles: selectedRoles,
        hostel_ids: selectedRoles.includes('WARDEN') ? selectedHostels : [],
        issue_password: autoIssuePassword,
        custom_password: customPasswordInput ? customPasswordInput.trim() : undefined,
      })
      const assignedRoles = (res.roles || []).join(', ') || 'No operational roles'
      const identity = detail?.email || userId
      const identityId = detail?.id || userId
      const kcId = res.keycloak_user_id ? ` Keycloak ID: ${res.keycloak_user_id}.` : ''

      if (res.credentials?.password) {
        setIssuedCredentials(res.credentials)
        setActiveTab('credentials')
      }

      const credentialsNotice = res.credentials?.password
        ? ' Login credentials have been generated and are ready to copy in the Login & Credentials tab.'
        : res.credentials_issued
          ? ' Login credentials generated.'
        : ''
      setRoleMessage(`Keycloak roles synchronized for ${identity} (User ID: ${identityId}). Assigned: ${assignedRoles}.${kcId}${credentialsNotice}`)
      await loadAllData()
      if (onUserUpdated) onUserUpdated()
    } catch (err) {
      setRoleMessage(err.response?.data?.error?.message || 'Failed to update roles.')
    } finally {
      setSavingRoles(false)
    }
  }

  const toggleRole = (roleId) => {
    if (selectedRoles.includes(roleId)) {
      setSelectedRoles(selectedRoles.filter(r => r !== roleId))
    } else {
      setSelectedRoles([...selectedRoles, roleId])
    }
  }

  const toggleHostel = (hostelId) => {
    if (selectedHostels.includes(hostelId)) {
      setSelectedHostels(selectedHostels.filter(h => h !== hostelId))
    } else {
      setSelectedHostels([...selectedHostels, hostelId])
    }
  }

  // Revoke grant
  const handleRevokeGrant = async (grantId) => {
    if (!confirm('Are you sure you want to revoke this location access grant?')) return
    setRevokingGrantId(grantId)
    try {
      await accessService.revokeLocationGrant(grantId)
      await loadAllData()
      if (onUserUpdated) onUserUpdated()
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to revoke grant.')
    } finally {
      setRevokingGrantId(null)
    }
  }

  // Extend / Edit grant expiry
  const handleExtendGrantSubmit = async (e) => {
    e.preventDefault()
    if (!extendingGrant) return
    setExtendLoading(true)
    try {
      await accessService.updateLocationGrant(extendingGrant.id, {
        valid_until: newExpiryDate ? new Date(newExpiryDate).toISOString() : null,
        status: 'active'
      })
      setExtendingGrant(null)
      await loadAllData()
      if (onUserUpdated) onUserUpdated()
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to extend grant.')
    } finally {
      setExtendLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-amber-500" />
        <p className="text-sm font-semibold text-slate-600">Loading access profile...</p>
      </div>
    )
  }

  if (errorMsg || !detail) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Error loading user access</p>
            <p>{errorMsg || 'User details not found'}</p>
          </div>
          <button onClick={loadAllData} className="btn btn-outline text-xs">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    )
  }

  // The API returns identity fields at the top level, not inside `user`.
  const user = detail
  const { location_grants = [], temporary_grants = [] } = detail

  // Helper for access level badge
  const renderAccessBadge = (level) => {
    switch (level) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">ADMIN</span>
      case 'MANAGE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">MANAGE</span>
      case 'ENTRY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">ENTRY</span>
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{level}</span>
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Top Header / User Profile Summary ── */}
      <div className="p-6 border-b border-[var(--border-light)] bg-gradient-to-b from-slate-50 to-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {user.photo_reference ? (
              <img
                src={user.photo_reference}
                alt={user.full_name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md ring-1 ring-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#0a2342] text-amber-400 font-extrabold text-2xl flex items-center justify-center shadow-md">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            {/* Identity Details */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-[#0a2342] tracking-tight">
                  {user.full_name || 'Unnamed User'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  user.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : user.status === 'suspended'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {user.status || 'active'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {user.user_type || 'user'}
                </span>
              </div>

              <p className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-3">
                <span>{user.email}</span>
                {user.phone && <span>• {user.phone}</span>}
                {(user.roll_number || user.employee_id) && (
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                    ID: {user.roll_number || user.employee_id}
                  </span>
                )}
              </p>

              {/* Academic / Hostel tags */}
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-600">
                {user.department && (
                  <span className="flex items-center gap-1 bg-blue-50/70 border border-blue-100 px-2 py-0.5 rounded-md text-blue-800 font-medium">
                    <Building size={12} /> {user.department}
                  </span>
                )}
                {user.course && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                    Course: {user.course} {user.semester ? `(Sem ${user.semester})` : ''}
                  </span>
                )}
                {user.hostel_name && (
                  <span className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-amber-900 font-medium">
                    Hostel: {user.hostel_name}
                  </span>
                )}
                {user.keycloak_linked && (
                  <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md text-emerald-800" title={`Keycloak ID: ${user.keycloak_user_id}`}>
                    <Key size={11} /> Keycloak Synced
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              title="Refresh access data"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition"
            >
              <RefreshCw size={16} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-200">
          {[
            { id: 'grants', label: 'Location Grants', icon: MapPin, count: location_grants.length },
            { id: 'roles', label: 'Operational Roles', icon: Shield, count: (detail.roles || []).length },
            { id: 'credentials', label: 'Login & Credentials', icon: Key, badge: issuedCredentials ? 'Ready' : null },
            { id: 'effective', label: 'Effective Permissions', icon: Layers, count: effectivePerms.length },
            { id: 'history', label: 'Audit History', icon: History, count: auditLogs.length }
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition relative ${
                  isActive
                    ? 'border-amber-500 text-amber-700 bg-amber-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-amber-200/60 text-amber-900' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ── 1. LOCATION GRANTS TAB ── */}
        {activeTab === 'grants' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Granted Location Access</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Explicit location grants assigned to this user in PostgreSQL. Grants propagate to child zones automatically.
                </p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="btn btn-primary text-xs"
              >
                <Plus size={15} /> Assign Location Access
              </button>
            </div>

            {location_grants.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <MapPin size={36} className="mx-auto text-slate-300 mb-2" />
                <h4 className="font-bold text-sm text-slate-700">No Location Grants Assigned</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  This user currently relies on default public access rules or role-based RFID rules.
                </p>
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="btn btn-outline text-xs"
                >
                  <Plus size={14} /> Assign First Location Grant
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border-light)] bg-white shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[11px] font-bold text-[var(--text-muted)] uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Validity</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {location_grants.map((grant) => {
                      const isExpired = grant.status === 'expired' || (grant.valid_until && new Date(grant.valid_until) < new Date())
                      const isRevoked = grant.status === 'revoked'
                      return (
                        <tr key={grant.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-amber-500 shrink-0" />
                              <span>{grant.location_name || 'Location ' + grant.location_id.slice(0, 8)}</span>
                            </div>
                            {grant.reason && (
                              <p className="text-[10px] text-slate-400 mt-0.5 ml-5">{grant.reason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 capitalize">
                            {grant.location_type || 'building'}
                          </td>
                          <td className="px-4 py-3">
                            {renderAccessBadge(grant.access_level)}
                          </td>
                          <td className="px-4 py-3">
                            {grant.valid_until ? (
                              <span className={`flex items-center gap-1 font-medium ${
                                isExpired ? 'text-rose-600 line-through' : 'text-slate-700'
                              }`}>
                                <Clock size={12} />
                                {new Date(grant.valid_until).toLocaleDateString()} {new Date(grant.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <Sparkles size={12} /> Permanent
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              isRevoked
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isExpired
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setExtendingGrant(grant)
                                  setNewExpiryDate(grant.valid_until ? new Date(grant.valid_until).toISOString().slice(0, 16) : '')
                                }}
                                title="Edit / Extend expiration"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                              >
                                <Edit3 size={13} />
                              </button>
                              {!isRevoked && (
                                <button
                                  onClick={() => handleRevokeGrant(grant.id)}
                                  disabled={revokingGrantId === grant.id}
                                  title="Revoke access grant"
                                  className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition disabled:opacity-50"
                                >
                                  {revokingGrantId === grant.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Temporary Grants Legacy Section if any */}
            {temporary_grants.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Temporary / Visitor Pass Grants
                </h4>
                <div className="space-y-2">
                  {temporary_grants.map((tg) => (
                    <div key={tg.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{tg.location_name || tg.location_id}</span>
                        <span className="ml-2 text-slate-500">Valid: {new Date(tg.valid_from).toLocaleDateString()} – {new Date(tg.valid_to).toLocaleDateString()}</span>
                        {tg.reason && <p className="text-[11px] text-slate-500 mt-0.5">{tg.reason}</p>}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {tg.status || 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. OPERATIONAL ROLES TAB ── */}
        {activeTab === 'roles' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Operational Role Management</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Manage roles synchronized directly with Keycloak. Adding or removing roles updates the user's Keycloak realm roles instantly.
              </p>
            </div>

            {roleMessage && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                roleMessage.includes('synchronized')
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <CheckCircle2 size={16} />
                <span>{roleMessage}</span>
              </div>
            )}

            {/* Role checkboxes */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Select Assigned Roles</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {OPERATIONAL_ROLES.map((role) => {
                  const isChecked = selectedRoles.includes(role.id)
                  return (
                    <label
                      key={role.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        isChecked
                          ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRole(role.id)}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{role.label}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{role.id}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${role.color}`}>
                        {role.id}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Warden Hostel Scope if WARDEN role selected */}
            {selectedRoles.includes('WARDEN') && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-amber-700" />
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Warden Hostel Scope Assignment
                  </h4>
                </div>
                <p className="text-[11px] text-amber-800">
                  Wardens are restricted to managing students and leave requests for specific assigned hostels. Select the hostels this warden oversees:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {hostelsList.map((hostel) => {
                    const isChecked = selectedHostels.includes(hostel.id)
                    return (
                      <label
                        key={hostel.id}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition bg-white ${
                          isChecked ? 'border-amber-500 font-bold text-amber-900' : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleHostel(hostel.id)}
                          className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>{hostel.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Auto issue credentials checkbox & Save Buttons */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoIssuePassword}
                  onChange={(e) => setAutoIssuePassword(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300"
                />
                <span>Generate/refresh login credentials for this account</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSaveRoles}
                  disabled={savingRoles}
                  className="btn btn-primary text-xs"
                >
                  {savingRoles ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                  Save Roles & Sync Keycloak
                </button>

                <button
                  type="button"
                  onClick={() => handleIssueCredentials(null)}
                  disabled={issuingCredentials}
                  className="btn btn-outline text-xs flex items-center gap-1.5"
                >
                  {issuingCredentials ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  <span>Issue / Reset Password Now</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. LOGIN & CREDENTIALS TAB ── */}
        {activeTab === 'credentials' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Login & Dashboard Credentials</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Manage Keycloak authentication credentials and direct workspace access for {detail.full_name || detail.email}.
              </p>
            </div>

            {/* Issued Credentials Highlight Card */}
            {issuedCredentials ? (
              <div className="p-5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/50 shadow-md space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500 text-white shadow-xs">
                      <Key size={16} />
                    </span>
                    <div>
                      <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                        Active Login Credentials Ready
                      </h4>
                      <p className="text-[11px] text-emerald-700">Synchronized with Keycloak identity provider</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Ready to Use
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Username / Email */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Email / Login ID
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 select-all text-xs">
                        {issuedCredentials.email || detail.email}
                      </span>
                      <button
                        onClick={() => handleCopy(issuedCredentials.email || detail.email, 'email')}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Copy Email"
                      >
                        {copiedKey === 'email' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Password
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-extrabold text-emerald-800 text-xs tracking-wider select-all">
                        {showPassword ? issuedCredentials.password : '••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 text-slate-400 hover:text-slate-700"
                          title={showPassword ? 'Hide' : 'Show'}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => handleCopy(issuedCredentials.password, 'pwd')}
                          className="p-1 text-slate-400 hover:text-slate-700"
                          title="Copy Password"
                        >
                          {copiedKey === 'pwd' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Target Workspace */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Assigned Workspace & Dashboard
                    </span>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded bg-[#0a2342] text-[#f5bd19]">
                          <Shield size={13} />
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">
                            {issuedCredentials.dashboard_name || 'Assigned Workspace'}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500">
                            Path: {issuedCredentials.dashboard_path || '/dashboard'}
                          </p>
                        </div>
                      </div>
                      <a
                        href={issuedCredentials.dashboard_path || '/dashboard'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        Preview <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Copy Complete Details Button */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      const text = `OCOC Campus Access Credentials\nUser: ${detail.full_name || detail.email}\nEmail: ${issuedCredentials.email || detail.email}\nPassword: ${issuedCredentials.password}\nRoles: ${(selectedRoles || []).join(', ') || 'USER'}\nDashboard: ${issuedCredentials.dashboard_name} (${window.location.origin}${issuedCredentials.dashboard_path})\nLogin URL: ${window.location.origin}/login`
                      handleCopy(text, 'all')
                    }}
                    className="btn btn-primary text-xs flex-1 flex items-center justify-center gap-2"
                  >
                    {copiedKey === 'all' ? (
                      <>
                        <Check size={14} className="text-emerald-200" />
                        <span>Copied All Credentials to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Complete Login Message</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-3">
                <Key size={32} className="mx-auto text-slate-400" />
                <h4 className="font-bold text-sm text-slate-700">No Credentials Generated in this Session</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click below to generate a new secure password and synchronize this account with Keycloak identity provider.
                </p>
              </div>
            )}

            {/* Quick Actions for Issuing / Resetting Password */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Generate / Reset Login Password
              </h4>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Optional custom password (leave blank to auto-generate)"
                  value={customPasswordInput}
                  onChange={(e) => setCustomPasswordInput(e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500"
                />
                <button
                  onClick={() => handleIssueCredentials(customPasswordInput ? customPasswordInput.trim() : null)}
                  disabled={issuingCredentials}
                  className="btn btn-primary text-xs"
                >
                  {issuingCredentials ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>{customPasswordInput ? 'Set Custom Password' : 'Auto-Generate Password'}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1 border-t border-slate-100">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>
                  Generates an 8+ character password compliant with Keycloak security policy and clears any pending account actions.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. EFFECTIVE PERMISSIONS TAB ── */}
        {activeTab === 'effective' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Effective Permissions Matrix</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Calculated permission tree showing all locations this user can enter or manage, including cascading inheritance from parent zones.
              </p>
            </div>

            {effectivePerms.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Layers size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">No Effective Location Permissions Calculated</p>
                <p className="text-[11px] text-slate-400 mt-1">Assign a location grant or role to grant access rights.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {effectivePerms.map((perm) => (
                  <div
                    key={perm.location_id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition flex items-start justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-amber-500 shrink-0" />
                        <span className="text-xs font-extrabold text-slate-800">{perm.location_name}</span>
                        <span className="text-[10px] text-slate-500 capitalize">({perm.location_type})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {perm.source === 'inherited' ? (
                          <span className="text-slate-500 flex items-center gap-1">
                            <Layers size={11} className="text-amber-500" /> Inherited from {perm.inherited_from_name}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <Check size={11} /> Explicit Grant
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {renderAccessBadge(perm.access_level)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 4. AUDIT HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Access Activity & Audit Log</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Immutable security logs tracking all role modifications, access grants, revocations, and expiry events.
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <History size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">No Access Audit Logs Recorded</p>
                <p className="text-[11px] text-slate-400 mt-1">Actions performed on this user will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white text-xs flex items-start justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 font-mono text-[11px]">
                          {log.operation}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-[11px] text-slate-500">
                          Actor: <span className="font-semibold text-slate-700">{log.actor_email || log.actor_id || 'System'}</span>
                        </span>
                      </div>
                      {(log.after_state || log.before_state) && (
                        <p className="text-[11px] text-slate-600">
                          {JSON.stringify(log.after_state || log.before_state)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Assign Access Modal ── */}
      <AssignAccessModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        user={user}
        locationTree={locationTree}
        onSuccess={() => {
          loadAllData()
          if (onUserUpdated) onUserUpdated()
        }}
      />

      {/* ── Extend / Edit Grant Modal ── */}
      {extendingGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="glass-panel p-6 w-full max-w-sm bg-white rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-800">Edit / Extend Access Expiry</h3>
              <button onClick={() => setExtendingGrant(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleExtendGrantSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Location
                </label>
                <input
                  type="text"
                  disabled
                  value={extendingGrant.location_name || extendingGrant.location_id}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  New Valid Until (Leave blank for Permanent)
                </label>
                <input
                  type="datetime-local"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendingGrant(null)}
                  className="btn btn-outline text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extendLoading}
                  className="btn btn-primary text-xs"
                >
                  {extendLoading ? <Loader2 size={14} className="animate-spin" /> : 'Update Expiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserAccessDetail
