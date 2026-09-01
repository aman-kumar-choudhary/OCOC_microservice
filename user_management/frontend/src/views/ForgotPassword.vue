<script setup lang="ts">
import { ref } from 'vue'
import api from '@/services/api'
import { Mail, KeyRound, Lock, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-vue-next'

const step = ref<1 | 2 | 3 | 4>(1)
const email = ref('')
const otp = ref('')
const resetToken = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const isLoading = ref(false)
const error = ref('')

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
  if (newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
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
  <div class="forgot-password">
    <div class="mb-6 flex items-center justify-between">
      <router-link to="/login" class="text-sm text-muted hover:text-primary flex items-center gap-1">
        <ArrowLeft :size="16" /> Back to Login
      </router-link>
      <div class="text-xs font-semibold px-2 py-1 rounded bg-[rgba(148,163,184,0.1)] text-muted">
        Step {{ step > 3 ? 3 : step }} / 3
      </div>
    </div>
    
    <div v-if="error" class="mb-4 p-3 rounded-lg text-sm bg-[var(--status-error-bg)] text-[var(--status-error)] flex items-center gap-2">
      {{ error }}
    </div>

    <!-- Step 1: Request OTP -->
    <form v-if="step === 1" @submit.prevent="requestOTP" class="animate-fade-in">
      <h2 class="text-xl font-bold mb-2">Reset Password</h2>
      <p class="text-sm text-muted mb-6">Enter your email address and we'll send you a one-time password (OTP) to reset your password.</p>
      
      <div class="form-group mb-6">
        <label class="form-label">Email Address</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <Mail :size="18" />
          </div>
          <input v-model="email" type="email" required class="form-input pl-10" placeholder="your.email@ococ.local" :disabled="isLoading" />
        </div>
      </div>
      
      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
        <span v-if="isLoading" class="flex items-center gap-2"><Loader2 class="animate-spin" :size="18" /> Sending...</span>
        <span v-else>Send Reset OTP</span>
      </button>
    </form>

    <!-- Step 2: Verify OTP -->
    <form v-else-if="step === 2" @submit.prevent="verifyOTP" class="animate-fade-in">
      <h2 class="text-xl font-bold mb-2">Check Your Email</h2>
      <p class="text-sm text-muted mb-6">We've sent a 6-digit OTP to <strong>{{ email }}</strong>. It expires in 10 minutes.</p>
      
      <div class="form-group mb-6">
        <label class="form-label">Enter OTP</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <KeyRound :size="18" />
          </div>
          <input v-model="otp" type="text" maxlength="6" required class="form-input pl-10 tracking-[0.5em] text-center font-mono text-lg" placeholder="------" :disabled="isLoading" />
        </div>
      </div>
      
      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
        <span v-if="isLoading" class="flex items-center gap-2"><Loader2 class="animate-spin" :size="18" /> Verifying...</span>
        <span v-else>Verify OTP</span>
      </button>
    </form>

    <!-- Step 3: New Password -->
    <form v-else-if="step === 3" @submit.prevent="resetPassword" class="animate-fade-in">
      <h2 class="text-xl font-bold mb-2">Create New Password</h2>
      <p class="text-sm text-muted mb-6">Your new password must be at least 8 characters long.</p>
      
      <div class="form-group mb-4">
        <label class="form-label">New Password</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <Lock :size="18" />
          </div>
          <input v-model="newPassword" type="password" required minlength="8" class="form-input pl-10" placeholder="••••••••" :disabled="isLoading" />
        </div>
      </div>

      <div class="form-group mb-6">
        <label class="form-label">Confirm Password</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <Lock :size="18" />
          </div>
          <input v-model="confirmPassword" type="password" required minlength="8" class="form-input pl-10" placeholder="••••••••" :disabled="isLoading" />
        </div>
      </div>
      
      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
        <span v-if="isLoading" class="flex items-center gap-2"><Loader2 class="animate-spin" :size="18" /> Resetting...</span>
        <span v-else>Reset Password</span>
      </button>
    </form>

    <!-- Step 4: Success -->
    <div v-else class="animate-fade-in text-center py-6">
      <div class="w-16 h-16 rounded-full bg-[var(--status-active-bg)] text-[var(--status-active)] flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 :size="32" />
      </div>
      <h2 class="text-xl font-bold mb-2">Password Reset Complete</h2>
      <p class="text-sm text-muted mb-6">You can now sign in with your new password.</p>
      <router-link to="/login" class="btn btn-primary w-full">Go to Login</router-link>
    </div>
  </div>
</template>
