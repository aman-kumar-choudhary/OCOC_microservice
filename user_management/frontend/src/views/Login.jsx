import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { roleDashboardPath } from "@/utils/roleDashboard";
import LegalModal from "@/components/LegalModal";
import {
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formReady, setFormReady] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState("terms");

  useEffect(() => {
    const timer = setTimeout(() => setFormReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const claims = await login({ username: email.trim(), password });
      navigate(roleDashboardPath(claims?.realm_access?.roles), {
        replace: true,
      });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`login-view ${formReady ? "is-ready" : ""}`}>
      {/* Brand */}
      <div className="login-brand">
        <div className="login-brand-icon">
          <ShieldCheck size={22} />
        </div>
        <div className="login-brand-text">
          <span className="login-brand-name">OCOC</span>
          <span className="login-brand-sub">Identity Platform</span>
        </div>
      </div>

      {/* Welcome text */}
      <div className="login-welcome">
        <h2 id="login-heading" className="login-title">
          Welcome Back
        </h2>
        <p className="login-subtitle">
          Sign in to access the campus operations dashboard
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div id="login-error" className="login-error" role="alert">
          <div className="login-error-bar"></div>
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form
        id="login-form"
        onSubmit={handleLogin}
        className="login-form"
        autoComplete="on"
      >
        {/* Email / University ID */}
        <div className="field-group">
          <label htmlFor="login-email" className="field-label">
            Email / University ID
          </label>
          <div className="field-input-wrap">
            <div className="field-icon">
              <Mail size={18} />
            </div>
            <input
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="text"
              required
              className="field-input"
              placeholder="username or email"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Password */}
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="login-password" className="field-label">
              Password
            </label>
            <Link
              id="forgot-password-link"
              to="/forgot-password"
              className="field-link"
            >
              Forgot?
            </Link>
          </div>
          <div className="field-input-wrap">
            <div className="field-icon">
              <Lock size={18} />
            </div>
            <input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              required
              className="field-input"
              placeholder="password"
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              id="toggle-password"
              className="field-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          id="login-submit"
          type="submit"
          className="login-btn"
          disabled={isLoading}
        >
          {!isLoading ? (
            <>
              <span>Sign In</span>
              <ArrowRight size={18} className="login-btn-arrow" />
            </>
          ) : (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span>Authenticating…</span>
            </>
          )}
        </button>
      </form>

      {/* Trust badge & legal */}
      <div className="login-trust">
        <ShieldCheck size={14} className="login-trust-icon" />
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
          to="/register"
          style={{
            color: "#8795a8",
            textDecoration: "underline",
            fontWeight: 500,
          }}
        >
          Register
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

export default Login;
