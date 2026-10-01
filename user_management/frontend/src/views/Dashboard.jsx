import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dashboardService from "@/services/dashboardService";
import {
  ArrowRight,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  BarChart3,
} from "lucide-react";
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
      : [2, 5, 3, 8, 6, 12, 9, 15, 11, 18, 14, 20, 17, 22];

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
    <section className="animate-fade-in">
      {/* Hero Banner */}
      <div className="overflow-hidden rounded-2xl bg-[#0a2342] text-white shadow-[0_18px_48px_rgb(10_35_66/0.18)]">
        <div className="relative px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-[#f5bd19]/15" />
          <div className="absolute bottom-0 right-16 h-24 w-24 rounded-t-full bg-[#f5bd19]/10" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f5bd19]">
                <ShieldCheck size={16} /> Campus access command centre
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/65">
                OCOC · University Identity Platform
              </p>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Identity operations, made clear.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Monitor people, credentials, and access status from one secure
                workspace built for day-to-day university operations.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/onboarding")}
              >
                <UserPlus size={17} /> Onboard person
              </button>
              <button
                className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => navigate("/users")}
              >
                Open directory <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="grid min-h-[420px] place-items-center">
          <div className="flex flex-col items-center gap-3 text-muted">
            <Loader2 className="animate-spin text-[#f5bd19]" size={32} />
            <span className="text-sm font-semibold">
              Loading your dashboard…
            </span>
          </div>
        </div>
      ) : error ? (
        <div className="app-panel mt-6 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Dashboard unavailable</h2>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
          <button className="btn btn-primary" onClick={loadOverview}>
            <RefreshCw size={17} /> Try again
          </button>
        </div>
      ) : overview ? (
        <>
          {/* KPI Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
              <div className="flex items-start justify-between">
                <p className="text-sm font-bold text-muted">
                  People in directory
                </p>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0a2342]/8 text-[#0a2342]">
                  <Users size={20} />
                </div>
              </div>
              <p className="mt-5 font-display text-3xl font-extrabold tabular-nums">
                {animatedStats.total.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted">
                All campus identities
              </p>
            </article>

            <article className="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
              <div className="flex items-start justify-between">
                <p className="text-sm font-bold text-muted">Active accounts</p>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <UserCheck size={20} />
                </div>
              </div>
              <p className="mt-5 font-display text-3xl font-extrabold tabular-nums">
                {animatedStats.active.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Enabled for access
              </p>
            </article>

            <article className="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
              <div className="flex items-start justify-between">
                <p className="text-sm font-bold text-muted">Suspended</p>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
                  <UserX size={20} />
                </div>
              </div>
              <p className="mt-5 font-display text-3xl font-extrabold tabular-nums">
                {animatedStats.suspended.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted">
                Require review
              </p>
            </article>

            <article className="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
              <div className="flex items-start justify-between">
                <p className="text-sm font-bold text-muted">
                  Active RFID cards
                </p>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f5bd19]/20 text-[#0a2342]">
                  <CreditCard size={20} />
                </div>
              </div>
              <p className="mt-5 font-display text-3xl font-extrabold tabular-nums">
                {animatedStats.rfid.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted">
                Ready for campus access
              </p>
            </article>
          </div>

          {/* Activity Chart + Population */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
            {/* Trend Chart */}
            <section className="app-panel p-5 sm:p-6 xl:col-span-3">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-extrabold flex items-center gap-2">
                    <TrendingUp size={18} className="text-[#f5bd19]" /> Daily
                    Registration Activity
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    New onboarding events over the last 14 days
                  </p>
                </div>
                <button
                  className="text-xs font-bold text-[#0a2342] hover:text-[#f5bd19] transition-colors flex items-center gap-1"
                  onClick={() => navigate("/analytics")}
                >
                  Full analytics <ArrowRight size={14} />
                </button>
              </div>
              <div className="h-56">
                <Line data={trendChartData} options={trendChartOptions} />
              </div>
            </section>

            {/* Campus Population + RFID Health */}
            <div className="xl:col-span-2 flex flex-col gap-6">
              <section className="app-panel p-5 sm:p-6 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold">
                      Campus population
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Directory composition
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5bd19]/20 px-3 py-1 text-xs font-bold text-[#0a2342]">
                    {overview.total_users} total
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  {personas.map((persona) => (
                    <div key={persona.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-bold">{persona.label}</span>
                        <span className={`font-bold ${persona.text}`}>
                          {persona.value}{" "}
                          <span className="font-medium text-muted">
                            ({persona.percent}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${persona.color}`}
                          style={{ width: `${persona.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="app-panel p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-extrabold flex items-center gap-2">
                    <BarChart3 size={18} className="text-sky-500" /> Credential
                    health
                  </h2>
                  <p className="mt-1 text-sm text-muted">RFID card lifecycle</p>
                </div>
                <div className="mt-4 divide-y divide-[var(--border-light)]">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-semibold">Cards issued</span>
                    <span className="font-display text-xl font-extrabold">
                      {overview.rfid_issued}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-semibold">Cards active</span>
                    <span className="font-display text-xl font-extrabold text-emerald-700">
                      {overview.rfid_active}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-semibold">
                      Revoked or replaced
                    </span>
                    <span className="font-display text-xl font-extrabold text-red-700">
                      {overview.rfid_revoked}
                    </span>
                  </div>
                </div>
                <button
                  className="mt-3 flex items-center gap-2 text-sm font-bold text-[#0a2342] hover:text-[#d99e00] transition-colors"
                  onClick={() => navigate("/rfid")}
                >
                  Manage RFID cards <ArrowRight size={16} />
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
