<script setup lang="ts">
import { ref, computed } from 'vue'
import userService from '@/services/userService'
import type { User } from '@/types'
import { X, Loader2, ShieldOff, ShieldCheck, UserX, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  user: User
  action: 'suspend' | 'activate' | 'deactivate'
}>()
const emit = defineEmits<{ close: []; done: [] }>()

const isLoading = ref(false)
const error = ref('')

const config = computed(() => {
  if (props.action === 'suspend') return {
    icon: ShieldOff,
    title: 'Suspend User',
    verb: 'Suspend',
    color: 'amber',
    bgClass: 'bg-amber-50 border-amber-200 text-amber-800',
    btnClass: 'btn-warning',
    consequences: [
      '🔒 RFID card access will be immediately revoked',
      '🚫 Keycloak login session will be terminated',
      '📧 User will be unable to log into any OCOC system',
      '✅ Can be re-activated by an administrator',
    ]
  }
  if (props.action === 'activate') return {
    icon: ShieldCheck,
    title: 'Activate User',
    verb: 'Activate',
    color: 'emerald',
    bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    btnClass: 'btn-primary',
    consequences: [
      '✅ Keycloak account will be re-enabled',
      '🔓 User will be able to log in again',
      '⚠️ RFID access must be re-issued separately if revoked',
    ]
  }
  // deactivate
  return {
    icon: UserX,
    title: 'Permanently Deactivate',
    verb: 'Deactivate',
    color: 'red',
    bgClass: 'bg-red-50 border-red-200 text-red-800',
    btnClass: 'btn-danger',
    consequences: [
      '❌ RFID card access permanently revoked',
      '🚫 Keycloak login session immediately terminated',
      '🗄️ User record preserved for audit history',
      '⚠️ Cannot be reversed without admin intervention',
    ]
  }
})

async function confirm() {
  isLoading.value = true
  error.value = ''
  try {
    if (props.action === 'suspend') await userService.suspend(props.user.id)
    else if (props.action === 'activate') await userService.activate(props.user.id)
    else await userService.deactivate(props.user.id)
    emit('done')
    emit('close')
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Action failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative z-10 w-full max-w-md glass-panel p-0 overflow-hidden shadow-2xl animate-scale-in">
        <!-- Header -->
        <div :class="['px-6 pt-6 pb-4 border-b border-[var(--border-light)]']">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div :class="['w-10 h-10 rounded-xl flex items-center justify-center',
                action === 'activate' ? 'bg-emerald-100 text-emerald-600' : action === 'suspend' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600']">
                <component :is="config.icon" :size="20" />
              </div>
              <h2 class="text-lg font-extrabold">{{ config.title }}</h2>
            </div>
            <button @click="emit('close')" class="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted">
              <X :size="18" />
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="px-6 py-5 space-y-4">
          <!-- User info -->
          <div class="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-main)]">
            <div class="w-10 h-10 rounded-full bg-navy/8 flex items-center justify-center text-sm font-bold text-navy">
              {{ (user.profile?.full_name || user.email).charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="font-bold">{{ user.profile?.full_name || user.email }}</div>
              <div class="text-xs text-muted">{{ user.email }} · {{ user.user_type }}</div>
            </div>
          </div>

          <!-- Consequences -->
          <div :class="['p-4 rounded-xl border', config.bgClass]">
            <div class="flex items-start gap-2 mb-2">
              <AlertTriangle :size="15" class="mt-0.5 shrink-0" />
              <span class="text-sm font-bold">What will happen:</span>
            </div>
            <ul class="space-y-1">
              <li v-for="c in config.consequences" :key="c" class="text-xs leading-relaxed">{{ c }}</li>
            </ul>
          </div>

          <!-- Error -->
          <div v-if="error" class="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-200">{{ error }}</div>
        </div>

        <!-- Footer -->
        <div class="px-6 pb-6 flex justify-end gap-3">
          <button @click="emit('close')" class="btn btn-outline">Cancel</button>
          <button @click="confirm" :disabled="isLoading" :id="`confirm-${action}-btn`"
            :class="['btn', action === 'activate' ? 'btn-primary' : action === 'suspend' ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-red-600 text-white hover:bg-red-700']">
            <Loader2 v-if="isLoading" class="animate-spin" :size="15" />
            <component v-else :is="config.icon" :size="15" />
            {{ config.verb }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes scale-in {
  from { transform: scale(0.93); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
.animate-scale-in { animation: scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
</style>
