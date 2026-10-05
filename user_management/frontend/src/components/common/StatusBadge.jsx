import React from "react";

const STATUS_VARIANTS = {
  // Account statuses
  active: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  suspended: "bg-amber-50 text-amber-700 border-amber-200/80",
  deactivated: "bg-rose-50 text-rose-700 border-rose-200/80",

  // Leave statuses
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  pending_approval: "bg-amber-50 text-amber-700 border-amber-200/80",
  pending: "bg-amber-50 text-amber-700 border-amber-200/80",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200/80",
  withdrawn: "bg-slate-100 text-slate-600 border-slate-200",
  expired: "bg-orange-50 text-orange-700 border-orange-200/80",
  completed: "bg-blue-50 text-blue-700 border-blue-200/80",

  // Movement / Attendance
  inside: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  outside: "bg-rose-50 text-rose-700 border-rose-200/80",
  on_leave: "bg-amber-50 text-amber-700 border-amber-200/80",

  // Device / RFID
  online: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  offline: "bg-slate-100 text-slate-600 border-slate-200",
  revoked: "bg-rose-50 text-rose-700 border-rose-200/80",
  warning: "bg-amber-50 text-amber-700 border-amber-200/80",
};

const DOT_COLORS = {
  active: "bg-emerald-500",
  suspended: "bg-amber-500",
  deactivated: "bg-rose-500",
  approved: "bg-emerald-500",
  pending_approval: "bg-amber-500",
  pending: "bg-amber-500",
  draft: "bg-slate-400",
  rejected: "bg-rose-500",
  withdrawn: "bg-slate-400",
  expired: "bg-orange-500",
  completed: "bg-blue-500",
  inside: "bg-emerald-500",
  outside: "bg-rose-500",
  on_leave: "bg-amber-500",
  online: "bg-emerald-500",
  offline: "bg-slate-400",
  revoked: "bg-rose-500",
  warning: "bg-amber-500",
};

export const StatusBadge = ({
  status = "",
  label = null,
  showDot = true,
  className = "",
  size = "md", // 'sm' | 'md'
}) => {
  if (!status) return null;

  const key = String(status).toLowerCase().replace(/\s+/g, "_");
  const styling = STATUS_VARIANTS[key] || "bg-slate-100 text-slate-700 border-slate-200";
  const dotColor = DOT_COLORS[key] || "bg-slate-400";
  const displayLabel = label || String(status).replace(/_/g, " ");

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : "px-2.5 py-0.5 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-bold capitalize rounded-full border shadow-2xs ${sizeClasses} ${styling} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};

export default StatusBadge;
