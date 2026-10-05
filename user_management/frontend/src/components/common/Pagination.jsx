import React from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * Reusable, accessible, responsive pagination component.
 *
 * Props:
 * - page: current page number (1-based)
 * - totalPages: total number of pages
 * - total: total number of records (optional)
 * - limit: records per page (optional)
 * - onPageChange: callback function (newPage: number) => void
 * - onLimitChange: callback function (newLimit: number) => void (optional)
 * - pageSizeOptions: array of numbers, e.g. [10, 20, 50, 100] (optional)
 */
export const Pagination = ({
  page = 1,
  totalPages = 1,
  total = null,
  limit = 20,
  onPageChange,
  onLimitChange = null,
  pageSizeOptions = [10, 20, 50, 100],
  className = "",
}) => {
  if (totalPages <= 1 && total === 0) return null;

  const startRecord = total !== null ? Math.min((page - 1) * limit + 1, total) : null;
  const endRecord = total !== null ? Math.min(page * limit, total) : null;

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const delta = 1; // Number of pages around current page

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (page - delta > 2) {
      pages.push("ellipsis-1");
    }

    const start = Math.max(2, page - delta);
    const end = Math.min(totalPages - 1, page + delta);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page + delta < totalPages - 1) {
      pages.push("ellipsis-2");
    }

    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200/80 rounded-b-xl text-xs text-slate-600 ${className}`}
      aria-label="Pagination Navigation"
    >
      {/* Record info & page size */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        {total !== null && (
          <span className="text-slate-500 font-medium">
            Showing <strong className="text-slate-800 font-bold">{startRecord}–{endRecord}</strong> of{" "}
            <strong className="text-slate-800 font-bold">{total}</strong> records
          </span>
        )}

        {onLimitChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-slate-400 text-[11px]">Per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0a2342] focus:ring-1 focus:ring-[#0a2342]"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
        >
          <CaretLeft size={13} weight="bold" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Page buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (typeof p === "string") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-slate-400 font-bold select-none"
                >
                  …
                </span>
              );
            }
            const isActive = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={isActive ? "page" : undefined}
                className={`min-w-[30px] h-7 px-2 rounded-lg text-xs font-bold transition ${
                  isActive
                    ? "bg-[#0a2342] text-white shadow-xs"
                    : "border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
        >
          <span className="hidden sm:inline">Next</span>
          <CaretRight size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
