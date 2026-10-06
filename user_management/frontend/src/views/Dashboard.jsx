import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dashboardService from "@/services/dashboardService";
import {
  ArrowRight,
  ArrowsClockwise,
  ChartBar,
  CreditCard,
  ShieldCheck,
  SpinnerGap,
  TrendUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users
} from "@phosphor-icons/react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useAuth } from "@/context/AuthContext";
import { getHumanGreeting } from "@/utils/greetings";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, roles, fullName } = useAuth();
  const displayName = fullName || user?.name || user?.preferred_username || "Administrator";
  const greeting = getHumanGreeting(displayName, roles || ["ADMIN"]);

  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Animated counters
  const [animatedStats, setAnimatedStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    rfid: 0,
  });
  const animRef = useRef(animatedStats);
  animRef.current = animatedStats;

  const animateTo = (key, target) => {
    const duration = 800;
    const start = animRef.current[key];
    const diff = target - start;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedStats((prev) => ({
        ...prev,
        [key]: Math.round(start + diff * eased),
      }));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!overview) return;
    animateTo("total", overview.total_users);
    animateTo("active", overview.active_users);
    animateTo("suspended", overview.suspended_users);
    animateTo("rfid", overview.rfid_active);
  }, [overview]);

  const personas = useMemo(() => {
    if (!overview) return [];
    const total = Math.max(overview.total_users, 1);
    return [
      {
        label: "Students",
        value: overview.students,
        color: "bg-[#f5bd19]",
        text: "text-[#0a2342]",
      },
      {
        label: "Faculty",
        value: overview.faculty,
        color: "bg-sky-500",
        text: "text-sky-700",
      },
      {
        label: "Staff",
        value: overview.workers,
        color: "bg-emerald-500",
        text: "text-emerald-700",
      },
      {
        label: "Visitors",
        value: overview.visitors,
        color: "bg-violet-500",
        text: "text-violet-700",
      },
    ].map((p) => ({ ...p, percent: Math.round((p.value / total) * 100) }));
  }, [overview]);

  const trendChartData = useMemo(() => {
    const trend = analytics?.onboarding_trend ?? [];
    const labels = trend.length
      ? trend.map((t) => {
          const d = new Date(t.date);
          return d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          });
        })
      : Array.from({ length: 14 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          return d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          });
        });
    const values = trend.length
      ? trend.map((t) => t.count)
      : Array(14).fill(0);

    return {
      labels,
      datasets: [
        {
          label: "New Registrations",
          data: values,
          borderColor: "#f5bd19",
          backgroundColor: "rgba(245,189,25,0.12)",
          borderWidth: 2.5,
          fill: true,
          tension: 0.45,
          pointRadius: 3,
          pointBackgroundColor: "#d99e00",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [analytics]);

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0a2342",
        titleColor: "#f5bd19",
        bodyColor: "#fff",
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#607087", font: { size: 11 }, maxTicksLimit: 7 },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(220,227,236,0.5)" },
        ticks: { color: "#607087", font: { size: 11 }, precision: 0 },
        border: { display: false },
      },
    },
  };

  const loadOverview = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [ov, an] = await Promise.allSettled([
        dashboardService.getOverview(),
        dashboardService.getAnalytics(),
      ]);
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (an.status === "fulfilled") setAnalytics(an.value);
      if (ov.status === "rejected") throw ov.reason;
    } catch {
      setError("We could not load the latest campus access data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  return (
    <section className="space-y-6 page-enter">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#06182e] via-[#0a2342] to-[#12365f] text-white shadow-xl border border-white/10">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-[#f5bd19]/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />
        
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#f5bd19] backdrop-blur-sm border border-white/10">
                <ShieldCheck size={16} weight="fill" /> Campus Access Command Centre
              </div>
              <h1 className="font-display text-2xl font-black tracking-tight sm:text-4xl text-white flex items-center gap-2">
                {greeting.greeting}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                {greeting.message}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn btn-primary shadow-lg shadow-amber-500/20"
                onClick={() => navigate("/onboarding")}
              >
                <UserPlus size={18} weight="bold" /> Onboard Identity
              </button>
              <button
                className="btn border border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-xs transition"
                onClick={() => navigate("/users")}
              >
                Browse Directory <ArrowRight size={17} weight="bold" className="icon-arrow" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="grid min-h-[380px] place-items-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col items-center gap-3 text-muted">
            <SpinnerGap className="animate-spin text-[#f5bd19]" size={36} />
            <span className="text-sm font-bold text-slate-700">
              Synchronizing campus identity metrics…
            </span>
          </div>
        </div>
      ) : error ? (
        <div className="app-panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between border-red-200 bg-red-50/50">
          <div>
            <h2 className="text-lg font-black text-red-900">Dashboard Unavailable</h2>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
          <button className="btn btn-primary" onClick={loadOverview}>
            <ArrowsClockwise size={17} /> Retry Connection
          </button>
        </div>
      ) : overview ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {/* Card 1: Total People */}
            <article className="app-panel group relative overflow-hidden p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default border-slate-200/80">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0a2342] to-[#163a66]" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Total Identities
                  </p>
                  <p className="mt-3 font-display text-3xl sm:text-4xl font-black text-slate-900 tabular-nums tracking-tight">
                    {animatedStats.total.toLocaleString()}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0a2342]/10 text-[#0a2342] shadow-xs group-hover:scale-110 transition-transform">
                  <Users size={24} weight="duotone" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Active directory records</span>
              </div>
            </article>

            {/* Card 2: Active Accounts */}
            <article className="app-panel group relative overflow-hidden p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default border-slate-200/80">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Active Accounts
                  </p>
                  <p className="mt-3 font-display text-3xl sm:text-4xl font-black text-emerald-700 tabular-nums tracking-tight">
                    {animatedStats.active.toLocaleString()}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-xs group-hover:scale-110 transition-transform">
                  <UserCheck size={24} weight="duotone" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100 text-xs font-bold text-emerald-700">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Authorized for campus entry</span>
              </div>
            </article>

            {/* Card 3: Suspended Accounts */}
            <article className="app-panel group relative overflow-hidden p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default border-slate-200/80">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Suspended Accounts
                  </p>
                  <p className="mt-3 font-display text-3xl sm:text-4xl font-black text-amber-700 tabular-nums tracking-tight">
                    {animatedStats.suspended.toLocaleString()}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 shadow-xs group-hover:scale-110 transition-transform">
                  <UserMinus size={24} weight="duotone" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100 text-xs font-semibold text-amber-800">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Flagged / pending review</span>
              </div>
            </article>

            {/* Card 4: Active RFID Cards */}
            <article className="app-panel group relative overflow-hidden p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default border-slate-200/80">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#f5bd19] to-amber-500" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Active RFID Badges
                  </p>
                  <p className="mt-3 font-display text-3xl sm:text-4xl font-black text-slate-900 tabular-nums tracking-tight">
                    {animatedStats.rfid.toLocaleString()}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f5bd19]/20 text-[#0a2342] shadow-xs group-hover:scale-110 transition-transform">
                  <CreditCard size={24} weight="duotone" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-600">
                <span className="inline-block w-2 h-2 rounded-full bg-[#f5bd19]"></span>
                <span>Physical contactless credentials</span>
              </div>
            </article>
          </div>

          {/* Activity Chart + Population */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            {/* Trend Chart */}
            <section className="app-panel p-6 xl:col-span-3 border-slate-200/80">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <TrendUp size={18} weight="bold" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-slate-900">
                        Daily Registration Activity
                      </h2>
                      <p className="text-xs text-slate-500">
                        New identity onboarding events over the last 14 days
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0a2342] hover:text-[#d99e00] px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
                  onClick={() => navigate("/analytics")}
                >
                  Full Analytics <ArrowRight size={14} weight="bold" className="icon-arrow" />
                </button>
              </div>
              <div className="h-64 pt-2">
                <Line data={trendChartData} options={trendChartOptions} />
              </div>
            </section>

            {/* Campus Population + RFID Health */}
            <div className="xl:col-span-2 flex flex-col gap-6">
              <section className="app-panel p-6 flex-1 border-slate-200/80">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      Campus Population
                    </h2>
                    <p className="text-xs text-slate-500">
                      Directory persona breakdown
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-black text-slate-800">
                    {overview.total_users} Total
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  {personas.map((persona) => (
                    <div key={persona.label}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{persona.label}</span>
                        <span className={`font-black ${persona.text}`}>
                          {persona.value}{" "}
                          <span className="font-semibold text-slate-400">
                            ({persona.percent}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${persona.color}`}
                          style={{ width: `${persona.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="app-panel p-6 border-slate-200/80">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
                    <ChartBar size={18} weight="bold" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      Credential Lifecycle
                    </h2>
                    <p className="text-xs text-slate-500">Physical RFID card status</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-xs font-bold text-slate-600">Total Issued</span>
                    <span className="font-display text-base font-black text-slate-900">
                      {overview.rfid_issued}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <span className="text-xs font-bold text-emerald-800">Active Credentials</span>
                    <span className="font-display text-base font-black text-emerald-700">
                      {overview.rfid_active}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/60 border border-red-100">
                    <span className="text-xs font-bold text-red-800">
                      Revoked / Replaced
                    </span>
                    <span className="font-display text-base font-black text-red-700">
                      {overview.rfid_revoked}
                    </span>
                  </div>
                </div>
                <button
                  className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-bold text-[#0a2342] hover:text-[#d99e00] p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                  onClick={() => navigate("/rfid")}
                >
                  Manage RFID Registry <ArrowRight size={15} weight="bold" className="icon-arrow" />
                </button>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default Dashboard;
