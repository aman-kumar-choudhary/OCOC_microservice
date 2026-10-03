import React, { useState } from "react";
import {
  ArrowRight,
  BuildingOffice,
  CheckCircle,
  Cpu,
  FileText,
  Lock,
  MagnifyingGlass,
  Printer,
  ShieldCheck,
  ShieldWarning,
  UserCheck,
  Warning,
  X
} from "@phosphor-icons/react";

export const LegalModal = ({ isOpen, onClose, initialTab = "terms" }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fade-in no-print-backdrop">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="bg-[#0a2342] text-white px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f5bd19] text-[#0a2342] flex items-center justify-center font-black text-lg shadow-sm">
              O
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                OCOC Campus Governance & Compliance
              </h2>
              <p className="text-[11px] text-slate-300">
                Institutional Terms, Biometric Privacy & Security Protocols
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition"
              title="Print Policy Document"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & MagnifyingGlass */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                activeTab === "terms"
                  ? "bg-[#0a2342] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              <FileText size={14} /> Terms &amp; Conditions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("privacy")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                activeTab === "privacy"
                  ? "bg-[#0a2342] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              <Lock size={14} /> Biometric &amp; Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                activeTab === "security"
                  ? "bg-[#0a2342] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              <ShieldCheck size={14} /> ISO 27001 Security
            </button>
          </div>

          <div className="relative w-full sm:w-48">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="MagnifyingGlass policy..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19]"
            />
          </div>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          {/* Tab 1: Terms & Conditions */}
          {activeTab === "terms" && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-600">
                  Institutional Governance Document · Rev 2026.2
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Campus Terms &amp; Conditions of Use
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Governing all students, faculty, workers, security officers,
                  and visitors of the institution.
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#0a2342]" /> 1.
                  Digital Credential &amp; RFID Custody
                </h4>
                <p className="text-xs text-slate-600">
                  The OCOC smart card and digital credentials are institutional
                  property issued strictly for authorized personal
                  identification. Possession is strictly non-transferable.
                  Loaning, borrowing, duplicating, or tampering with an RFID
                  smart card or digital token constitutes an immediate
                  disciplinary violation leading to credential suspension and
                  formal review.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#0a2342]" /> 2.
                  Campus Leave &amp; Gate Pass Protocols
                </h4>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                  <li>
                    <strong>Application Legitimacy:</strong> All leave requests
                    (day pass, multi-day, medical) must be submitted truthfully
                    with accurate destinations and emergency contact info.
                  </li>
                  <li>
                    <strong>Mandatory Authorization:</strong> Unapproved drafts
                    grant zero departure rights. Turnstiles and guard consoles
                    will deny exit without an approved digital pass.
                  </li>
                  <li>
                    <strong>Active Gate Window:</strong> Passes are valid only
                    during designated start and end timestamps. Automated
                    turnstiles lock immediately upon pass expiration.
                  </li>
                  <li>
                    <strong>Curfew &amp; Overdue Alerts:</strong> Failure to tap
                    back into campus before pass expiry automatically flags a
                    Curfew Alert to the Warden, Campus Command, and emergency
                    contacts.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#0a2342]" /> 3.
                  Two-Step Verification (2-SV) at Gates
                </h4>
                <p className="text-xs text-slate-600">
                  Campus security guards operating the Guard Console are
                  empowered to perform 2-Step Verification (pairing RFID taps
                  with live camera facial recognition). Guards may inspect
                  student profile details and request physical verification if
                  an anomaly or alert is flagged.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Warning size={16} className="text-amber-600" /> 4.
                  Disciplinary Penalties
                </h4>
                <p className="text-xs text-slate-600">
                  Tailgating, perimeter evasion, unauthorized hostel departures,
                  or fraudulent leave applications result in progressive
                  sanctions: suspension of leave privileges, loss of hostel
                  residency, and referral to the University Disciplinary
                  Committee.
                </p>
              </section>
            </div>
          )}

          {/* Tab 2: Biometric & Privacy Policy */}
          {activeTab === "privacy" && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-extrabold tracking-wider uppercase text-emerald-700">
                  DPDP Act &amp; GDPR Compliant Privacy Framework
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Biometric Data &amp; Neural Vector Policy
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Technical specifications regarding facial biometric
                  processing, pgvector encryption, and data rights.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <Cpu size={16} className="text-emerald-700" /> Neural Vector
                  Mathematical Feature Storage
                </div>
                <p className="text-emerald-700 leading-relaxed">
                  OCOC utilizes the FRECO neural inference engine. We do NOT
                  store unencrypted raw camera feeds or public imagery. Only
                  high-dimensional mathematical vector embeddings (512-dimension
                  floating point arrays) are generated and stored in encrypted
                  PostgreSQL pgvector tables.
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck size={16} className="text-emerald-700" /> 1.
                  Explicit Purpose of Processing
                </h4>
                <p className="text-xs text-slate-600">
                  Biometric embeddings are processed strictly for campus
                  perimeter security, hostel curfew tracking, automated mess
                  verification, and contactless classroom attendance. Data is
                  never monetized, leased, or transmitted to third-party
                  commercial vendors.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Lock size={16} className="text-emerald-700" /> 2. Principle
                  of Least Privilege (RBAC)
                </h4>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                  <li>
                    <strong>Security Guards:</strong> View only real-time
                    pass/deny validation badges, student name, roll number, and
                    active leave window. They cannot export biometric vectors.
                  </li>
                  <li>
                    <strong>Wardens:</strong> View movement census and leave
                    requests for students assigned to their specific residential
                    blocks.
                  </li>
                  <li>
                    <strong>System Administrators:</strong> Audit system health
                    and access rules with zero direct access to raw biometric
                    representations.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BuildingOffice size={16} className="text-emerald-700" /> 3. Data
                  Retention &amp; Right to Erasure
                </h4>
                <p className="text-xs text-slate-600">
                  Biometric vectors are retained strictly for the duration of
                  active enrollment or campus employment. Upon graduation,
                  transfer, or retirement, all biometric embeddings are
                  permanently purged from the database in compliance with the
                  Right to Erasure.
                </p>
              </section>
            </div>
          )}

          {/* Tab 3: Security & ISO 27001 */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] font-extrabold tracking-wider uppercase text-blue-700">
                  Enterprise Security Controls &amp; Infrastructure
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Information Security &amp; Audit Architecture
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Alignment with ISO/IEC 27001 standards and institutional
                  cybersecurity policies.
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-700" /> 1.
                  End-to-End Cryptographic Security
                </h4>
                <p className="text-xs text-slate-600">
                  All traffic across microservices, turnstile controllers, and
                  client interfaces is protected with Transport Layer Security
                  (TLS 1.3). Tokens are signed with asymmetric RSA-256 keys
                  issued by Keycloak OpenID Connect. Sensitive credentials are
                  encrypted at rest with AES-GCM-256.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldWarning size={16} className="text-blue-700" /> 2.
                  Immutable Audit Trail
                </h4>
                <p className="text-xs text-slate-600">
                  Every privileged state change (leave approvals, RFID card
                  re-assignment, gate overrides, and role grants) is recorded in
                  an append-only, tamper-evident audit ledger with Actor ID,
                  timestamp, and source IP address.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Warning size={16} className="text-blue-700" /> 3.
                  Incident Escalation &amp; Support
                </h4>
                <p className="text-xs text-slate-600">
                  Suspected credential compromise or card loss must be reported
                  immediately to the Campus Security Control Room. Automated
                  card blacklisting propagates across turnstiles within 300
                  milliseconds.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>
              Campus Data Protection Officer:{" "}
              <a
                href="mailto:dpo@dsvv.ac.in"
                className="text-blue-600 underline"
              >
                dpo@dsvv.ac.in
              </a>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#0a2342] text-white font-bold text-xs hover:bg-[#12365f] transition shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>I Understand &amp; Close</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
