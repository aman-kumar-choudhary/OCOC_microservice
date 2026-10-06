// Date formatting utilities — Indian Standard Time (IST) & DD-MM-YYYY / DD-MM-YY formats

/**
 * Returns DD-MM-YYYY from an ISO date string or Date object in IST
 */
export function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }); // dd/mm/yyyy
  } catch {
    return "—";
  }
}

/**
 * Returns DD-MM-YY in IST
 */
export function formatDateIST(iso, shortYear = false) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: shortYear ? "2-digit" : "numeric",
    }).formatToParts(d);

    const day = parts.find((p) => p.type === "day")?.value || "01";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const year = parts.find((p) => p.type === "year")?.value || "26";
    return `${day}-${month}-${year}`;
  } catch {
    return "—";
  }
}

/**
 * Returns DD-MM-YYYY HH:mm in IST
 */
export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

/**
 * Formats date-time in IST with format: DD-MM-YY, hh:mm A IST
 */
export function formatDateTimeIST(iso, options = {}) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const shortYear = options.shortYear !== false; // default true for DD-MM-YY
    const dateStr = formatDateIST(d, shortYear);
    const timeStr = d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr}, ${timeStr} IST`;
  } catch {
    return "—";
  }
}

/**
 * Formats time only in IST (e.g. 10:30 AM)
 */
export function formatTimeIST(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

/**
 * Returns a relative time string like "2 min ago".
 */
export function timeAgo(iso) {
  if (!iso) return "—";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return formatDateIST(iso);
}

/**
 * Evaluates whether student is Early, Late, On Time, or Overdue based on leave date/time
 */
export function calculateStudentTimeliness({
  startAt,
  endAt,
  eventTime,
  movementType,
  currentStatus,
}) {
  const now = new Date();
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;
  const event = eventTime ? new Date(eventTime) : null;

  if (!start || !end) {
    return {
      status: "NO_LEAVE",
      badge: "No Approved Leave",
      colorClass: "bg-amber-50 text-amber-800 border-amber-200",
      isLate: false,
      isEarly: false,
    };
  }

  // If student is currently outside or on leave, check if overdue
  const isOutside = ["OUTSIDE", "ON_LEAVE", "LATE_RETURN"].includes(currentStatus);
  if (isOutside && now > end) {
    const overdueMins = Math.floor((now - end) / 60000);
    const hrs = Math.floor(overdueMins / 60);
    const mins = overdueMins % 60;
    const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    return {
      status: "OVERDUE",
      badge: `LATE / OVERDUE by ${timeLabel}`,
      colorClass: "bg-red-100 text-red-900 border-red-300 animate-pulse font-black",
      isLate: true,
      isEarly: false,
      diffMinutes: overdueMins,
    };
  }

  // Check last movement
  if (movementType === "ENTRY" || movementType === "IN") {
    if (event && event > end) {
      const lateMins = Math.floor((event - end) / 60000);
      const hrs = Math.floor(lateMins / 60);
      const mins = lateMins % 60;
      return {
        status: "LATE_RETURN",
        badge: `Late Return (${hrs > 0 ? `${hrs}h ` : ""}${mins}m late)`,
        colorClass: "bg-red-50 text-red-800 border-red-200 font-bold",
        isLate: true,
        isEarly: false,
      };
    } else if (event && event < start) {
      const earlyMins = Math.floor((start - event) / 60000);
      return {
        status: "EARLY_RETURN",
        badge: `Early Return (${earlyMins}m before start)`,
        colorClass: "bg-blue-50 text-blue-800 border-blue-200",
        isLate: false,
        isEarly: true,
      };
    } else {
      return {
        status: "ON_TIME",
        badge: "Returned On Time",
        colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        isLate: false,
        isEarly: false,
      };
    }
  }

  if (movementType === "EXIT" || movementType === "OUT") {
    if (event && event < start) {
      const earlyMins = Math.floor((start - event) / 60000);
      const hrs = Math.floor(earlyMins / 60);
      const mins = earlyMins % 60;
      return {
        status: "EARLY_EXIT",
        badge: `Early Exit (${hrs > 0 ? `${hrs}h ` : ""}${mins}m early)`,
        colorClass: "bg-amber-50 text-amber-800 border-amber-200",
        isLate: false,
        isEarly: true,
      };
    } else {
      return {
        status: "ON_TIME",
        badge: "Exited On Time",
        colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        isLate: false,
        isEarly: false,
      };
    }
  }

  // Default within active leave window
  if (now >= start && now <= end) {
    return {
      status: "ACTIVE_LEAVE",
      badge: "Leave Active (On Time)",
      colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      isLate: false,
      isEarly: false,
    };
  }

  if (now < start) {
    return {
      status: "UPCOMING",
      badge: "Upcoming Leave",
      colorClass: "bg-blue-50 text-blue-800 border-blue-200",
      isLate: false,
      isEarly: false,
    };
  }

  return {
    status: "EXPIRED",
    badge: "Leave Ended",
    colorClass: "bg-slate-100 text-slate-700 border-slate-200",
    isLate: false,
    isEarly: false,
  };
}
