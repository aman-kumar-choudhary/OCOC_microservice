import React, { useState, useEffect } from "react";
import {
  ChartLineUp,
  Clock,
  FloppyDisk,
  MagnifyingGlass,
  MapPin,
  Plus,
  ShieldCheck,
  ShieldWarning,
  SpinnerGap,
  User
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import accessService from "@/services/accessService";
import userService from "@/services/userService";
import { roleService } from "@/services/miscService";
import UserAccessPanel from "@/components/access/UserAccessPanel";
export const AccessManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);

  const [locations, setLocations] = useState([]);
  const [rules, setRules] = useState([]);
  const [grants, setGrants] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    enabled: 0,
    allow_count: 0,
    deny_count: 0,
  });
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [roles, setRoles] = useState([]);

  const [users, setUsers] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [selectedAccessUser, setSelectedAccessUser] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedHostels, setSelectedHostels] = useState([]);
  const [accessMessage, setAccessMessage] = useState("");
  const operationalRoles = ["GUARD", "WARDEN", "FACULTY"];

  // Form states
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    subject_type: "role",
    subject_id: "student",
    location_id: "",
    device_id: "",
    effect: "ALLOW",
    priority: 0,
    schedule_days: [1, 2, 3, 4, 5, 6, 7],
    schedule_start_time: "",
    schedule_end_time: "",
    valid_from: "",
    valid_to: "",
  });

  const [grantForm, setGrantForm] = useState({
    user_id: "",
    location_id: "",
    valid_from: "",
    valid_to: "",
    reason: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        locs,
        r,
        g,
        a,
        uData,
        ruleStats,
        readerDevices,
        groupData,
        roleData,
        hostelData,
      ] = await Promise.all([
        accessService.getLocations(),
        accessService.getRules(),
        accessService.getTemporaryGrants(),
        accessService.getEvents({ limit: 20, only_denied: true }),
        userService.list({ limit: 1000 }),
        accessService.getRuleStats(),
        accessService.getDevices(),
        accessService.getGroups(),
        roleService.list(),
        userService.getHostels(),
      ]);
      setLocations(locs);
      setRules(r);
      setGrants(g);
      setAlerts(a);
      setUsers(uData.users || []);
      setStats(ruleStats);
      setDevices(readerDevices);
      setGroups(groupData);
      setRoles(roleData);
      setHostels(hostelData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadUserAccess = async (userId) => {
    setSelectedAccessUser(userId);
    setAccessMessage("");
    if (!userId) {
      setSelectedRoles([]);
      setSelectedHostels([]);
      return;
    }
    setLoading(true);
    try {
      const access = await accessService.getUserAccess(userId);
      setSelectedRoles(access.roles || []);
      setSelectedHostels((access.hostels || []).map((hostel) => hostel.id));
    } catch (e) {
      setAccessMessage(
        e.response?.data?.error?.message || "Could not load user access.",
      );
    } finally {
      setLoading(false);
    }
  };

  const saveUserAccess = async () => {
    if (!selectedAccessUser) return;
    setLoading(true);
    setAccessMessage("");
    try {
      const access = await accessService.updateUserAccess(selectedAccessUser, {
        roles: selectedRoles,
        hostel_ids: selectedRoles.includes("WARDEN") ? selectedHostels : [],
      });
      setSelectedRoles(access.roles || []);
      setSelectedHostels((access.hostels || []).map((hostel) => hostel.id));
      setAccessMessage(
        "Access configuration saved. New roles take effect when the user receives a refreshed Keycloak token.",
      );
    } catch (e) {
      setAccessMessage(
        e.response?.data?.error?.message ||
          "Could not save access configuration.",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (value, values, setValues) => {
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };

  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Default to empty for UUID if 'all' or empty string
      const payload = { ...ruleForm };
      if (!payload.location_id) delete payload.location_id;
      if (!payload.device_id) delete payload.device_id;
      if (!payload.schedule_start_time) delete payload.schedule_start_time;
      if (!payload.schedule_end_time) delete payload.schedule_end_time;
      if (!payload.valid_from) delete payload.valid_from;
      if (!payload.valid_to) delete payload.valid_to;

      await accessService.createRule(payload);
      const r = await accessService.getRules();
      setRules(r);
      setRuleForm({
        name: "",
        description: "",
        subject_type: "role",
        subject_id: "student",
        location_id: "",
        device_id: "",
        effect: "ALLOW",
        priority: 0,
        schedule_days: [1, 2, 3, 4, 5, 6, 7],
        schedule_start_time: "",
        schedule_end_time: "",
        valid_from: "",
        valid_to: "",
      });
      setActiveTab("dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...grantForm,
        valid_from: new Date(grantForm.valid_from).toISOString(),
        valid_to: new Date(grantForm.valid_to).toISOString(),
      };
      await accessService.createTemporaryGrant(payload);
      const g = await accessService.getTemporaryGrants();
      setGrants(g);
      setGrantForm({
        user_id: "",
        location_id: "",
        valid_from: "",
        valid_to: "",
        reason: "",
      });
      setActiveTab("grants");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (rule) => {
    try {
      await accessService.updateRule(rule.id, { is_active: !rule.is_active });
      const r = await accessService.getRules();
      setRules(r);
    } catch (e) {
      console.error(e);
    }
  };

  const getLocationName = (id) =>
    locations.find((l) => l.id === id)?.name || "All Campus";
  const getUserName = (id) => users.find((u) => u.id === id)?.email || id;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-black uppercase tracking-wider">
              <ShieldCheck size={12} className="text-[#d99e00]" /> Policy Engine
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Access Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage physical zone restrictions, scheduled turnstile policies, and temporary visitor passes
          </p>
        </div>
        <button
          onClick={() => navigate("/onboarding")}
          className="btn btn-primary text-xs px-4 py-2"
        >
          <Plus size={16} /> Onboard Identity
        </button>
      </div>

      {/* Modern Pill Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/60 overflow-x-auto shadow-2xs">
        {["dashboard", "user_access", "rule_builder", "grants", "alerts"].map(
          (tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-white text-[#0a2342] shadow-xs font-black"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                {tab.replace("_", " ")}
              </button>
            );
          },
        )}
      </div>

      {loading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <SpinnerGap className="animate-spin text-[#f5bd19]" size={36} />
          <span className="text-xs font-bold text-slate-600">Loading access engine rules…</span>
        </div>
      )}

      {!loading && activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-display text-lg font-black text-slate-900">Access Rules Overview</h2>
            <button
              onClick={() => setActiveTab("rule_builder")}
              className="btn btn-primary text-xs px-3.5 py-1.5 h-auto"
            >
              <Plus size={15} /> New Rule
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Total Rules", stats.total, "text-slate-900", "bg-slate-50"],
              ["Active Rules", stats.enabled, "text-blue-700", "bg-blue-50/50"],
              ["Allow Decisions", stats.allow_count, "text-emerald-700", "bg-emerald-50/50"],
              ["Deny Decisions", stats.deny_count, "text-red-700", "bg-red-50/50"],
            ].map(([label, value, color, bg]) => (
              <div
                key={label}
                className="app-panel border-slate-200/80 p-5 shadow-xs"
              >
                <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                  {label}
                </p>
                <p className={`font-display text-3xl font-black mt-2 tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="app-panel border-slate-200/80 overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-[var(--border-light)] text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Rule Name</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Effect</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {rules.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-[var(--text-muted)]"
                    >
                      No access rules defined.
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {r.subject_type}: {r.subject_id}
                      </td>
                      <td className="px-4 py-3">
                        {getLocationName(r.location_id)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${r.effect === "ALLOW" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                        >
                          {r.effect}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRule(r)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition ${r.is_active ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                        >
                          {r.is_active ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === "user_access" && <UserAccessPanel />}

      {!loading && activeTab === "rule_builder" && (
        <form
          onSubmit={handleRuleSubmit}
          className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm p-6 max-w-3xl space-y-5"
        >
          <h2 className="text-lg font-bold border-b pb-3 mb-4">Rule Builder</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Rule Name
              </label>
              <input
                required
                value={ruleForm.name}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, name: e.target.value })
                }
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="e.g. Faculty Lab Access"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Priority (Higher = overrides)
              </label>
              <input
                type="number"
                required
                value={ruleForm.priority}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    priority: parseInt(e.target.value),
                  })
                }
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Subject Type
              </label>
              <select
                value={ruleForm.subject_type}
                onChange={(e) => {
                  const subject_type = e.target.value;
                  setRuleForm({
                    ...ruleForm,
                    subject_type,
                    subject_id: subject_type === "role" ? "student" : "",
                  });
                }}
                className="h-10 w-full rounded-lg border px-3 text-sm"
              >
                <option value="role">Role</option>
                <option value="group">Group</option>
                <option value="user">Specific User</option>
                <option value="all">Everyone</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Subject Target
              </label>
              {ruleForm.subject_type === "role" ? (
                <select
                  required
                  value={ruleForm.subject_id}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, subject_id: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border px-3 text-sm"
                >
                  <option value="">Select role</option>
                  {["student", "faculty", "worker", "visitor"].map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                  {roles
                    .filter(
                      (role) =>
                        !["student", "faculty", "worker", "visitor"].includes(
                          role.name.toLowerCase(),
                        ),
                    )
                    .map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                </select>
              ) : ruleForm.subject_type === "group" ? (
                <select
                  required
                  value={ruleForm.subject_id}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, subject_id: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border px-3 text-sm"
                >
                  <option value="">Select group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              ) : ruleForm.subject_type === "user" ? (
                <select
                  required
                  value={ruleForm.subject_id}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, subject_id: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border px-3 text-sm"
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.profile?.full_name || user.email} — {user.email}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value="Everyone"
                  className="h-10 w-full rounded-lg border px-3 text-sm bg-slate-50"
                  disabled
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
              Location / Zone
            </label>
            <select
              value={ruleForm.location_id}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, location_id: e.target.value })
              }
              className="h-10 w-full rounded-lg border px-3 text-sm"
            >
              <option value="">All Locations (Global)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
              Reader (optional)
            </label>
            <select
              value={ruleForm.device_id}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, device_id: e.target.value })
              }
              className="h-10 w-full rounded-lg border px-3 text-sm"
            >
              <option value="">Any reader in this zone</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.mac_address} — {d.location_name || "Unassigned"} ({d.type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Start time
              </label>
              <input
                type="time"
                value={ruleForm.schedule_start_time}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    schedule_start_time: e.target.value,
                  })
                }
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                End time
              </label>
              <input
                type="time"
                value={ruleForm.schedule_end_time}
                onChange={(e) =>
                  setRuleForm({
                    ...ruleForm,
                    schedule_end_time: e.target.value,
                  })
                }
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Valid from
              </label>
              <input
                type="date"
                value={ruleForm.valid_from}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, valid_from: e.target.value })
                }
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Valid to
              </label>
              <input
                type="date"
                value={ruleForm.valid_to}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, valid_to: e.target.value })
                }
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
              Days
            </label>
            <div className="flex flex-wrap gap-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, index) => (
                  <label key={day} className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={ruleForm.schedule_days.includes(index + 1)}
                      onChange={() =>
                        setRuleForm({
                          ...ruleForm,
                          schedule_days: ruleForm.schedule_days.includes(
                            index + 1,
                          )
                            ? ruleForm.schedule_days.filter(
                                (d) => d !== index + 1,
                              )
                            : [...ruleForm.schedule_days, index + 1],
                        })
                      }
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
              Effect
            </label>
            <select
              value={ruleForm.effect}
              onChange={(e) =>
                setRuleForm({ ...ruleForm, effect: e.target.value })
              }
              className="h-10 w-full rounded-lg border px-3 text-sm font-bold"
            >
              <option value="ALLOW">ALLOW Access</option>
              <option value="DENY">DENY Access</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" className="btn btn-primary px-6">
              FloppyDisk Rule
            </button>
          </div>
        </form>
      )}

      {!loading && activeTab === "grants" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <form
              onSubmit={handleGrantSubmit}
              className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm p-5 space-y-4"
            >
              <h2 className="text-base font-bold border-b pb-2 mb-3">
                Grant Temp Access
              </h2>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  User
                </label>
                <select
                  required
                  value={grantForm.user_id}
                  onChange={(e) =>
                    setGrantForm({ ...grantForm, user_id: e.target.value })
                  }
                  className="h-9 w-full rounded-lg border px-3 text-sm"
                >
                  <option value="">Select User...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Zone / Location
                </label>
                <select
                  required
                  value={grantForm.location_id}
                  onChange={(e) =>
                    setGrantForm({ ...grantForm, location_id: e.target.value })
                  }
                  className="h-9 w-full rounded-lg border px-3 text-sm"
                >
                  <option value="">Select Location...</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Valid From
                </label>
                <input
                  required
                  type="datetime-local"
                  value={grantForm.valid_from}
                  onChange={(e) =>
                    setGrantForm({ ...grantForm, valid_from: e.target.value })
                  }
                  className="h-9 w-full rounded-lg border px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Valid To
                </label>
                <input
                  required
                  type="datetime-local"
                  value={grantForm.valid_to}
                  onChange={(e) =>
                    setGrantForm({ ...grantForm, valid_to: e.target.value })
                  }
                  className="h-9 w-full rounded-lg border px-3 text-sm"
                />
              </div>

              <button type="submit" className="w-full btn btn-primary mt-2">
                Grant Access
              </button>
            </form>
          </div>

          <div className="md:col-span-2">
            <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-[var(--border-light)] text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Valid Until</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {grants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-[var(--text-muted)]"
                      >
                        No active grants.
                      </td>
                    </tr>
                  ) : (
                    grants.map((g) => (
                      <tr key={g.id}>
                        <td className="px-4 py-3 font-semibold">
                          {g.user_name || "Unknown"}
                        </td>
                        <td className="px-4 py-3">
                          {getLocationName(g.location_id)}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">
                          {new Date(g.valid_to).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === "alerts" && (
        <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden p-2">
          <div className="px-4 py-3 border-b flex justify-between items-center bg-red-50/50">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <ShieldWarning size={18} /> Access Denied Alerts
            </div>
            <button
              onClick={() => fetchData()}
              className="text-xs font-bold hover:underline"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {alerts.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)]">
                No recent denied events.
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="p-4 hover:bg-slate-50 flex items-center gap-4"
                >
                  <div className="p-2 bg-red-100 text-red-600 rounded-full">
                    <ShieldWarning size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">
                      {a.user_name}{" "}
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        ({a.user_identifier})
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Attempted {a.action} at{" "}
                      <strong className="text-[var(--text-main)]">
                        {a.location_name}
                      </strong>
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Reason: {a.reason}
                    </p>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(a.event_time).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessManagement;
