<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useDark, useToggle } from '@vueuse/core'

import dsvvLogo from '@/assets/Dsvv_logo.png'
import gurudevImg from '@/assets/Gurudev.png'
import mashalImg from '@/assets/mashal.png'
import campusBg from '@/assets/background_image.png'

const isDark = useDark({ selector: 'html', attribute: 'data-theme', valueDark: 'dark', valueLight: 'light' })
const toggleDark = useToggle(isDark)
</script>

<template>
  <div class="auth-shell">
    <!-- ═══ Single Unified Background ═══ -->
    <img :src="campusBg" alt="" class="auth-bg-img" aria-hidden="true" />
    <div class="auth-bg-overlay" aria-hidden="true"></div>

    <!-- DSVV Logo — Fixed Top-Left -->
    <div class="dsvv-fixed" id="dsvv-logo-fixed">
      <img :src="dsvvLogo" alt="DSVV Logo" class="dsvv-fixed-logo" />
      <div class="dsvv-fixed-text">
        <span>Dev Sanskriti</span>
        <span>Vishwavidyalaya</span>
      </div>
    </div>

    <!-- Theme Toggle — Fixed Top-Right -->
    <button id="theme-toggle" @click="toggleDark()" class="auth-theme-toggle"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
      <Sun v-if="isDark" :size="18" />
      <Moon v-else :size="18" />
    </button>

    <!-- ═══ Main Content ═══ -->
    <div class="auth-main">
      <!-- Left: Branding -->
      <div class="brand-col">
        <div class="ococ-hero">
          <div class="ococ-text-row">
            <span class="ococ-char">O</span>
            <span class="ococ-char">C</span>
            <div class="ococ-mashal-wrap">
              <img :src="mashalImg" alt="Mashal" class="ococ-mashal-img" />
              <div class="ococ-mashal-glow"></div>
            </div>
            <span class="ococ-char">O</span>
            <span class="ococ-char">C</span>
          </div>
          <span class="ococ-sub">One Card · One Campus</span>
        </div>

        <div class="brand-gurudev">
          <img :src="gurudevImg" alt="Gurudev" class="brand-gurudev-img" />
        </div>

        <div class="brand-tagline">
          <span class="tagline-gold">One Identity.</span>
          <span>One Campus.</span>
          <span>One Experience.</span>
        </div>
      </div>

      <!-- Right: Auth Card -->
      <div class="auth-col">
        <div class="auth-card animate-fade-in">
          <slot />
        </div>
        <div class="auth-version">v1.0</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="auth-footer">
      <span>© DSVV • OCOC</span>
    </div>

    <!-- Floating particles -->
    <div class="auth-particles" aria-hidden="true">
      <div class="particle p1"></div>
      <div class="particle p2"></div>
      <div class="particle p3"></div>
      <div class="particle p4"></div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Shell ─── */
.auth-shell {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ─── Single Unified Background ─── */
.auth-bg-img {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.auth-bg-overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    160deg,
    rgba(6, 24, 46, 0.94) 0%,
    rgba(10, 35, 66, 0.89) 35%,
    rgba(12, 38, 70, 0.86) 65%,
    rgba(6, 24, 46, 0.93) 100%
  );
  backdrop-filter: blur(2px);
}

/* ─── DSVV Logo Fixed Top-Left ─── */
.dsvv-fixed {
  position: fixed;
  top: 1.25rem;
  left: 1.5rem;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dsvv-fixed-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
}

.dsvv-fixed-text {
  display: flex;
  flex-direction: column;
}

.dsvv-fixed-text span {
  font-family: 'Manrope', sans-serif;
  font-size: 1.82rem;
  font-weight: 700;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.03em;
}

/* ─── Theme Toggle ─── */
.auth-theme-toggle {
  position: fixed;
  top: 1.25rem;
  right: 1.5rem;
  z-index: 20;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.auth-theme-toggle:hover {
  transform: scale(1.1);
  background: rgba(255, 255, 255, 0.18);
}

/* ─── Main Content ─── */
.auth-main {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4rem;
  width: 100%;
  max-width: 1100px;
  padding: 5rem 2rem 3rem;
}

/* ─── Brand Column (Left) ─── */
.brand-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
  color: #fff;
}

/* OCOC Hero with Mashal */
.ococ-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.ococ-text-row {
  display: flex;
  align-items: center;
}

.ococ-char {
  font-family: 'Manrope', sans-serif;
  font-size: 3.2rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #f5bd19;
  text-shadow: 0 2px 16px rgba(245, 189, 25, 0.4);
  line-height: 1;
}

.ococ-mashal-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 0 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ococ-mashal-img {
  width: 62px;
  height: 62px;
  object-fit: contain;
  border-radius: 50%;
  border: 2px solid rgba(245, 189, 25, 0.4);
  box-shadow: 0 0 20px rgba(245, 189, 25, 0.3);
  animation: mashal-pulse 3s ease-in-out infinite;
}

