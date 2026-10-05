import React from "react";
import { Tray } from "@phosphor-icons/react";

export const EmptyState = ({
  icon: Icon = Tray,
  title = "No records found",
  description = "No data is available for this view.",
  action = null,
  className = "",
}) => {
  return (
    <div
      className={`p-10 text-center flex flex-col items-center justify-center space-y-2.5 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-1">
        <Icon size={24} weight="duotone" />
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
