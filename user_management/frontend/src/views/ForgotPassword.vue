<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import api from '@/services/api'
import { 
  Mail, KeyRound, Lock, Loader2, ArrowLeft, CheckCircle2, 
  ShieldCheck, ArrowRight, RotateCcw 
} from 'lucide-vue-next'

const step = ref<1 | 2 | 3 | 4>(1)
const email = ref('')
const otp = ref('')
const resetToken = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const isLoading = ref(false)
const error = ref('')
const formReady = ref(false)

const stepLabel = computed(() => {
  switch (step.value) {
    case 1: return 'Verify Email'
    case 2: return 'Enter OTP'
    case 3: return 'New Password'
    case 4: return 'Complete'
    default: return ''
  }
})

const stepProgress = computed(() => {
  return Math.min(step.value, 3)
})

onMounted(() => {
  nextTick(() => { formReady.value = true })
})

async function requestOTP() {
  if (!email.value) return
  isLoading.value = true
  error.value = ''
  try {
    await api.post('/auth/forgot-password', { email: email.value })
    step.value = 2
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to request OTP'
  } finally {
    isLoading.value = false
  }
}

async function verifyOTP() {
  if (!otp.value || otp.value.length !== 6) {
    error.value = 'Please enter a valid 6-digit OTP'
    return
  }
  isLoading.value = true
  error.value = ''
  try {
    const { data } = await api.post('/auth/verify-otp', { email: email.value, otp: otp.value })
    resetToken.value = data.data.reset_token
    step.value = 3
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Invalid OTP'
  } finally {
    isLoading.value = false
  }
}