.ococ-mashal-glow {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 189, 25, 0.2) 0%, transparent 70%);
  animation: mashal-glow 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes mashal-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(245, 189, 25, 0.3); }
  50% { transform: scale(1.05); box-shadow: 0 0 32px rgba(245, 189, 25, 0.5); }
}

@keyframes mashal-glow {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

.ococ-sub {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

/* Gurudev */
.brand-gurudev {
  width: 200px;
  height: 150px;
  border-radius: 1rem;
  overflow: hidden;
  border: 2px solid rgba(245, 189, 25, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.brand-gurudev-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Tagline */
.brand-tagline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.brand-tagline span {
  font-family: 'Manrope', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
}

.tagline-gold {
  color: #f5bd19 !important;
}

/* ─── Auth Column (Right) ─── */
.auth-col {
  flex: 0 0 440px;
  max-width: 440px;
}

.auth-card {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 1.25rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18), 0 1px 3px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(16px);
  transition: box-shadow 0.3s ease;
}

.auth-card:hover {
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.08);
}

.auth-version {
  text-align: right;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.75rem;
  padding-right: 0.25rem;
  letter-spacing: 0.05em;
}

/* ─── Footer ─── */
.auth-footer {
  position: fixed;
  bottom: 1rem;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 10;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.3);
}

/* ─── Floating Particles ─── */
.auth-particles {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: rgba(245, 189, 25, 0.08);
}

.p1 { width: 160px; height: 160px; top: 8%; right: -30px; animation: float-drift 8s ease-in-out infinite; }
.p2 { width: 100px; height: 100px; bottom: 15%; left: 5%; animation: float-drift 12s ease-in-out infinite 2s; }
.p3 { width: 50px; height: 50px; top: 50%; right: 25%; background: rgba(10, 35, 66, 0.08); animation: float-drift 10s ease-in-out infinite 1s; }
.p4 { width: 70px; height: 70px; bottom: 30%; right: 10%; background: rgba(10, 35, 66, 0.05); animation: float-drift 9s ease-in-out infinite 1.5s; }

@keyframes float-drift {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

/* ─── Dark Mode Card Override ─── */
:global([data-theme="dark"]) .auth-card {
  background: rgba(16, 40, 66, 0.9);
  border-color: rgba(41, 66, 94, 0.6);
}

/* ═══════════════════════════════════════════
   RESPONSIVE — Tablet (768px – 1024px)
   ═══════════════════════════════════════════ */
@media (max-width: 1024px) {
  .auth-main {
    flex-direction: column;
    gap: 2rem;
    padding: 5.5rem 1.5rem 3rem;
    justify-content: center;
  }

  .brand-col {
    gap: 1.25rem;
  }

  .ococ-char {
    font-size: 2.6rem;
  }

  .ococ-mashal-wrap {
    width: 60px;
    height: 60px;
  }

  .ococ-mashal-img {
    width: 52px;
    height: 52px;
  }

  .brand-gurudev {
    width: 170px;
    height: 128px;
  }

  .brand-tagline span {
    font-size: 0.95rem;
  }

  .auth-col {
    flex: 0 0 auto;
    max-width: 440px;
    width: 100%;
  }
}

/* ═══════════════════════════════════════════
   RESPONSIVE — Mobile (< 768px)
   ═══════════════════════════════════════════ */
@media (max-width: 768px) {
  .dsvv-fixed {
    top: 0.75rem;
    left: 1rem;
    gap: 0.5rem;
  }

  .dsvv-fixed-logo {
    width: 38px;
    height: 38px;
  }

  .dsvv-fixed-text span {
    font-size: 0.7rem;
  }

  .auth-theme-toggle {
    top: 0.75rem;
    right: 1rem;
    width: 36px;
    height: 36px;
  }

  .auth-main {
    padding: 4.5rem 1rem 3rem;
    gap: 1.5rem;
  }

  .brand-col {
    gap: 1rem;
  }

  .ococ-char {
    font-size: 2rem;
  }

  .ococ-mashal-wrap {
    width: 48px;
    height: 48px;
    margin: 0 0.2rem;
  }

  .ococ-mashal-img {
    width: 42px;
    height: 42px;
  }

  .ococ-sub {
    font-size: 0.7rem;
    letter-spacing: 0.1em;
  }

  .brand-gurudev {
    display: none;
  }

  .brand-tagline {
    display: none;
  }

  .auth-col {
    max-width: 100%;
    width: 100%;
  }

  .auth-card {
    padding: 2rem 1.25rem;
    border-radius: 1rem;
  }
}

/* ═══════════════════════════════════════════
   RESPONSIVE — Small Mobile (< 400px)
   ═══════════════════════════════════════════ */
@media (max-width: 400px) {
  .dsvv-fixed-text {
    display: none;
  }

  .ococ-char {
    font-size: 1.6rem;
  }

  .ococ-mashal-wrap {
    width: 40px;
    height: 40px;
  }

  .ococ-mashal-img {
    width: 36px;
    height: 36px;
  }

  .auth-main {
    padding: 4rem 0.75rem 3rem;
  }

  .auth-card {
    padding: 1.75rem 1rem;
  }
}
</style>
