<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { auditService } from '@/services/miscService'
import type { AuditLog } from '@/types'
import { Loader2, Activity, ArrowRight, UserCircle2 } from 'lucide-vue-next'

const logs = ref<AuditLog[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(20)

const filters = ref({
  operation: '',
  entity_type: ''
})

async function fetchLogs() {
  isLoading.value = true
  try {
    const data = await auditService.list({
      page: page.value,
      limit: limit.value,
      ...filters.value
    })
    logs.value = data.logs || []
    total.value = data.total
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchLogs()
}

onMounted(() => {
  fetchLogs()
})

function formatOperation(op: string) {
  return op.split('_').join(' ').toUpperCase()
}

function getOperationColor(op: string) {
  if (op.includes('CREATE') || op.includes('ISSUE')) return 'text-[var(--status-active)] bg-[var(--status-active-bg)]'
  if (op.includes('UPDATE')) return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
  if (op.includes('DELETE') || op.includes('REVOKE') || op.includes('DEACTIVATE')) return 'text-[var(--status-error)] bg-[var(--status-error-bg)]'
  if (op.includes('SUSPEND')) return 'text-[var(--status-suspended)] bg-[var(--status-suspended-bg)]'
  return 'text-muted bg-[var(--border-light)]'
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold">Audit Log</h1>
      <p class="text-muted text-sm">Immutable ledger of all administrative and system actions.</p>
    </div>

    <!-- Filters -->
    <div class="glass-panel p-4 mb-6 flex flex-col md:flex-row gap-4">
      <div class="flex gap-4 flex-1">
        <select v-model="filters.operation" @change="handleSearch" class="form-input form-select flex-1">
          <option value="">All Operations</option>
          <option value="CREATE_USER">Create User</option>
          <option value="UPDATE_USER">Update User</option>
          <option value="SUSPEND_USER">Suspend User</option>
          <option value="ASSIGN_RFID">Assign RFID</option>
          <option value="REPLACE_RFID">Replace RFID</option>
          <option value="REVOKE_RFID">Revoke RFID</option>
        </select>
        <select v-model="filters.entity_type" @change="handleSearch" class="form-input form-select flex-1">
          <option value="">All Entities</option>
          <option value="user">User</option>
          <option value="rfid_card">RFID Card</option>
          <option value="bulk_import">Bulk Import</option>
        </select>
      </div>
    </div>

    <!-- Log List -->
    <div class="glass-panel overflow-hidden relative min-h-[400px]">
      <div v-if="isLoading" class="absolute inset-0 bg-[var(--bg-card)]/50 backdrop-blur-sm z-10 flex items-center justify-center">
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>

      <div class="divide-y divide-[var(--border-light)]">
        <div v-if="logs.length === 0 && !isLoading" class="p-12 text-center text-muted flex flex-col items-center">
          <Activity :size="48" class="mb-4 opacity-50" />
          <p>No audit events found.</p>
        </div>

        <div v-for="log in logs" :key="log.id" class="p-4 hover:bg-[rgba(148,163,184,0.05)] transition-colors flex flex-col sm:flex-row gap-4 sm:items-center">
          <!-- Time -->
          <div class="w-32 flex-shrink-0 text-sm text-muted">
            <div class="font-medium text-[var(--text-main)]">{{ new Date(log.created_at).toLocaleDateString() }}</div>
            <div>{{ new Date(log.created_at).toLocaleTimeString() }}</div>
          </div>
          
          <!-- Operation -->
          <div class="w-40 flex-shrink-0">
            <span :class="['text-xs font-bold px-2 py-1 rounded-md tracking-wider', getOperationColor(log.operation)]">
              {{ formatOperation(log.operation) }}
            </span>
          </div>
          
          <!-- Details -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold capitalize">{{ log.entity_type.replace('_', ' ') }}</span>
              <ArrowRight class="text-muted" :size="14" />
              <span class="text-sm font-mono text-muted truncate">{{ log.entity_id }}</span>
            </div>
            
            <div class="flex items-center gap-4 text-xs text-muted">
              <span class="flex items-center gap-1" title="Actor ID">
                <UserCircle2 :size="14" />
                {{ log.actor_id || 'System' }}
              </span>
              <span v-if="log.ip_address" class="border-l border-[var(--border-light)] pl-4">
                IP: {{ log.ip_address }}
              </span>
            </div>
          </div>
          
          <!-- Action -->
          <div class="sm:pl-4 sm:border-l border-[var(--border-light)] flex-shrink-0">
            <button class="text-sm text-primary hover:underline font-medium">View Diff</button>
          </div>
        </div>
      </div>
      
      <!-- Pagination -->
      <div class="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm">
        <div class="flex gap-2">
          <button class="btn btn-outline py-1 px-3" :disabled="page <= 1" @click="page--; fetchLogs()">Prev</button>
          <button class="btn btn-outline py-1 px-3" :disabled="logs.length < limit" @click="page++; fetchLogs()">Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