async function resetPassword() {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,12}$/
  if (!passwordRegex.test(newPassword.value)) {
    error.value = 'Password must be 8-12 chars, with uppercase, lowercase, number, and special symbol.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  isLoading.value = true
  error.value = ''
  try {
    await api.post('/auth/reset-password', { 
      email: email.value, 
      reset_token: resetToken.value, 
      new_password: newPassword.value 
    })
    step.value = 4 // Success
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to reset password'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="forgot-view" :class="{ 'is-ready': formReady }">
    <!-- Top bar: Back + Step indicator -->
    <div class="forgot-topbar">
      <router-link id="back-to-login" to="/login" class="forgot-back">
        <ArrowLeft :size="16" />
        <span>Back to Login</span>
      </router-link>
      <div class="forgot-step-badge" v-if="step <= 3">
        <span class="forgot-step-num">{{ stepProgress }}</span>
        <span class="forgot-step-sep">/</span>
        <span class="forgot-step-total">3</span>
        <span class="forgot-step-label">{{ stepLabel }}</span>
      </div>
    </div>

    <!-- Step progress bar -->
    <div class="forgot-progress" v-if="step <= 3">
      <div class="forgot-progress-track">
        <div class="forgot-progress-fill" :style="{ width: `${(stepProgress / 3) * 100}%` }"></div>
      </div>
    </div>

    <!-- Error banner -->
    <Transition name="slide-down">
      <div v-if="error" id="forgot-error" class="forgot-error" role="alert">
        <div class="forgot-error-bar"></div>
        <span>{{ error }}</span>
      </div>
    </Transition>

    <!-- ═══ Step 1: Request OTP ═══ -->
    <Transition name="step" mode="out-in">
      <form v-if="step === 1" key="step1" id="forgot-step1" @submit.prevent="requestOTP" class="forgot-step">
        <div class="step-header">
          <div class="step-icon-wrap step-icon-mail">
            <Mail :size="24" />
          </div>
          <h2 class="step-title">Reset Password</h2>
          <p class="step-desc">Enter your email address and we'll send you a one-time password (OTP) to verify your identity.</p>
        </div>

        <div class="field-group">
          <label for="forgot-email" class="field-label">Email Address</label>
          <div class="field-input-wrap">
            <div class="field-icon">
              <Mail :size="18" />
            </div>
            <input 
              id="forgot-email"
              v-model="email" 
              type="email" 
              required 
              class="field-input" 
              placeholder="your.email@dsvv.ac.in" 
              autocomplete="email"
              :disabled="isLoading" 
            />
          </div>
        </div>

        <button id="forgot-submit-email" type="submit" class="forgot-btn" :disabled="isLoading">
          <template v-if="isLoading">
            <Loader2 class="animate-spin" :size="18" />
            <span>Sending…</span>
          </template>
          <template v-else>
            <span>Send Reset OTP</span>
            <ArrowRight :size="18" class="forgot-btn-arrow" />
          </template>
        </button>
      </form>

      <!-- ═══ Step 2: Verify OTP ═══ -->
      <form v-else-if="step === 2" key="step2" id="forgot-step2" @submit.prevent="verifyOTP" class="forgot-step">
        <div class="step-header">
          <div class="step-icon-wrap step-icon-key">
            <KeyRound :size="24" />
          </div>
          <h2 class="step-title">Check Your Email</h2>
          <p class="step-desc">
            We've sent a 6-digit OTP to <strong>{{ email }}</strong>. It expires in 10 minutes.
          </p>
        </div>

        <div class="field-group">
          <label for="forgot-otp" class="field-label">Enter OTP</label>
          <div class="field-input-wrap">
            <div class="field-icon">
              <KeyRound :size="18" />
            </div>
            <input 
              id="forgot-otp"
              v-model="otp" 
              type="text" 
              inputmode="numeric"
              maxlength="6" 
              required 
              class="field-input otp-input" 
              placeholder="— — — — — —" 
              :disabled="isLoading" 
            />
          </div>
        </div>

        <button id="forgot-submit-otp" type="submit" class="forgot-btn" :disabled="isLoading">
          <template v-if="isLoading">
            <Loader2 class="animate-spin" :size="18" />
            <span>Verifying…</span>
          </template>
          <template v-else>
            <span>Verify OTP</span>
            <ArrowRight :size="18" class="forgot-btn-arrow" />
          </template>
        </button>

        <button type="button" class="forgot-resend" @click="requestOTP" :disabled="isLoading">
          <RotateCcw :size="14" />
          <span>Resend OTP</span>
        </button>
      </form>

      <!-- ═══ Step 3: New Password ═══ -->
      <form v-else-if="step === 3" key="step3" id="forgot-step3" @submit.prevent="resetPassword" class="forgot-step">
        <div class="step-header">
          <div class="step-icon-wrap step-icon-lock">
            <Lock :size="24" />
          </div>
          <h2 class="step-title">Create New Password</h2>
          <p class="step-desc">Your new password must be at least 8 characters long and should be different from your previous password.</p>
        </div>

        <div class="field-group">
          <label for="forgot-new-password" class="field-label">New Password</label>
          <div class="field-input-wrap">
            <div class="field-icon">
              <Lock :size="18" />
            </div>
            <input 
              id="forgot-new-password"
              v-model="newPassword" 
              type="password" 
              required 
              minlength="8"
              maxlength="12" 
              class="field-input" 
              placeholder="8-12 chars, strong" 
              autocomplete="new-password"
              :disabled="isLoading" 
            />
          </div>
        </div>

        <div class="field-group">
          <label for="forgot-confirm-password" class="field-label">Confirm Password</label>
          <div class="field-input-wrap">
            <div class="field-icon">
              <Lock :size="18" />
            </div>
            <input 
              id="forgot-confirm-password"
              v-model="confirmPassword" 
              type="password" 
              required 
              minlength="8" 
              class="field-input" 
              placeholder="••••••••" 
              autocomplete="new-password"
              :disabled="isLoading" 
            />
          </div>
        </div>

        <button id="forgot-submit-password" type="submit" class="forgot-btn" :disabled="isLoading">
          <template v-if="isLoading">
            <Loader2 class="animate-spin" :size="18" />
            <span>Resetting…</span>
          </template>
          <template v-else>
            <span>Reset Password</span>
            <ArrowRight :size="18" class="forgot-btn-arrow" />
          </template>
        </button>
      </form>

      <!-- ═══ Step 4: Success ═══ -->
      <div v-else key="step4" id="forgot-success" class="forgot-step forgot-success">
        <div class="success-ring">
          <div class="success-icon-wrap">
            <CheckCircle2 :size="40" />
          </div>
        </div>
        <h2 class="step-title" style="text-align: center;">Password Reset Complete</h2>
        <p class="step-desc" style="text-align: center;">You can now sign in with your new password.</p>
        <router-link to="/login" class="forgot-btn" style="text-decoration: none;">
          <span>Go to Login</span>
          <ArrowRight :size="18" class="forgot-btn-arrow" />
        </router-link>
      </div>
    </Transition>

    <!-- Footer trust badge -->
    <div class="forgot-trust">
      <ShieldCheck :size="14" class="forgot-trust-icon" />
      <span>OCOC Identity Protected</span>
    </div>
  </div>
</template>

<style scoped>
/* ─── Forgot View ─── */
.forgot-view {
  display: flex;
  flex-direction: column;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.forgot-view.is-ready {
  opacity: 1;
  transform: translateY(0);
}

/* Top bar */
.forgot-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.forgot-back {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.forgot-back:hover {
  color: #f5bd19;
}

.forgot-step-badge {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  background: rgba(245, 189, 25, 0.08);
  font-size: 0.7rem;
  font-weight: 700;
}

.forgot-step-num {
  color: #f5bd19;
}

.forgot-step-sep,
.forgot-step-total {
  color: var(--text-muted);
}

.forgot-step-label {
  margin-left: 0.35rem;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Progress bar */
.forgot-progress {
  margin-bottom: 1.5rem;
}

.forgot-progress-track {
  width: 100%;
  height: 3px;
  border-radius: 3px;
  background: var(--border-light);
  overflow: hidden;
}

.forgot-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #f5bd19, #d99e00);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Error */
.forgot-error {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.82rem;
  font-weight: 500;
  background: var(--status-error-bg);
  color: var(--status-error);
  margin-bottom: 1.25rem;
}

.forgot-error-bar {
  width: 3px;
  align-self: stretch;
  border-radius: 3px;
  background: var(--status-error);
  flex-shrink: 0;
}

/* Step transitions */
.step-enter-active {
  animation: step-in 0.35s ease-out;
}

.step-leave-active {
  animation: step-out 0.2s ease-in;
}

@keyframes step-in {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes step-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-24px); }
}

/* Step header */
.forgot-step {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.step-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.step-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
}

.step-icon-mail {
  background: rgba(245, 189, 25, 0.12);
  color: #d99e00;
}

.step-icon-key {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.step-icon-lock {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.step-title {
  font-family: 'Manrope', sans-serif;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  letter-spacing: -0.02em;
}

.step-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.55;
}

.step-desc strong {
  color: var(--text-main);
}

/* Field groups — same as Login */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-main);
}

.field-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 0.875rem;
  display: flex;
  color: var(--text-muted);
  pointer-events: none;
  transition: color 0.2s ease;
}

.field-input-wrap:focus-within .field-icon {
  color: #d99e00;
}

.field-input {
  width: 100%;
  min-height: 2.875rem;
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  background: var(--bg-input);
  color: var(--text-main);
  padding: 0 0.875rem 0 2.75rem;
  font-size: 0.875rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.field-input::placeholder {
  color: #8b99aa;
}

.field-input:focus {
  border-color: #d99e00;
  box-shadow: 0 0 0 3px rgba(245, 189, 25, 0.18);
  outline: none;
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.otp-input {
  text-align: center;
  font-size: 1.25rem;
  font-family: 'Manrope', monospace;
  letter-spacing: 0.5em;
  font-weight: 700;
  padding-left: 2.75rem;
  padding-right: 0.875rem;
}

/* Submit button */
.forgot-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 3rem;
  border: none;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #f5bd19 0%, #d99e00 100%);
  color: #0a2342;
  font-size: 0.95rem;
  font-weight: 800;
  font-family: 'Manrope', sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(245, 189, 25, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.forgot-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(245, 189, 25, 0.38);
}

.forgot-btn:active:not(:disabled) {
  transform: translateY(0);
}

.forgot-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.forgot-btn-arrow {
  transition: transform 0.2s ease;
}

.forgot-btn:hover:not(:disabled) .forgot-btn-arrow {
  transform: translateX(4px);
}

/* Resend link */
.forgot-resend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s ease;
  padding: 0.5rem;
}

.forgot-resend:hover:not(:disabled) {
  color: #f5bd19;
}

.forgot-resend:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Success */
.forgot-success {
  align-items: center;
  padding-top: 1rem;
}

.success-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%);
  border: 2px solid rgba(16, 185, 129, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  animation: success-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.success-icon-wrap {
  color: #10b981;
}

@keyframes success-pop {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* Trust badge */
.forgot-trust {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.75rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  opacity: 0.7;
}

.forgot-trust-icon {
  color: #b87800;
}

/* Slide-down transition for errors */
.slide-down-enter-active {
  animation: slide-down 0.3s ease;
}

.slide-down-leave-active {
  animation: slide-down 0.2s ease reverse;
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
