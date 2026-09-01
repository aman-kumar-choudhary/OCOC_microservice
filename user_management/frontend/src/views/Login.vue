<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

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
  <div class="login-form">
    <h2 class="text-xl font-bold mb-6 text-center">Sign In</h2>
    
    <div v-if="error" class="mb-4 p-3 rounded-lg text-sm bg-[var(--status-error-bg)] text-[var(--status-error)] flex items-center gap-2">
      <div class="w-1 h-full rounded bg-[var(--status-error)]"></div>
      {{ error }}
    </div>

    <form @submit.prevent="handleLogin" class="flex-col gap-4">
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <Mail :size="18" />
          </div>
          <input 
            v-model="email" 
            type="email" 
            required 
            class="form-input pl-10" 
            placeholder="admin@ococ.local"
            :disabled="isLoading"
          />
        </div>
      </div>

      <div class="form-group mb-6">
        <div class="flex justify-between items-center mb-1">
          <label class="form-label mb-0">Password</label>
          <router-link to="/forgot-password" class="text-xs text-primary hover:underline">Forgot password?</router-link>
        </div>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <Lock :size="18" />
          </div>
          <input 
            v-model="password" 
            type="password" 
            required 
            class="form-input pl-10" 
            placeholder="••••••••"
            :disabled="isLoading"
          />
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-full py-2.5 text-base" :disabled="isLoading">
        <span v-if="!isLoading" class="flex items-center gap-2">
          Sign In <ArrowRight :size="18" />
        </span>
        <span v-else class="flex items-center gap-2">
          <Loader2 class="animate-spin" :size="18" /> Authenticating...
        </span>
      </button>
    </form>
    
    <div class="mt-6 text-center text-sm text-muted">
      Protected by OCOC Identity Server
    </div>
  </div>
</template>
