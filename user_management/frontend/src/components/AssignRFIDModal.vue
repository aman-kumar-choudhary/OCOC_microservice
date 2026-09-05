<script setup lang="ts">
import { ref } from 'vue'
import rfidService from '@/services/rfidService'
import type { RFIDCard } from '@/types'
import { X, Loader2, CreditCard, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{ card: RFIDCard }>()
const emit = defineEmits<{ close: []; done: [] }>()

const newUid = ref('')
const reason = ref('lost')
const isLoading = ref(false)
const error = ref('')

async function submit() {
  if (!newUid.value.trim()) { error.value = 'New UID is required'; return }
  isLoading.value = true
  error.value = ''
  try {
    await rfidService.replace(props.card.user_id!, newUid.value.trim(), reason.value)
    emit('done')
    emit('close')
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Replace failed'
  } finally { isLoading.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative z-10 glass-panel p-0 w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CreditCard :size="18" />
            </div>
            <h2 class="font-extrabold">Assign Replacement Tag</h2>
          </div>
          <button @click="emit('close')" class="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted"><X :size="18" /></button>
        </div>

        <!-- Body -->
        <div class="px-5 py-4 space-y-4">
          <!-- Current card -->
          <div class="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-light)]">
            <div class="text-xs text-muted mb-1 font-semibold uppercase tracking-wide">Current Card (will be marked as {{ reason }})</div>
            <div class="font-mono font-bold tracking-widest">{{ card.uid }}</div>
          </div>

          <div>
            <label class="form-label">Reason for Replacement</label>
            <select v-model="reason" class="form-input form-select">
              <option value="lost">Lost</option>
              <option value="stolen">Stolen</option>
              <option value="damaged">Damaged</option>
              <option value="upgrade">Upgrade</option>
            </select>
          </div>

          <div>
            <label class="form-label">New Tag UID</label>
            <input v-model="newUid" class="form-input font-mono" placeholder="Scan or type new UID…" id="new-uid-input" />
          </div>

          <div v-if="reason === 'stolen'" class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle :size="14" class="mt-0.5 shrink-0" /> The old card will be flagged as stolen and immediately revoked.
          </div>

          <div v-if="error" class="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-semibold border border-red-500/20">{{ error }}</div>
        </div>

        <!-- Footer -->
        <div class="px-5 pb-5 flex justify-end gap-3">
          <button @click="emit('close')" class="btn btn-outline">Cancel</button>
          <button @click="submit" :disabled="isLoading" class="btn btn-primary" id="confirm-replace-btn">
            <Loader2 v-if="isLoading" class="animate-spin" :size="15" />
            <CreditCard v-else :size="15" />
            Assign New Tag
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes scale-in { from { transform: scale(0.93); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.animate-scale-in { animation: scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
</style>
