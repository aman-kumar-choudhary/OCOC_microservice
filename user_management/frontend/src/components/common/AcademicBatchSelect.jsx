import React, { useId, useMemo } from "react";

/**
 * Calculates academic batch year boundaries dynamically with automatic rollover in May.
 *
 * Rules:
 * Before May 2027:
 *   From starts at 2022
 *   To   starts at 2027
 * From May 2027:
 *   From starts at 2023
 *   To   starts at 2028
 */
export const getAcademicBatchRange = (date = new Date()) => {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth(); // 0-indexed: May is 4

  // In or after May of the year, the academic cycle rolls over by one year
  const effectiveYear = currentMonth >= 4 ? currentYear : currentYear - 1;

  const baseFromYear = effectiveYear - 4;
  const baseToYear = effectiveYear + 1;

  // Generate From years starting at baseFromYear (covers recent past to future)
  const fromYears = [];
  for (let y = baseFromYear; y <= baseFromYear + 8; y++) {
    fromYears.push(y);
  }

  return { baseFromYear, baseToYear, fromYears };
};

export const AcademicBatchSelect = ({
  value = "",
  onChange,
  disabled = false,
  required = false,
  className = "",
}) => {
  const id = useId();
  const fromId = `${id}-batch-from`;
  const toId = `${id}-batch-to`;
  const { baseFromYear, baseToYear, fromYears } = useMemo(
    () => getAcademicBatchRange(),
    [],
  );

  // Parse existing "YYYY-YYYY" string
  const [currentFrom, currentTo] = useMemo(() => {
    if (value && typeof value === "string" && value.includes("-")) {
      const parts = value.split("-").map((p) => parseInt(p.trim(), 10));
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    return [baseFromYear, baseToYear];
  }, [value, baseFromYear, baseToYear]);

  // Dynamically generate To years strictly greater than currentFrom
  const toYears = useMemo(() => {
    const list = [];
    // Academic programs typically range between 1 to 6 years (up to 8 years)
    const minTo = currentFrom + 1;
    const maxTo = Math.max(currentFrom + 8, baseToYear + 6);
    for (let y = minTo; y <= maxTo; y++) {
      list.push(y);
    }
    return list;
  }, [currentFrom, baseToYear]);

  const handleFromChange = (e) => {
    const newFrom = parseInt(e.target.value, 10);
    let newTo = currentTo;
    if (newTo <= newFrom) {
      newTo = newFrom + 4; // Default standard 4-year degree span
    }
    onChange?.(`${newFrom}-${newTo}`);
  };

  const handleToChange = (e) => {
    const newTo = parseInt(e.target.value, 10);
    if (newTo > currentFrom) {
      onChange?.(`${currentFrom}-${newTo}`);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-bold text-slate-700">
        Academic Batch {required && <span className="text-rose-500">*</span>}
      </label>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 items-center">
        {/* From dropdown */}
        <div className="relative">
          <label htmlFor={fromId} className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            From
          </label>
          <select
            id={fromId}
            value={currentFrom}
            onChange={handleFromChange}
            disabled={disabled}
            className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#0a2342] focus:outline-hidden focus:ring-1 focus:ring-[#0a2342] disabled:bg-slate-100 disabled:text-slate-400 transition"
          >
            {fromYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* To dropdown */}
        <div className="relative">
          <label htmlFor={toId} className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            To
          </label>
          <select
            id={toId}
            value={currentTo}
            onChange={handleToChange}
            disabled={disabled}
            className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#0a2342] focus:outline-hidden focus:ring-1 focus:ring-[#0a2342] disabled:bg-slate-100 disabled:text-slate-400 transition"
          >
            {toYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Batch duration: {currentTo - currentFrom} year{currentTo - currentFrom === 1 ? "" : "s"} ({currentFrom}–{currentTo})
      </p>
    </div>
  );
};

export default AcademicBatchSelect;
