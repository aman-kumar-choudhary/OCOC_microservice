import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "@/services/api";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import LegalModal from "@/components/LegalModal";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Envelope,
  Eye,
  EyeSlash,
  Key,
  Lock,
  Shield,
  ShieldCheck,
  SpinnerGap
} from "@phosphor-icons/react";
export const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState("terms");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFormReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const stepLabel = () => {
    switch (step) {
      case 1:
        return "Verify Email";
      case 2:
        return "Enter OTP";
      case 3:
        return "New Password";
      case 4:
        return "Complete";
      default:
        return "";
    }
  };

  const stepProgress = Math.min(step, 3);

  const requestOTP = async (e) => {
    if (e) e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Failed to request OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/verify-otp", { email, otp });
      setResetToken(data.data.reset_token);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,128}$/;
    if (!passwordRegex.test(newPassword)) {
      setError(
        "Password must be 8-128 chars, with uppercase, lowercase, number, and special symbol.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", {
        email,
        reset_token: resetToken,
        new_password: newPassword,
      });
      setStep(4);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Failed to reset password",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`forgot-view ${formReady ? "is-ready" : ""}`}>
      {/* Top bar: Back + Step indicator */}
      <div className="forgot-topbar">
        <Link id="back-to-login" to="/login" className="forgot-back">
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </Link>
        {step <= 3 && (
          <div className="forgot-step-badge">
            <span className="forgot-step-num">{stepProgress}</span>
            <span className="forgot-step-sep">/</span>
            <span className="forgot-step-total">3</span>
            <span className="forgot-step-label">{stepLabel()}</span>
          </div>
        )}
      </div>

      {/* Step progress bar */}
      {step <= 3 && (
        <div className="forgot-progress">
          <div className="forgot-progress-track">
            <div
              className="forgot-progress-fill"
              style={{ width: `${(stepProgress / 3) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div id="forgot-error" className="forgot-error" role="alert">
          <div className="forgot-error-bar"></div>
          <span>{error}</span>
        </div>
      )}

      {/* ═══ Step 1: Request OTP ═══ */}
      {step === 1 && (
        <form id="forgot-step1" onSubmit={requestOTP} className="forgot-step">
          <div className="step-header">
            <div className="step-icon-wrap step-icon-mail">
              <Envelope size={24} />
            </div>
            <h2 className="step-title">Reset Password</h2>
            <p className="step-desc">
              Enter your registered university email address. If an active
              account matches, we'll send a 6-digit one-time password (OTP)
              valid for 10 minutes.
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="forgot-email" className="field-label">
              Email Address
            </label>
            <div className="field-input-wrap">
              <div className="field-icon">
                <Envelope size={18} />
              </div>
              <input
                id="forgot-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="field-input"
                placeholder="your.email@dsvv.ac.in"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            id="forgot-submit-email"
            type="submit"
            className="forgot-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <SpinnerGap className="animate-spin" size={18} />
                <span>Sending…</span>
              </>
            ) : (
              <>
                <span>Send Reset OTP</span>
                <ArrowRight size={18} className="forgot-btn-arrow" />
              </>
            )}
          </button>
        </form>
      )}

      {/* ═══ Step 2: Verify OTP ═══ */}
      {step === 2 && (
        <form id="forgot-step2" onSubmit={verifyOTP} className="forgot-step">
          <div className="step-header">
            <div className="step-icon-wrap step-icon-key">
              <Key size={24} />
            </div>
            <h2 className="step-title">Check Your Email</h2>
            <p className="step-desc">
              We've sent a 6-digit OTP to <strong>{email}</strong>. It expires
              in 10 minutes.
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="forgot-otp" className="field-label">
              Enter OTP
            </label>
            <div className="field-input-wrap">
              <div className="field-icon">
                <Key size={18} />
              </div>
              <input
                id="forgot-otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                className="field-input otp-input"
                placeholder="— — — — — —"
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            id="forgot-submit-otp"
            type="submit"
            className="forgot-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <SpinnerGap className="animate-spin" size={18} />
                <span>Verifying…</span>
              </>
            ) : (
              <>
                <span>Verify OTP</span>
                <ArrowRight size={18} className="forgot-btn-arrow" />
              </>
            )}
          </button>

          <button
            type="button"
            className="forgot-resend"
            onClick={() => requestOTP()}
            disabled={isLoading}
          >
            <ArrowCounterClockwise size={14} />
            <span>Resend OTP</span>
          </button>
        </form>
      )}

      {/* ═══ Step 3: New Password ═══ */}
      {step === 3 && (
        <form
          id="forgot-step3"
          onSubmit={resetPassword}
          className="forgot-step"
        >
          <div className="step-header">
            <div className="step-icon-wrap step-icon-lock">
              <Lock size={24} />
            </div>
            <h2 className="step-title">Create New Password</h2>
            <p className="step-desc">
              Your new password must be at least 8 characters long and should be
              different from your previous password.
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="forgot-new-password" className="field-label">
              New Password
            </label>
            <div className="field-input-wrap">
              <div className="field-icon">
                <Lock size={18} />
              </div>
              <input
                id="forgot-new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type={showNewPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={128}
                className="field-input"
                placeholder="8+ characters, complex"
                autoComplete="new-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="forgot-confirm-password" className="field-label">
              Confirm Password
            </label>
            <div className="field-input-wrap">
              <div className="field-icon">
                <Lock size={18} />
              </div>
              <input
                id="forgot-confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                className="field-input"
                placeholder="Re-enter new password"
                autoComplete="new-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Password Strength Meter & Real-Time Checklist */}
          <PasswordStrengthMeter
            password={newPassword}
            confirmPassword={confirmPassword}
          />

          <button
            id="forgot-submit-password"
            type="submit"
            className="forgot-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <SpinnerGap className="animate-spin" size={18} />
                <span>Resetting…</span>
              </>
            ) : (
              <>
                <span>Reset Password</span>
                <ArrowRight size={18} className="forgot-btn-arrow" />
              </>
            )}
          </button>
        </form>
      )}

      {/* ═══ Step 4: Success ═══ */}
      {step === 4 && (
        <div id="forgot-success" className="forgot-step forgot-success">
          <div className="success-ring">
            <div className="success-icon-wrap">
              <CheckCircle size={40} />
            </div>
          </div>
          <h2 className="step-title text-center">Password Reset Complete</h2>
          <p className="step-desc text-center">
            You can now sign in with your new password.
          </p>
          <Link to="/login" className="forgot-btn no-underline">
            <span>Go to Login</span>
            <ArrowRight size={18} className="forgot-btn-arrow" />
          </Link>
        </div>
      )}

      {/* Footer trust badge & legal links */}
      <div className="forgot-trust">
        <ShieldCheck size={14} className="forgot-trust-icon" />
        <span>Secured by Keycloak SSO · TLS Encrypted</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          marginTop: "12px",
          fontSize: "11px",
          color: "#8795a8",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setLegalModalTab("terms");
            setLegalModalOpen(true);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#8795a8",
            textDecoration: "underline",
            fontWeight: 500,
            cursor: "pointer",
            fontSize: "11px",
          }}
        >
          Terms &amp; Conditions
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => {
            setLegalModalTab("privacy");
            setLegalModalOpen(true);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#8795a8",
            textDecoration: "underline",
            fontWeight: 500,
            cursor: "pointer",
            fontSize: "11px",
          }}
        >
          Privacy Policy
        </button>
        <span>·</span>
        <Link
          to="/login"
          style={{
            color: "#8795a8",
            textDecoration: "underline",
            fontWeight: 500,
          }}
        >
          Back to Sign In
        </Link>
      </div>

      {/* Interactive Legal Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalModalTab}
      />
    </div>
  );
};

export default ForgotPassword;
