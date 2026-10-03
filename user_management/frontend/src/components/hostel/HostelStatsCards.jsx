import React, { useState, useEffect } from "react";
import {
  ChartLineUp,
  CheckCircle,
  Clock,
  House,
  SignOut,
  Users,
  Warning,
  WarningCircle,
  XCircle
} from "@phosphor-icons/react";
import { hostelService } from "../../services/hostelService";

const HostelStatsCards = ({ hostelId, liveVersion = 0 }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [statsData, alertsData] = await Promise.all([
          hostelService.getDashboardStats(hostelId),
          hostelService.getAlerts(hostelId),
        ]);
        setStats(statsData.data);
        setAlerts(alertsData.data);
      } catch (err) {
        console.error("Failed to fetch hostel stats", err);
      }
      setLoading(false);
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [hostelId, liveVersion]);

  if (loading && !stats) {
    return (
      <div className="p-12 text-center text-gray-500">
        Loading Dashboard Stats...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          title="Total Students"
          value={stats.total_students}
          color="blue"
        />
        <StatCard
          icon={House}
          title="Inside Hostel"
          value={stats.inside}
          color="emerald"
        />
        <StatCard
          icon={SignOut}
          title="Outside Campus"
          value={stats.outside}
          color="orange"
        />
        <StatCard
          icon={Clock}
          title="On Approved Leave"
          value={stats.on_leave}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Secondary Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                Attendance Marked
              </p>
              <h3 className="text-2xl font-black text-[#0a2342] mt-1">
                {stats.attendance_marked}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                Missing Attendance
              </p>
              <h3 className="text-2xl font-black text-red-600 mt-1">
                {stats.attendance_missing}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <XCircle size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                Active Permissions
              </p>
              <h3 className="text-2xl font-black text-[#f5bd19] mt-1">
                {stats.active_permissions}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
              <ChartLineUp size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                Unauthorized / Late
              </p>
              <h3 className="text-2xl font-black text-red-600 mt-1">
                {stats.unauthorized_outside + stats.late_returns}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <Warning size={24} />
            </div>
          </div>
        </div>

        {/* Live Alerts Feed */}
        <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center gap-2">
            <WarningCircle size={18} className="text-red-600" />
            <h3 className="font-bold text-red-800">Live Alerts</h3>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[220px]">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No active alerts. All clear!
              </p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <div
                      className={`mt-0.5 h-2 w-2 rounded-full ${alert.severity === "HIGH" ? "bg-red-500" : "bg-orange-400"}`}
                    ></div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">
                        {alert.student_name} ({alert.student_roll})
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {alert.description}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, color }) => {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <div
      className={`p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center text-center ${colorMap[color].split(" ")[2]} bg-white`}
    >
      <div
        className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${colorMap[color].split(" ")[0]} ${colorMap[color].split(" ")[1]}`}
      >
        <Icon size={24} />
      </div>
      <h2 className="text-3xl font-black text-[#0a2342]">{value}</h2>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">
        {title}
      </p>
    </div>
  );
};

export default HostelStatsCards;
