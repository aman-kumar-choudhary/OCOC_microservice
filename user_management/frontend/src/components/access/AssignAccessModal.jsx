import React, { useState, useEffect } from 'react'
import {
  X, MapPin, Shield, Calendar, Clock, ChevronRight, Check,
  AlertCircle, Loader2, Sparkles, Building2, Layers
} from 'lucide-react'
import accessService from '@/services/accessService'

const ACCESS_LEVEL_INFO = {
  ENTRY: {
    label: 'Entry Access',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    desc: 'Authorized to tap card/face for RFID gate entry & door unlocks'
  },
  VIEW: {
    label: 'View Only',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    desc: 'Read-only access to location status, occupancy, and public areas'
  },
  MANAGE: {
    label: 'Manager',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    desc: 'Operate area, approve student movement/leaves, manage passes'
  },
  ADMIN: {
    label: 'Admin',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    desc: 'Full administrative control over devices, rules, and sub-locations'
  }
}

export const AssignAccessModal = ({
  isOpen,
  onClose,
  user,
  locations = [],
  locationTree = [],
  onSuccess
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [accessLevel, setAccessLevel] = useState('ENTRY')
  const [isTemporary, setIsTemporary] = useState(false)
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locationSearch, setLocationSearch] = useState('')

  // Flattened tree with indent & paths
  const [flattenedLocations, setFlattenedLocations] = useState([])

  useEffect(() => {
    if (!isOpen) {
      // reset form
      setSelectedLocationId('')
      setAccessLevel('ENTRY')
      setIsTemporary(false)
      setValidFrom('')
      setValidUntil('')
      setReason('')
      setError('')
      setLocationSearch('')
      return
    }

    // Build flattened location list from locationTree or flat locations
    if (locationTree && locationTree.length > 0) {
      const list = []
      const walk = (nodes, depth = 0, path = '') => {
        nodes.forEach(node => {
          const currentPath = path ? `${path} > ${node.name}` : node.name
          list.push({
            id: node.id,
            name: node.name,
            type: node.type,
            depth,
            path: currentPath,
            childrenCount: node.children ? node.children.length : 0
          })
          if (node.children && node.children.length > 0) {
            walk(node.children, depth + 1, currentPath)
          }
        })
      }
      walk(locationTree)
      setFlattenedLocations(list)
    } else if (locations && locations.length > 0) {
      setFlattenedLocations(
        locations.map(loc => ({
          id: loc.id,
          name: loc.name,
          type: loc.type,
          depth: 0,
          path: loc.name,
          childrenCount: 0
        }))
      )
    }
  }, [isOpen, locationTree, locations])

  if (!isOpen || !user) return null

  // Quick preset helper for temporary valid_until
  const applyPreset = (hours) => {
    setIsTemporary(true)
    const now = new Date()
    const fromStr = now.toISOString().slice(0, 16)
    setValidFrom(fromStr)

    const until = new Date(now.getTime() + hours * 3600 * 1000)
    setValidUntil(until.toISOString().slice(0, 16))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedLocationId) {
      setError('Please select a location.')
      return
    }
    if (isTemporary && !validUntil) {
      setError('Please provide an expiration date/time for temporary access.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await accessService.createLocationGrant({
        user_id: user.id,
        location_id: selectedLocationId,
        access_level: accessLevel,
        valid_from: isTemporary && validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: isTemporary && validUntil ? new Date(validUntil).toISOString() : null,
        reason: reason.trim() || 'Assigned via Access Management console'
      })

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to grant access.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const filteredLocations = flattenedLocations.filter(loc =>
    loc.path.toLowerCase().includes(locationSearch.toLowerCase())
  )

  const selectedLoc = flattenedLocations.find(l => l.id === selectedLocationId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0a2342]/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 glass-panel p-0 w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--color-navy)]">Assign Location Access</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Grant facility, building, hostel or gate access for <span className="font-semibold text-slate-800">{user.full_name || user.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* User Preview Mini-bar */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#0a2342] text-white flex items-center justify-center font-bold text-xs">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-800">{user.full_name || 'Unnamed User'}</p>
                <p className="text-[var(--text-muted)]">{user.email} • ID: {user.university_id || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-slate-200 text-slate-700">
                {user.user_type || 'User'}
              </span>
            </div>
          </div>

          {/* Location Selector */}
          <div>
            <label className="form-label flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span>Location / Facility <span className="text-rose-500">*</span></span>
              {selectedLoc && (
                <span className="text-[11px] font-normal text-amber-700 flex items-center gap-1">
                  <Sparkles size={12} /> Cascades to all child areas
                </span>
              )}
            </label>

            {/* Quick search input */}
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Type to filter locations (e.g. Hostel, Gate, Library)..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="w-full text-xs py-2 pl-8 pr-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <MapPin size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>

            {/* Select Dropdown */}
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              required
              size={Math.min(6, Math.max(3, filteredLocations.length + 1))}
              className="w-full rounded-xl border border-[var(--border-light)] p-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white"
            >
              <option value="" disabled>-- Select a target location --</option>
              {filteredLocations.map((loc) => (
                <option key={loc.id} value={loc.id} className="py-1 px-2">
                  {'\u00A0\u00A0'.repeat(loc.depth)}
                  {loc.depth > 0 ? '↳ ' : '🏛 '}
                  {loc.name} ({loc.type}) {loc.childrenCount > 0 ? `[+${loc.childrenCount} areas]` : ''}
                </option>
              ))}
            </select>

            {selectedLoc && (
              <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                <ChevronRight size={13} className="text-amber-500 shrink-0" />
                Selected Path: <span className="font-semibold text-slate-700">{selectedLoc.path}</span>
              </p>
            )}
          </div>

          {/* Access Level Selector */}
          <div>
            <label className="form-label text-xs font-bold text-slate-700 mb-1.5 block">
              Access Level <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(ACCESS_LEVEL_INFO).map(([key, info]) => {
                const isSelected = accessLevel === key
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setAccessLevel(key)}
                    className={`text-left p-3 rounded-xl border transition relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold ${info.badge}`}>
                          {key}
                        </span>
                        {info.label}
                      </span>
                      {isSelected && <Check size={16} className="text-amber-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                      {info.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grant Duration / Validity */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer">
                <Clock size={15} className="text-slate-600" />
                Access Duration
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsTemporary(false)}
                  className={`px-3 py-1 rounded-lg font-bold border transition ${
                    !isTemporary
                      ? 'bg-white border-amber-500 text-slate-800 shadow-sm'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Permanent
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTemporary(true)
                    if (!validUntil) applyPreset(24)
                  }}
                  className={`px-3 py-1 rounded-lg font-bold border transition ${
                    isTemporary
                      ? 'bg-white border-amber-500 text-slate-800 shadow-sm'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Temporary / Expiring
                </button>
              </div>
            </div>

            {isTemporary && (
              <div className="space-y-3 pt-2 border-t border-slate-200 animate-fade-in">
                {/* Presets */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] text-slate-500 mr-1 font-semibold">Quick Presets:</span>
                  {[
                    { label: '+4 Hours', hours: 4 },
                    { label: '+24 Hours', hours: 24 },
                    { label: '+7 Days', hours: 168 },
                    { label: '+30 Days', hours: 720 },
                    { label: '+1 Semester (120d)', hours: 2880 }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset.hours)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300 transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Valid From (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Valid Until (Expiration) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      required={isTemporary}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="form-label text-xs font-bold text-slate-700 mb-1 block">
              Administrative Reason / Reference Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Lab internship semester 4, Guest faculty hostel access, Special project pass"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-[var(--border-light)] bg-white focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-light)] bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-outline text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !selectedLocationId}
            className="btn btn-primary text-xs"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            Grant Access
          </button>
        </div>
      </div>
    </div>
  )
}

export default AssignAccessModal
