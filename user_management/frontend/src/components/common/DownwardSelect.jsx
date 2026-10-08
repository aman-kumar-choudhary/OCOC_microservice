import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A compact select control whose option list is deliberately anchored below
 * its trigger. Native select menus choose their opening direction per browser,
 * which made the access-management forms open upward near the bottom of a card.
 */
export default function DownwardSelect({
  value,
  onChange,
  options,
  placeholder,
  required = false,
  className = "",
  ariaLabel,
  searchable = false,
  searchPlaceholder = "Search...",
  onSearch,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value);

  const visibleOptions = useMemo(() => {
    if (onSearch || !searchable || !query.trim()) return options;
    const normalizedQuery = query.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [onSearch, options, query, searchable]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!onSearch || !isOpen) return undefined;
    const timeout = setTimeout(() => onSearch(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [isOpen, onSearch, query]);

  const choose = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className="flex h-full w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      >
        <span className={selected ? "truncate" : "truncate text-slate-400"}>
          {selected?.label || placeholder}
        </span>
        <CaretDown size={16} weight="bold" className="ml-2 shrink-0" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {searchable && (
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2">
              <label className="sr-only" htmlFor={`${ariaLabel}-search`}>{searchPlaceholder}</label>
              <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2">
                <MagnifyingGlass size={15} className="shrink-0 text-slate-400" />
                <input
                  id={`${ariaLabel}-search`}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 min-w-0 w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>
          )}
          {visibleOptions.map((option) => (
            <button
              key={option.value || "__empty"}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => choose(option.value)}
              className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
                option.value === value ? "bg-slate-100 font-medium text-slate-950" : "text-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
          {visibleOptions.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500">
              {onSearch && !query.trim() ? "Type a name or email to find a user." : "No matching options."}
            </p>
          )}
        </div>
      )}

      {required && <input tabIndex={-1} className="sr-only" value={value} onChange={() => {}} required aria-hidden="true" />}
    </div>
  );
}
