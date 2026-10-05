import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, Warning, Info, X } from "@phosphor-icons/react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg, duration) => addToast(msg, "success", duration),
    error: (msg, duration) => addToast(msg, "error", duration),
    warning: (msg, duration) => addToast(msg, "warning", duration),
    info: (msg, duration) => addToast(msg, "info", duration),
  };

  const getToastIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle size={20} weight="fill" className="text-emerald-500 shrink-0" />;
      case "error":
        return <XCircle size={20} weight="fill" className="text-rose-500 shrink-0" />;
      case "warning":
        return <Warning size={20} weight="fill" className="text-amber-500 shrink-0" />;
      default:
        return <Info size={20} weight="fill" className="text-sky-500 shrink-0" />;
    }
  };

  const getToastStyles = (type) => {
    switch (type) {
      case "success":
        return "border-emerald-200 bg-emerald-50/95 text-emerald-900";
      case "error":
        return "border-rose-200 bg-rose-50/95 text-rose-900";
      case "warning":
        return "border-amber-200 bg-amber-50/95 text-amber-900";
      default:
        return "border-sky-200 bg-sky-50/95 text-sky-900";
    }
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2 sm:p-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-slide-in-right ${getToastStyles(
              t.type
            )}`}
            role="alert"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {getToastIcon(t.type)}
              <span className="text-xs font-bold leading-snug break-words">
                {t.message}
              </span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      toast: {
        success: (m) => console.log("[Toast Success]", m),
        error: (m) => console.error("[Toast Error]", m),
        warning: (m) => console.warn("[Toast Warning]", m),
        info: (m) => console.info("[Toast Info]", m),
      },
      addToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
};

export default ToastContext;
