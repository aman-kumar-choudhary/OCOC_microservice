import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { roleDashboardPath, isAuthorizedForRoute } from "@/utils/roleDashboard";
import dsvvLogo from "@/assets/Dsvv.png";
import LegalModal from "@/components/LegalModal";
import {
  ChartLineUp,
  ChartBar,
  CreditCard,
  SquaresFour,
  SignOut,
  List,
  ShieldWarning,
  UserPlus,
  Users,
  X,
  UserFocus,
  CaretDown,
  Envelope,
  Lock,
  Shield,
  House,
  HardDrives,
  CalendarDots,
  ShieldCheck,
  Clock,
  Key,
  ArrowSquareOut,
  FileText,
  Cpu,
  Warning,
} from "@phosphor-icons/react";
export const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const { user, roles, email, fullName, hasRole, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSecurityMenuOpen, setIsSecurityMenuOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState("terms");

  // Inactivity watchdog (15 minutes threshold, 60s warning)
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleSecondsRemaining, setIdleSecondsRemaining] = useState(60);
  const idleTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const userInitial = fullName?.charAt(0).toUpperCase() || email?.charAt(0).toUpperCase() || "A";
  const userRoles = roles
    .filter((role) => !role.startsWith("default-"))
    .slice(0, 3);

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: SquaresFour },
    { name: "Security Command", path: "/security-admin", icon: ShieldCheck },
    { name: "Guard Console", path: "/guard", icon: Shield },
    { name: "Access Control", path: "/access", icon: Lock },
    { name: "Hostel Management", path: "/hostel", icon: House },
    { name: "Leave Management", path: "/leave", icon: CalendarDots },
    { name: "RFID Cards", path: "/rfid", icon: CreditCard },
    { name: "Face Lab", path: "/face-recognition", icon: UserFocus },
    { name: "Auth Monitor", path: "/face-auth-log", icon: ShieldWarning },
    { name: "User Directory", path: "/users", icon: Users },
    { name: "Onboard Person", path: "/onboarding", icon: UserPlus },
    { name: "Device Registry", path: "/devices", icon: HardDrives },
    { name: "Analytics", path: "/analytics", icon: ChartBar },
    { name: "Audit Logs", path: "/audit", icon: FileText },
  ];

  const filteredNavItems = navItems.filter((item) =>
    isAuthorizedForRoute(item.path, roles),
  );

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    setIsSecurityMenuOpen(false);
    await logout();
    navigate("/login");
  };

  const openLegalModalWithTab = (tab) => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
    setIsSecurityMenuOpen(false);
  };

  // Idle timeout watchdog
  const resetIdleTimer = () => {
    if (showIdleWarning) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(
      () => {
        setShowIdleWarning(true);
        setIdleSecondsRemaining(60);
      },
      15 * 60 * 1000,
    ); // 15 minutes of inactivity
  };

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handleUserActivity = () => resetIdleTimer();

    events.forEach((ev) =>
      window.addEventListener(ev, handleUserActivity, { passive: true }),
    );
    resetIdleTimer();

    return () => {
      events.forEach((ev) =>
        window.removeEventListener(ev, handleUserActivity),
      );
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [showIdleWarning]);

  // Countdown timer when idle warning is visible
  useEffect(() => {
    if (showIdleWarning) {
      countdownIntervalRef.current = setInterval(() => {
        setIdleSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    }
    return () => {
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, [showIdleWarning]);

  const handleStayActive = () => {
    setShowIdleWarning(false);
    resetIdleTimer();
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest("[data-profile-menu]")) {
        setIsProfileMenuOpen(false);
      }
      if (!e.target.closest("[data-security-menu]")) {
        setIsSecurityMenuOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] lg:flex flex-col">
      <div className="flex-1 lg:flex">
        {/* Mobile backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-[#0a2342]/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col bg-gradient-to-b from-[#06182e] via-[#0a2342] to-[#071d38] text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-24 items-center justify-between border-b border-white/10 px-5 bg-black/10">
            <Link
              to={roleDashboardPath(roles)}
              className="flex items-center gap-3 text-white no-underline group"
              aria-label="DSVV dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <img
                src={dsvvLogo}
                alt="Dev Sanskriti Vishwavidyalaya"
                className="h-[68px] w-[68px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform duration-200 group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-sm tracking-wide text-white leading-tight">
                  DSVV · OCOC
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#f5bd19] mt-0.5">
                  Campus Platform
                </span>
              </div>
            </Link>
            <button
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition lg:hidden icon-touch"
              aria-label="Close navigation"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          <div className="px-5 pt-5 pb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-400/80">
            <span>Workspace Modules</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
              {filteredNavItems.length}
            </span>
          </div>

          <nav
            className="flex-1 space-y-1 px-3 py-3 overflow-y-auto"
            aria-label="Primary navigation"
          >
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all duration-150 ${
                      isActive
                        ? "!bg-gradient-to-r !from-[#f5bd19] !to-[#ebb110] !text-[#0a2342] shadow-[0_4px_14px_rgba(245,189,25,0.3)] font-black"
                        : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={19}
                        weight={isActive ? "fill" : "bold"}
                        className="transition-transform duration-200 group-hover:scale-110"
                      />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Quick Legal & Security links inside sidebar */}
          <div className="border-t border-white/10 p-3 space-y-1 text-xs bg-black/10">
            <button
              type="button"
              onClick={() => openLegalModalWithTab("terms")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition font-semibold"
            >
              <FileText size={15} weight="bold" className="text-[#f5bd19]" />
              <span>Terms of Campus Use</span>
            </button>
            <button
              type="button"
              onClick={() => openLegalModalWithTab("privacy")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition font-semibold"
            >
              <Lock size={15} weight="bold" className="text-emerald-400" />
              <span>Biometric Privacy Policy</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            {/* Sticky Header */}
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md lg:px-8 shadow-[0_1px_3px_rgba(10,35,66,0.03)]">
              <div className="flex items-center gap-3.5">
                <button
                  className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 bg-white text-[#0a2342] shadow-xs hover:bg-slate-50 transition lg:hidden icon-touch"
                  aria-label="Open navigation"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <List size={22} weight="bold" />
                </button>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f5bd19]/15 text-[#7b5600] text-[11px] font-black uppercase tracking-wider">
                      <Shield size={13} weight="fill" className="text-[#d99e00]" /> OCOC Platform
                    </span>
                  </div>
                  <h2 className="font-display text-base font-extrabold text-[var(--text-main)] sm:text-lg tracking-tight">
                    Campus Identity &amp; Access Control
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Session Security Indicator Pill */}
                <div className="relative" data-security-menu>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSecurityMenuOpen(!isSecurityMenuOpen);
                    }}
                    className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200/90 bg-white text-xs font-bold text-slate-700 hover:border-slate-300 shadow-xs transition hover:bg-slate-50"
                    title="View Session Security Information"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <ShieldCheck size={16} weight="fill" className="text-emerald-600" />
                    <span>TLS 1.3 Active</span>
                  </button>

                  {/* Security Popover */}
                  {isSecurityMenuOpen && (
                    <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl text-slate-800 text-xs space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <ShieldCheck size={17} weight="fill" className="text-emerald-600" />
                          <span>Session Security Status</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                          Verified
                        </span>
                      </div>

                      <div className="space-y-2 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">
                            Authentication:
                          </span>
                          <span className="font-semibold text-slate-800">
                            Keycloak OIDC JWT
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">
                            Transport Layer:
                          </span>
                          <span className="font-semibold text-slate-800">
                            TLS 1.3 (Encrypted)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">
                            Database Encryption:
                          </span>
                          <span className="font-semibold text-slate-800">
                            AES-256 (At rest)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">
                            Idle Protection:
                          </span>
                          <span className="font-semibold text-emerald-700">
                            15 min Inactivity Watchdog
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => openLegalModalWithTab("security")}
                          className="w-full text-left font-bold text-[#0a2342] hover:underline flex items-center justify-between py-1"
                        >
                          <span>Review ISO 27001 Controls</span>
                          <ArrowSquareOut size={13} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openLegalModalWithTab("privacy")}
                          className="w-full text-left font-bold text-[#0a2342] hover:underline flex items-center justify-between py-1"
                        >
                          <span>Biometric Privacy &amp; Vector Info</span>
                          <ArrowSquareOut size={13} weight="bold" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Profile Menu */}
                <div className="relative" data-profile-menu>
                  <button
                    className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-white p-1 pr-2.5 text-[#0a2342] shadow-xs transition hover:border-[#f5bd19] hover:shadow-sm"
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Open account menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsProfileMenuOpen(!isProfileMenuOpen);
                    }}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-tr from-[#0a2342] to-[#163a66] text-sm font-black text-[#f5bd19] shadow-xs">
                      {userInitial}
                    </span>
                    <CaretDown
                      size={14}
                      weight="bold"
                      className={`hidden text-muted sm:block transition-transform duration-200 ${
                        isProfileMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isProfileMenuOpen && (
                    <div
                      className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-72 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 text-[var(--text-main)] shadow-[0_20px_48px_rgba(10,35,66,0.18)]"
                      role="menu"
                    >
                      <div className="rounded-xl bg-gradient-to-r from-[#06182e] to-[#0a2342] px-4 py-4 text-white shadow-xs">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f5bd19] font-black text-[#0a2342] shadow-xs">
                            {userInitial}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">
                              {fullName || email || "Administrator"}
                            </p>
                            <p className="truncate text-xs text-slate-300">
                              {email || "Verified Session"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="px-3 py-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                          <Envelope size={15} weight="bold" /> Account identity
                        </div>
                        <p className="mt-1.5 break-all text-sm font-bold text-slate-800">
                          {fullName ? `${fullName} (${email || "Local"})` : (email || "Administrator")}
                        </p>
                        {userRoles.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {userRoles.map((role) => (
                              <span
                                key={role}
                                className="rounded-full bg-[#f5bd19]/15 border border-[#f5bd19]/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#7b5600]"
                              >
                                {role.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100 px-3 py-2 space-y-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            openLegalModalWithTab("terms");
                          }}
                          className="w-full text-left py-1.5 text-slate-600 hover:text-slate-900 font-semibold flex items-center justify-between"
                        >
                          <span>Terms &amp; Campus Rules</span>
                          <ArrowSquareOut size={13} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            openLegalModalWithTab("privacy");
                          }}
                          className="w-full text-left py-1.5 text-slate-600 hover:text-slate-900 font-semibold flex items-center justify-between"
                        >
                          <span>Biometric Data Policy</span>
                          <ArrowSquareOut size={13} weight="bold" />
                        </button>
                      </div>

                      <button
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 border-t border-slate-100"
                        role="menuitem"
                        onClick={handleLogout}
                      >
                        <SignOut size={16} weight="bold" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Page Content */}
            <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8 page-enter">
              {children}
            </div>
          </div>

          {/* Institutional Compliance & Governance Footer */}
          <footer className="mt-12 border-t border-slate-200/80 bg-white/90 py-6 text-xs text-slate-500 backdrop-blur-xs">
            <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} weight="fill" className="text-emerald-600" />
                  <span className="font-extrabold text-slate-800">
                    Dev Sanskriti Vishwavidyalaya · OCOC
                  </span>
                </div>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="text-[11px] text-slate-500">
                  ISO/IEC 27001 Aligned · DPDP Act Compliant · v2.4 Enterprise
                  Release
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => openLegalModalWithTab("terms")}
                  className="hover:text-slate-900 hover:underline font-medium"
                >
                  Terms &amp; Conditions
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => openLegalModalWithTab("privacy")}
                  className="hover:text-slate-900 hover:underline font-medium"
                >
                  Biometric &amp; Privacy Policy
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => openLegalModalWithTab("security")}
                  className="hover:text-slate-900 hover:underline font-medium"
                >
                  Security Controls
                </button>
                <span>·</span>
                <Link
                  to="/terms"
                  className="hover:text-slate-900 hover:underline font-medium"
                >
                  Portal View
                </Link>
                <span>·</span>
                <a
                  href="mailto:dpo@dsvv.ac.in"
                  className="hover:text-slate-900 hover:underline font-medium"
                >
                  Contact DPO
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Interactive Legal Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

      {/* Idle Session Warning Modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-amber-200 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="p-2 rounded-xl bg-amber-100">
                <Warning size={24} weight="fill" className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Session Security Notice
                </h3>
                <p className="text-xs text-slate-500">
                  Inactivity timeout protocol
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your workstation has been idle for 15 minutes. In compliance with
              campus security policy, your session will automatically terminate
              in:
            </p>

            <div className="text-center py-2">
              <span className="font-mono text-3xl font-black text-amber-600">
                00:{String(idleSecondsRemaining).padStart(2, "0")}
              </span>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 transition"
              >
                Sign Out Now
              </button>
              <button
                type="button"
                onClick={handleStayActive}
                className="flex-1 py-2.5 rounded-xl bg-[#0a2342] text-white font-bold text-xs hover:bg-[#12365f] transition shadow-xs"
              >
                Keep Session Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
