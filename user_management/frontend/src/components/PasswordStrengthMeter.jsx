import React from "react";
import {
  CheckCircle2,
  Circle,
  ShieldCheck,
  ShieldAlert,
  Shield,
} from "lucide-react";

export const PasswordStrengthMeter = ({
  password = "",
  confirmPassword = null,
}) => {
  const hasMinLength = password.length >= 8 && password.length <= 128;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&#]/.test(password);

  const checks = [
    { label: "8–128 characters", valid: hasMinLength },
    { label: "Uppercase letter (A-Z)", valid: hasUpper },
    { label: "Lowercase letter (a-z)", valid: hasLower },
    { label: "Number (0-9)", valid: hasNumber },
    { label: "Special symbol (@$!%*?&#)", valid: hasSpecial },
  ];
  const passedCount = checks.filter((c) => c.valid).length;

  let strengthLabel = "Very Weak";
  let strengthColor = "bg-red-500";
  let textColor = "text-red-600";
  let percent = 20;

  if (passedCount === 5) {
    strengthLabel = "Strong";
    strengthColor = "bg-emerald-500";
    textColor = "text-emerald-700";
    percent = 100;
  } else if (passedCount === 4) {
    strengthLabel = "Good";
    strengthColor = "bg-amber-500";
    textColor = "text-amber-700";
    percent = 80;
  } else if (passedCount === 3) {
    strengthLabel = "Fair";
    strengthColor = "bg-orange-500";
    textColor = "text-orange-700";
    percent = 60;
  } else if (passedCount >= 1) {
    strengthLabel = "Weak";
    strengthColor = "bg-red-400";
    textColor = "text-red-600";
    percent = 40;
  } else {
    percent = 0;
  }

  const isMatching =
    confirmPassword !== null &&
    confirmPassword.length > 0 &&
    confirmPassword === password;

  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs animate-fade-in">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-slate-600 flex items-center gap-1">
            <Shield size={12} className={textColor} />
            Password Strength:
          </span>
          <span
            className={`font-extrabold uppercase tracking-wider ${textColor}`}
          >
            {password ? strengthLabel : "Not set"}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${password ? percent : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Criteria Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        {checks.map((check, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-1.5 text-[11px] transition-colors ${
              check.valid ? "text-emerald-700 font-semibold" : "text-slate-400"
            }`}
          >
            {check.valid ? (
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            ) : (
              <Circle size={13} className="text-slate-300 shrink-0" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>

      {/* Confirm Match Status */}
      {confirmPassword !== null && (
        <div className="border-t border-slate-200/70 pt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Password confirmation:</span>
          {confirmPassword ? (
            isMatching ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600" />{" "}
                Passwords match
              </span>
            ) : (
              <span className="text-red-600 font-bold flex items-center gap-1">
                <ShieldAlert size={13} className="text-red-500" /> Passwords do
                not match
              </span>
            )
          ) : (
            <span className="text-slate-400 italic">
              Re-enter password above
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
