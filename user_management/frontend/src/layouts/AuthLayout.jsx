import React from 'react'
import dsvvLogo from '@/assets/Dsvv_logo.png'
import gurudevImg from '@/assets/Gurudev.png'
import mashalImg from '@/assets/mashal.png'
import campusBg from '@/assets/background_image.png'

export const AuthLayout = ({ children }) => {
  return (
    <div className="auth-shell">
      {/* ═══ Single Unified Background ═══ */}
      <img src={campusBg} alt="" className="auth-bg-img" aria-hidden="true" />
      <div className="auth-bg-overlay" aria-hidden="true"></div>

      {/* DSVV Logo — Fixed Top-Left */}
      <div className="dsvv-fixed" id="dsvv-logo-fixed">
        <img src={dsvvLogo} alt="DSVV Logo" className="dsvv-fixed-logo" />
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="auth-main">
        {/* Left: Branding */}
        <div className="brand-col">
          <div className="ococ-hero">
            <div className="ococ-text-row">
              <span className="ococ-char">O</span>
              <span className="ococ-char">C</span>
              <div className="ococ-mashal-wrap">
                <img src={mashalImg} alt="Mashal" className="ococ-mashal-img" />
                <div className="ococ-mashal-glow"></div>
              </div>
              <span className="ococ-char">O</span>
              <span className="ococ-char">C</span>
            </div>
            <span className="ococ-sub">One Card · One Campus</span>
          </div>

          <div className="brand-gurudev">
            <img src={gurudevImg} alt="Gurudev" className="brand-gurudev-img" />
          </div>

          <div className="brand-tagline">
            <span className="tagline-gold">One Identity.</span>
            <span>One Campus.</span>
            <span>One Experience.</span>
          </div>
        </div>

        {/* Right: Auth Card */}
        <div className="auth-col">
          <div className="auth-card animate-fade-in">
            {children}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="auth-footer">
        <span>© DSVV • OCOC</span>
      </div>

      {/* Floating particles */}
      <div className="auth-particles" aria-hidden="true">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
        <div className="particle p4"></div>
      </div>
    </div>
  )
}

export default AuthLayout
