<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')
const formReady = ref(false)

onMounted(() => {
  nextTick(() => { formReady.value = true })
})

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Please enter email and password'
    return
  }

  error.value = ''
  isLoading.value = true
  try {
    await authStore.login({ username: email.value, password: password.value })
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Login failed. Please check your credentials.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-view" :class="{ 'is-ready': formReady }">
    <!-- OCOC header badge -->
    <div class="login-brand">
      <!-- <div class="login-brand-icon">
        <ShieldCheck :size="24" />
      </div> -->
      <!-- <div class="login-brand-text">
        <span class="login-brand-name">OCOC</span>
      </div> -->
    </div>

    <div class="auth-tabs">
      <router-link to="/login" class="auth-tab active">Sign In</router-link>
      <router-link to="/register" class="auth-tab">Sign Up</router-link>
    </div>

    <!-- Welcome text -->
    <div class="login-welcome">
      <h2 id="login-heading" class="login-title">Welcome Back</h2>
      <p class="login-subtitle">Sign in to your account</p>
    </div>

    <!-- Error banner -->
    <Transition name="shake">
      <div v-if="error" id="login-error" class="login-error" role="alert">
        <div class="login-error-bar"></div>
        <span>{{ error }}</span>
      </div>
    </Transition>

    <!-- Login Form -->
    <form id="login-form" @submit.prevent="handleLogin" class="login-form" autocomplete="on">
      <!-- Email / University ID -->
      <div class="field-group">
        <label for="login-email" class="field-label">Email / University ID</label>
        <div class="field-input-wrap">
          <div class="field-icon">
            <Mail :size="18" />
          </div>
          <input
            id="login-email"
            v-model="email"
            type="text"
            required
            class="field-input"
            placeholder="username"
            autocomplete="username"
            :disabled="isLoading"
          />
        </div>
      </div>

      <!-- Password -->
      <div class="field-group">
        <div class="field-label-row">
          <label for="login-password" class="field-label">Password</label>
          <router-link id="forgot-password-link" to="/forgot-password" class="field-link">Forgot?</router-link>
        </div>
        <div class="field-input-wrap">
          <div class="field-icon">
            <Lock :size="18" />
          </div>
          <input
            id="login-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            class="field-input"
            placeholder="password"
            autocomplete="current-password"
            :disabled="isLoading"
          />
          <button
            type="button"
            id="toggle-password"
            class="field-toggle"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            tabindex="-1"
          >
            <EyeOff v-if="showPassword" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </div>

      <!-- Submit -->
      <button id="login-submit" type="submit" class="login-btn" :disabled="isLoading">
        <template v-if="!isLoading">
          <span>Sign In</span>
          <ArrowRight :size="18" class="login-btn-arrow" />
        </template>
        <template v-else>
          <Loader2 class="animate-spin" :size="18" />
          <span>Authenticating…</span>
        </template>
      </button>
    </form>

    <!-- Footer trust badge -->
    <!-- <div class="login-trust">
      <ShieldCheck :size="14" class="login-trust-icon" />
      <span>OCOC Identity Protected</span>
    </div> -->
  </div>
</template>

<style scoped>
/* ─── Login View ─── */
.login-view {
  display: flex;
  flex-direction: column;
  gap: 0;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.login-view.is-ready {
  opacity: 1;
  transform: translateY(0);
}

/* Brand header */
.login-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.7rem;
}

.login-brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #f5bd19 0%, #d99e00 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0a2342;
  box-shadow: 0 4px 14px rgba(245, 189, 25, 0.3);
}

/* Welcome */
.login-welcome {
  margin-bottom: 0.5rem;
}

.login-title {
  font-size: 1.65rem;
  font-weight: 800;
  color: #0c4b0f;
  margin: 0 0 0.35rem;
  align-items: center;
  justify-content: center;
}

.login-subtitle {
  font-size: 1.2rem;
  color: black;
  margin-top: 5px;
  align-items: center;
  justify-content: center;
}

/* Tabs */
.auth-tabs {
  display: flex;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-light);
}

.auth-tab {
  flex: 1;
  text-align: center;
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s ease;
}

.auth-tab:hover {
  color: #b87800;
}

.auth-tab.active {
  color: #d99e00;
  border-bottom-color: #d99e00;
}

/* Error */
.login-error {
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
  animation: shake 0.4s ease;
}

.login-error-bar {
  width: 3px;
  align-self: stretch;
  border-radius: 3px;
  background: var(--status-error);
  flex-shrink: 0;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-4px); }
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

/* Field groups */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-main);
}

.field-link {
  font-size: 0.75rem;
  font-weight: 600;
  color: #b87800;
  text-decoration: none;
  transition: color 0.15s ease;
}

.field-link:hover {
  color: #f5bd19;
  text-decoration: underline;
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
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

.field-toggle {
  position: absolute;
  right: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.field-toggle:hover {
  color: var(--text-main);
  background: rgba(10, 35, 66, 0.04);
}

/* Submit button */
.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 3rem;
  margin-top: 0.5rem;
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
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(245, 189, 25, 0.38);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.login-btn-arrow {
  transition: transform 0.2s ease;
}

.login-btn:hover:not(:disabled) .login-btn-arrow {
  transform: translateX(4px);
}

/* Trust badge */
.login-trust {
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

.login-trust-icon {
  color: #b87800;
}

/* Transition */
.shake-enter-active {
  animation: shake 0.4s ease;
}
</style>
