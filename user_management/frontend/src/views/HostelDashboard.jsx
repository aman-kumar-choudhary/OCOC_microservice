import React, { useState, useEffect, useRef } from "react";
import {
  ChartLineUp,
  CheckCircle,
  Clock,
  House,
  Lifebuoy,
  MagnifyingGlass,
  ShieldCheck,
  SignIn,
  SignOut,
  Users,
  Warning,
  WarningCircle
} from "@phosphor-icons/react";
import api from "../services/api";
import { hostelService } from "../services/hostelService";
import { useAuth } from "../context/AuthContext";
import { getHumanGreeting } from "../utils/greetings";
import LiveStatusTable from "../components/hostel/LiveStatusTable";
import HostelStatsCards from "../components/hostel/HostelStatsCards";
import PermissionPanel from "../components/hostel/PermissionPanel";
import MovementHistoryTable from "../components/hostel/MovementHistoryTable";
import EmergencyMode from "../components/hostel/EmergencyMode";
import HostelStudentsList from "../components/hostel/HostelStudentsList";
import WardenDirectoryTable from "../components/hostel/WardenDirectoryTable";

const HostelDashboard = () => {
  const { user, roles, fullName } = useAuth();
  const displayName = fullName || user?.name || user?.preferred_username || user?.email?.split("@")[0] || "Warden";
  const greeting = getHumanGreeting(displayName, roles || ["WARDEN"]);

  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [liveVersion, setLiveVersion] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const res = await api.get("/hostel/assigned-hostels");
        setHostels(res.data.data || []);
        if (res.data.data && res.data.data.length > 0) {
          setSelectedHostel(res.data.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchHostels();
  }, []);

  useEffect(() => {
    let reconnectTimer;
    const connect = () => {
      const token = sessionStorage.getItem("access_token");
      socketRef.current = new WebSocket(
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/v1/ws/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`,
      );
      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (
            [
              "HOSTEL_STATUS_UPDATED",
              "HOSTEL_CURFEW_ALERT",
              "HOSTEL_ALERT",
            ].includes(message.type)
          ) {
            setLiveVersion((version) => version + 1);
          }
        } catch (error) {
          console.error("Hostel live update parsing failed", error);
        }
      };
      socketRef.current.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  const isAdmin = (roles || []).some((r) =>
    ["SUPER_ADMIN", "ADMIN"].includes(String(r).toUpperCase()),
  );

  const tabs = [
    { id: "overview", name: "Overview Dashboard", icon: ChartLineUp },
    { id: "directory", name: "Students Directory", icon: Users },
    ...(isAdmin
      ? [{ id: "wardens", name: "Warden Directory", icon: ShieldCheck }]
      : []),
    { id: "live", name: "Live Status", icon: ChartLineUp },
    { id: "permissions", name: "Leave & Permissions", icon: Clock },
    { id: "history", name: "Movement History", icon: SignOut },
    { id: "emergency", name: "Emergency Headcount", icon: Lifebuoy },
  ];

  return (
    <div className="space-y-6 pb-24 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-black uppercase tracking-wider">
              <House size={12} className="text-amber-600" /> Residential Governance
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Hostel Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            RFID turnstile tracking, curfew management, leave permissions, and emergency headcount
          </p>
        </div>

        {/* Hostel Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="hostel-select" className="text-xs font-bold text-slate-500 whitespace-nowrap">
            Active Block:
          </label>
          <select
            id="hostel-select"
            className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-bold text-[#0a2342] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#f5bd19] transition"
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
          >
            <option value="">All Assigned Hostels</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Warm Human Greeting Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a2342] via-[#0f3460] to-[#16213e] p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
              Hostel Warden Console
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {greeting.greeting}
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              {greeting.message}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-xs font-medium text-slate-200">
              <span className="text-amber-400 font-bold">{hostels.length}</span> assigned block{hostels.length === 1 ? "" : "s"} under supervision
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/60 overflow-x-auto shadow-2xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? "bg-white text-[#0a2342] shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Icon
                size={16}
                className={isActive ? "text-[#d99e00]" : "text-slate-400"}
              />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {activeTab === "overview" && (
          <HostelStatsCards
            hostelId={selectedHostel}
            liveVersion={liveVersion}
          />
        )}
        {activeTab === "directory" && (
          <HostelStudentsList hostelId={selectedHostel} />
        )}
        {activeTab === "wardens" && isAdmin && (
          <WardenDirectoryTable />
        )}
        {activeTab === "live" && (
          <LiveStatusTable
            hostelId={selectedHostel}
            liveVersion={liveVersion}
          />
        )}
        {activeTab === "permissions" && (
          <PermissionPanel hostelId={selectedHostel} />
        )}
        {activeTab === "history" && (
          <MovementHistoryTable hostelId={selectedHostel} />
        )}
        {activeTab === "emergency" && (
          <EmergencyMode hostelId={selectedHostel} />
        )}
      </div>
    </div>
  );
};

export default HostelDashboard;
