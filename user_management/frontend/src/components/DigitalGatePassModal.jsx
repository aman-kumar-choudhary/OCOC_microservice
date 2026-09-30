import React from 'react'
import {
  ShieldCheck, Printer, X, Calendar, MapPin, Clock, User,
  CheckCircle2, AlertTriangle, Building, Phone, QrCode
} from 'lucide-react'
import dsvvLogo from '@/assets/Dsvv.png'

export const DigitalGatePassModal = ({ isOpen, onClose, passData }) => {
  if (!isOpen || !passData) return null

  const handlePrint = () => {
    window.print()
  }

  const startDate = passData.start_at ? new Date(passData.start_at) : new Date()
  const endDate = passData.end_at ? new Date(passData.end_at) : new Date()
  const now = new Date()
  const isActive = now >= startDate && now <= endDate
  const isExpired = now > endDate
  const isUpcoming = now < startDate

  const passId = passData.id ? `PASS-${passData.id.slice(0, 8).toUpperCase()}` : 'PASS-2026-X89'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fade-in no-print-backdrop">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-in">
        {/* Top Control Bar (Hidden during print) */}
        <div className="bg-[#0a2342] text-white px-6 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#f5bd19]" />
            <span className="text-xs font-bold uppercase tracking-wider">Official Campus Gate Pass</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition"
            >
              <Printer size={14} /> Print Pass
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
              aria-label="Close pass"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Pass Card */}
        <div className="p-6 sm:p-8 space-y-5 bg-gradient-to-b from-slate-50 to-white print:p-0 print:bg-white">
          {/* Institution Header */}
          <div className="flex items-center justify-between border-b-2 border-[#0a2342]/10 pb-4">
            <div className="flex items-center gap-3">
              <img src={dsvvLogo} alt="DSVV" className="h-12 w-12 object-contain" />
              <div>
                <h3 className="font-black text-sm text-[#0a2342] uppercase tracking-wide">
                  Dev Sanskriti Vishwavidyalaya
                </h3>
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">
                  One Card · One Campus (OCOC)
                </p>
                <p className="text-[10px] text-slate-500">Digital Gate Clearance Credential</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-black text-slate-800 block">{passId}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-1 ${
                isActive
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isExpired
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}>
                {isActive ? '● Active Pass' : isExpired ? 'Expired' : 'Upcoming'}
              </span>
            </div>
          </div>

          {/* Student Identity Information */}
          <div className="grid grid-cols-2 gap-3 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Student Name</span>
              <span className="font-extrabold text-slate-900 text-sm">{passData.student_name || 'Registered Student'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Leave Category</span>
              <span className="font-bold text-[#0a2342] text-sm">{passData.leave_type || 'Campus Pass'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Student ID / Roll No</span>
              <span className="font-mono font-bold text-slate-700">{passData.student_id || passData.user_id?.slice(0, 10) || 'STU-OCOC-2026'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Destination</span>
              <span className="font-bold text-slate-800 truncate block">{passData.destination || 'Authorized Destination'}</span>
            </div>
          </div>

          {/* Validity Time Window Box */}
          <div className="rounded-2xl border-2 border-dashed border-[#0a2342]/20 bg-amber-50/50 p-4 space-y-2 text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0a2342] block">
              Sanctioned Gate Movement Window
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-emerald-700 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Valid From:</span>
                  <span className="font-bold text-slate-900">{startDate.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-red-700 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Valid Until:</span>
                  <span className="font-bold text-slate-900">{endDate.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Barcode & QR Code Simulation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border border-slate-300 p-1 flex items-center justify-center bg-slate-50">
                <QrCode size={48} className="text-[#0a2342]" />
              </div>
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-slate-900 block">Instant Gate Verification</span>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Present your RFID Smart Card or face at Turnstile 1 or 2 for automated gate release.
                </p>
                <div className="pt-1 font-mono text-[9px] text-slate-400 tracking-wider">
                  SIG-SHA256: 8F2A90DC4B71EE
                </div>
              </div>
            </div>
            <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
              <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700">
                <CheckCircle2 size={14} /> Digitally Signed
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Hostel Warden &amp; Gate Authority</p>
              <p className="text-[9px] text-slate-400 mt-0.5">OCOC RBAC Verification Engine</p>
            </div>
          </div>

          {/* Emergency Notice */}
          <div className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-2">
            <Phone size={12} className="text-amber-600" />
            <span>Campus Security Control Room Helpline: <strong>+91-1334-261367</strong> · Gate 1 &amp; Gate 2</span>
          </div>
        </div>

        {/* Footer (Hidden during print) */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500 no-print">
          <span>Non-transferable digital pass</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DigitalGatePassModal
