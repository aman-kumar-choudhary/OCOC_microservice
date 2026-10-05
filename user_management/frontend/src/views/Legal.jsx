import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  BuildingOffice,
  CheckCircle,
  Cpu,
  FileText,
  Lock,
  MagnifyingGlass,
  Medal,
  Printer,
  Question,
  ShieldCheck,
  ShieldWarning,
  UserCheck,
  Warning
} from "@phosphor-icons/react";

export default function Legal() {
  const location = useLocation();
  const isPrivacyInitial = location.pathname.includes("privacy");
  const [activeTab, setActiveTab] = useState(
    isPrivacyInitial ? "privacy" : "terms",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Top Navigation Header */}
      <header className="bg-[#0a2342] text-white border-b border-slate-700/50 sticky top-0 z-20 shadow-md no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f5bd19] text-[#0a2342] flex items-center justify-center font-black text-lg shadow-sm">
              O
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight leading-tight">
                One Card One Campus (OCOC)
              </h1>
              <p className="text-[11px] text-slate-300">
                Institutional Governance, Security &amp; Compliance Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={handlePrint}
              type="button"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition"
            >
              <Printer size={14} /> Print Policy
            </button>
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
            <Link
              to="/register"
              className="px-3 py-1.5 rounded-lg bg-[#f5bd19] text-[#0a2342] font-extrabold hover:bg-amber-400 transition-colors shadow-xs"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        {/* Navigation Tabs and Quick Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-3 no-print">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab("terms")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
                activeTab === "terms"
                  ? "bg-[#0a2342] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <FileText size={16} /> Terms of Campus Use
            </button>
            <button
              onClick={() => setActiveTab("privacy")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
                activeTab === "privacy"
                  ? "bg-[#0a2342] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Lock size={16} /> Biometric &amp; Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
                activeTab === "security"
                  ? "bg-[#0a2342] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <ShieldCheck size={16} /> ISO 27001 Security Controls
            </button>
            <button
              onClick={() => setActiveTab("cookies")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
                activeTab === "cookies"
                  ? "bg-[#0a2342] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Medal size={16} /> Session &amp; Cookies
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <MagnifyingGlass
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search policy clauses..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
            />
          </div>
        </div>

        {/* Tab 1: Terms & Conditions */}
        {activeTab === "terms" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-8 page-enter">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-xs font-extrabold tracking-wider uppercase text-amber-600">
                Institutional Regulation
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                Campus Terms &amp; Conditions of Use
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Policy Reference: DSVV-OCOC-POL-2026.01 · Applicable to
                Students, Faculty, Staff, Guards &amp; Visitors
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle size={18} className="text-[#0a2342]" /> 1. Digital
                Credential &amp; Smart RFID Card Custody
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The OCOC digital identity and physical RFID smart card remain
                institutional property issued solely for authorized personal
                identity and access control. Each card is non-transferable and
                tied uniquely to the individual's profile. Loaning, borrowing,
                cloning, or tampering with an RFID card is treated as a major
                disciplinary offence triggering immediate credential
                invalidation, card deactivation, and formal disciplinary
                proceedings.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle size={18} className="text-[#0a2342]" /> 2. Leave
                Management &amp; Gate Pass Protocols
              </h3>
              <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5 leading-relaxed">
                <li>
                  <strong>Application &amp; Accuracy:</strong> Students must
                  submit leave applications truthfully with valid destination
                  details and reachable emergency contacts. Submitting
                  fraudulent justifications constitutes gross misconduct.
                </li>
                <li>
                  <strong>Approval Authority:</strong> Leave passes are only
                  valid after official approval by the designated Hostel Warden
                  and/or Campus Authority. Unapproved drafts or pending requests
                  grant no gate departure rights.
                </li>
                <li>
                  <strong>Gate Validity Window:</strong> An approved leave pass
                  activates turnstile gate departure permissions strictly during
                  the sanctioned start and end timestamps. Gate security guards
                  and automated turnstiles will deny movement outside these
                  hours.
                </li>
                <li>
                  <strong>Overdue Returns:</strong> Failure to return to campus
                  before the leave pass expiration triggers an automated Curfew
                  Alert sent to the Warden, Campus Security Command, and student
                  emergency contacts.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle size={18} className="text-[#0a2342]" /> 3. Guard
                Console &amp; Verification Protocol
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Campus security guards operating the Guard Console have full
                authority to conduct two-step verification (2-SV) pairing RFID
                card scans with live camera-based face recognition. Guards are
                required to inspect student profiles, verify approved leave
                passes, and request supplementary physical identification if an
                anomaly or alert is flagged.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Warning size={18} className="text-amber-600" /> 4.
                Disciplinary Penalties &amp; Sanctions
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Violations of campus access rules, including tailgating,
                unauthorized perimeter crossings, unexcused absence from
                residential blocks, or evasion of gate logging, shall be subject
                to progressive disciplinary sanctions ranging from suspension of
                campus leave privileges to formal review by the Disciplinary
                Committee.
              </p>
            </section>
          </div>
        )}

        {/* Tab 2: Privacy Policy & Biometrics */}
        {activeTab === "privacy" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-8 animate-fade-in">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-xs font-extrabold tracking-wider uppercase text-emerald-700">
                Data Protection Framework
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                Privacy &amp; Biometric Neural Vector Policy
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Compliance with Digital Personal Data Protection (DPDP) Act
                2023, GDPR, and ISO/IEC 27701
              </p>
            </div>

            {/* Neural Vector Callout Box */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                <Cpu size={18} className="text-emerald-700" /> Neural Vector
                Mathematical Feature Storage (FRECO)
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                The OCOC platform uses the FRECO ONNX neural inference engine to
                generate mathematical embeddings (normalized 512-dimension
                vector representations) from face images. We do not store or
                broadcast raw biometric surveillance video. Vector
                representations are stored in encrypted PostgreSQL pgvector
                tables and cannot be reversely reconstructed into photographic
                likenesses by third parties.
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-700" /> 1.
                Biometric Data Collection &amp; Explicit Consent
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                By registering on the OCOC platform, individuals provide
                explicit, informed consent for biometric facial enrollment.
                Biometric vectors are used exclusively for campus turnstile
                clearance, hostel roll-call, mess dining hall verification, and
                2-step guard validation. Biometric data is never sold, leased,
                or transferred to third-party commercial brokers.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock size={18} className="text-emerald-700" /> 2. Principle of
                Least Privilege &amp; Role-Based Separation
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Access to student movement data and identity profiles is
                compartmentalized strictly under Role-Based Access Control
                (RBAC):
              </p>
              <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5 leading-relaxed">
                <li>
                  <strong>Security Guards:</strong> Can only view real-time gate
                  pass validation badges, student name, roll number, hostel, and
                  active leave windows necessary for gate decisions.
                </li>
                <li>
                  <strong>Hostel Wardens:</strong> Can view residential
                  headcount and leave requests for students assigned to their
                  specific assigned hostel blocks.
                </li>
                <li>
                  <strong>Administrators:</strong> Audit access control rules
                  and system health without direct access to raw biometric
                  vectors.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BuildingOffice size={18} className="text-emerald-700" /> 3. Data
                Retention &amp; Right to Erasure
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Biometric credentials and movement logs are retained for the
                duration of the student or staff member's active enrollment or
                employment, plus standard statutory archival periods. Upon
                graduation or formal departure, biometric feature vectors are
                permanently purged from the facial recognition database.
              </p>
            </section>
          </div>
        )}

        {/* Tab 3: ISO 27001 Security Controls */}
        {activeTab === "security" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-8 animate-fade-in">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-xs font-extrabold tracking-wider uppercase text-blue-700">
                Cybersecurity Architecture
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                Information Security Controls &amp; Audit Architecture
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Alignment with ISO/IEC 27001:2022 Information Security
                Management Standards
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-700" /> 1.
                End-to-End Cryptography
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                All client-to-backend traffic, inter-service API calls, and IoT
                turnstile communications are encrypted via Transport Layer
                Security (TLS 1.3). Tokens are signed with RSA-256 keys issued
                by Keycloak OpenID Connect. Sensitive credentials and biometric
                vectors are encrypted at rest with AES-GCM-256.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldWarning size={18} className="text-blue-700" /> 2. Immutable
                Audit Trail
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every state-modifying action (leave approvals, RFID card
                issuance, role adjustments, gate manual overrides) generates an
                append-only, tamper-evident log in the `audit_logs` table
                recording Actor ID, operation type, before/after JSON snapshots,
                and client IP address.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Warning size={18} className="text-blue-700" /> 3.
                Incident Management &amp; Hotline
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Any suspected breach, lost RFID smart card, or credential
                compromise must be reported immediately to the Campus Security
                Control Room. Lost cards are blacklisted across all turnstiles
                within 300 milliseconds.
              </p>
            </section>
          </div>
        )}

        {/* Tab 4: Session & Cookies */}
        {activeTab === "cookies" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-8 animate-fade-in">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-xs font-extrabold tracking-wider uppercase text-purple-700">
                Client Telemetry
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                Session &amp; Token Telemetry Policy
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Storage, lifecycle, and privacy practices regarding
                authentication tokens.
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle size={18} className="text-purple-700" /> 1.
                Ephemeral Session Storage
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                OCOC does NOT use third-party advertising cookies or cross-site
                tracking beacons. Authenticated user sessions are stored
                strictly in `sessionStorage` (cleared automatically upon tab
                closure) using short-lived JWT access tokens and secure token
                refresh rotation.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle size={18} className="text-purple-700" /> 2.
                Automatic Inactivity Watchdog
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                For administrative, warden, and guard workstations, the platform
                incorporates an automatic inactivity watchdog that prompts the
                user and locks active permissions after extended idle duration
                to safeguard campus assets.
              </p>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 no-print">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>
              OCOC Campus Identity Platform · Enterprise Grade Governance &amp;
              Security
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:underline text-slate-600">
              Sign In
            </Link>
            <Link to="/register" className="hover:underline text-slate-600">
              Register
            </Link>
            <a
              href="mailto:dpo@dsvv.ac.in"
              className="hover:underline text-slate-600"
            >
              Contact DPO
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
