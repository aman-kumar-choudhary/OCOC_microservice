import React, { useState, useEffect, useMemo } from "react";
import dashboardService from "@/services/dashboardService";
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Loader2,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

export const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split("T")[0];
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [an, ov] = await Promise.allSettled([
        dashboardService.getAnalyticsWithDateRange(dateFrom, dateTo),
        dashboardService.getOverview(),
      ]);
      if (an.status === "fulfilled") setAnalytics(an.value);
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (an.status === "rejected") throw an.reason;
    } catch {
      setError("Could not load analytics data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateFrom, dateTo]);

  const tooltipDefaults = {
    backgroundColor: "#0a2342",
    titleColor: "#f5bd19",
    bodyColor: "#fff",
    padding: 10,
    cornerRadius: 8,
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: tooltipDefaults,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#607087", font: { size: 11 }, maxTicksLimit: 8 },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(220,227,236,0.5)" },
        ticks: { color: "#607087", font: { size: 11 }, precision: 0 },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: tooltipDefaults,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#607087", font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(220,227,236,0.5)" },
        ticks: { color: "#607087", font: { size: 11 }, precision: 0 },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 16,
          font: { size: 12, weight: "bold" },
          color: "#607087",
          usePointStyle: true,
          pointStyleWidth: 12,
        },
      },
      tooltip: tooltipDefaults,
    },
  };

  const onboardingTrend = analytics?.onboarding_trend ?? [];
  const cardTrend = analytics?.card_issuance_trend ?? [];

  const onboardingChartData = useMemo(
    () => ({
      labels: onboardingTrend.map((t) =>
        new Date(t.date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
      ),
      datasets: [
        {
          label: "New Users",
          data: onboardingTrend.map((t) => t.count),
          borderColor: "#f5bd19",
          backgroundColor: "rgba(245,189,25,0.10)",
          borderWidth: 2.5,
          fill: true,
          tension: 0.45,
          pointRadius: 4,
          pointBackgroundColor: "#d99e00",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    }),
    [onboardingTrend],
  );

  const cardChartData = useMemo(
    () => ({
      labels: cardTrend.map((t) =>
        new Date(t.date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
      ),
      datasets: [
        {
          label: "Cards Issued",
          data: cardTrend.map((t) => t.count),
          backgroundColor: "rgba(14,165,233,0.15)",
          borderColor: "#0ea5e9",
          borderWidth: 2.5,
          borderRadius: 6,
        },
      ],
    }),
    [cardTrend],
  );

  const populationChartData = useMemo(() => {
    if (!overview) return { labels: [], datasets: [] };
    return {
      labels: ["Students", "Faculty", "Staff", "Visitors"],
      datasets: [
        {
          data: [
            overview.students,
            overview.faculty,
            overview.workers,
            overview.visitors,
          ],
          backgroundColor: ["#f5bd19", "#0ea5e9", "#10b981", "#8b5cf6"],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    };
  }, [overview]);

  const totalOnboarded = onboardingTrend.reduce(
    (acc, curr) => acc + curr.count,
    0,
  );
  const totalCardsIssued = cardTrend.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="space-y-6">
      {/* Header with Date Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics & Reports</h1>
          <p className="text-muted text-sm mt-1">
            Cross-campus onboarding and access credentials telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-light)] p-1.5 rounded-xl shadow-sm">
          <Calendar size={16} className="text-muted ml-2" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs font-semibold bg-transparent border-0 focus:ring-0 p-1 text-[var(--text-main)]"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs font-semibold bg-transparent border-0 focus:ring-0 p-1 text-[var(--text-main)]"
          />
          <button
            onClick={loadAnalytics}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-muted"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-[400px] place-items-center">
          <div className="flex flex-col items-center gap-3 text-muted">
            <Loader2 className="animate-spin text-[#f5bd19]" size={32} />
            <span className="text-sm font-semibold">
              Generating analytics metrics…
            </span>
          </div>
        </div>
      ) : error ? (
        <div className="app-panel p-6 text-center">
          <p className="text-red-500 font-semibold mb-2">{error}</p>
          <button onClick={loadAnalytics} className="btn btn-primary text-xs">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-4">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">
                Total Population
              </span>
              <p className="text-2xl font-extrabold mt-2 font-display">
                {overview?.total_users || 0}
              </p>
              <p className="text-xs text-emerald-600 mt-1 font-semibold">
                {overview?.active_users || 0} active accounts
              </p>
            </div>
            <div className="glass-panel p-4">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">
                Onboarded in Range
              </span>
              <p className="text-2xl font-extrabold mt-2 font-display">
                {totalOnboarded}
              </p>
              <p className="text-xs text-muted mt-1 font-semibold">
                Selected date window
              </p>
            </div>
            <div className="glass-panel p-4">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">
                Cards Issued in Range
              </span>
              <p className="text-2xl font-extrabold mt-2 font-display">
                {totalCardsIssued}
              </p>
              <p className="text-xs text-muted mt-1 font-semibold">
                RFID activations
              </p>
            </div>
            <div className="glass-panel p-4">
              <span className="text-xs text-muted font-bold uppercase tracking-wider">
                Active RFID Tokens
              </span>
              <p className="text-2xl font-extrabold mt-2 font-display">
                {overview?.rfid_active || 0}
              </p>
              <p className="text-xs text-muted mt-1 font-semibold">
                {overview?.rfid_revoked || 0} revoked
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-panel p-5">
              <h3 className="font-extrabold text-base mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-[#f5bd19]" /> Onboarding
                Activity
              </h3>
              <p className="text-xs text-muted mb-4">
                Daily additions over the selected period
              </p>
              <div className="h-64">
                <Line data={onboardingChartData} options={lineOptions} />
              </div>
            </div>

            <div className="app-panel p-5">
              <h3 className="font-extrabold text-base mb-1 flex items-center gap-2">
                <CreditCard size={16} className="text-sky-500" /> Card Issuance
                Trend
              </h3>
              <p className="text-xs text-muted mb-4">
                Hardware cards linked to identities
              </p>
              <div className="h-64">
                <Bar data={cardChartData} options={barOptions} />
              </div>
            </div>
          </div>

          {/* Population Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="app-panel p-5">
              <h3 className="font-extrabold text-base mb-1 flex items-center gap-2">
                <Users size={16} className="text-[#0a2342]" /> Composition
              </h3>
              <p className="text-xs text-muted mb-4">Role distribution</p>
              <div className="h-56">
                <Doughnut
                  data={populationChartData}
                  options={doughnutOptions}
                />
              </div>
            </div>

            <div className="app-panel p-5 lg:col-span-2">
              <h3 className="font-extrabold text-base mb-4">
                Identities Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                    Students
                  </p>
                  <p className="text-2xl font-extrabold text-amber-900 mt-2">
                    {overview?.students || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200">
                  <p className="text-xs font-bold text-sky-800 uppercase tracking-wide">
                    Faculty
                  </p>
                  <p className="text-2xl font-extrabold text-sky-900 mt-2">
                    {overview?.faculty || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    Staff
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-900 mt-2">
                    {overview?.workers || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                  <p className="text-xs font-bold text-purple-800 uppercase tracking-wide">
                    Visitors
                  </p>
                  <p className="text-2xl font-extrabold text-purple-900 mt-2">
                    {overview?.visitors || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
