<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { auditService } from '@/services/miscService'
import type { AuditLog } from '@/types'
import { formatDateTime } from '@/utils/date'
import { Loader2, Activity, ArrowRight, UserCircle2, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const logs = ref<AuditLog[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(25)
const totalPages = ref(1)
const diffLog = ref<AuditLog | null>(null)

const filters = ref({ operation: '', entity_type: '' })

async function fetchLogs() {
  isLoading.value = true
  try {
    const data = await auditService.list({ page: page.value, limit: limit.value, ...filters.value })
    logs.value = data.logs || []
    total.value = data.total
    totalPages.value = data.total_pages || 1
  } catch (e) { console.error(e) }
  finally { isLoading.value = false }
}

function handleSearch() { page.value = 1; fetchLogs() }
onMounted(fetchLogs)

function formatOperation(op: string) {
  return op.split('_').join(' ')
}

function getOperationColor(op: string) {
  if (op.includes('CREATE') || op.includes('ISSUE') || op.includes('AUTH_SUCCESS')) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
  if (op.includes('UPDATE')) return 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
  if (op.includes('DELETE') || op.includes('REVOKE') || op.includes('DEACTIVATE') || op.includes('AUTH_FAILED')) return 'text-red-400 bg-red-500/10 border border-red-500/20'
  if (op.includes('SUSPEND') || op.includes('LIVENESS')) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
  return 'text-muted bg-[var(--border-light)] border border-transparent'
}

function fmtJson(v: any): string {
  if (!v) return '—'
  try { return JSON.stringify(JSON.parse(typeof v === 'string' ? v : JSON.stringify(v)), null, 2) }
  catch { return String(v) }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold">Audit Log</h1>
      <p class="text-muted text-sm mt-1">Immutable ledger of all administrative and authentication actions.</p>
    </div>

    <!-- Filters -->
    <div class="glass-panel p-4 mb-6 flex flex-col md:flex-row gap-3">
      <select v-model="filters.operation" @change="handleSearch" class="form-input form-select flex-1" id="op-filter">
        <option value="">All Operations</option>
        <optgroup label="User">
          <option value="CREATE_USER">Create User</option>
          <option value="UPDATE_USER">Update User</option>
          <option value="SUSPEND_USER">Suspend User</option>
          <option value="ACTIVATE_USER">Activate User</option>
          <option value="DEACTIVATE_USER">Deactivate User</option>
          <option value="IMPORT_USERS">Bulk Import</option>
        </optgroup>
        <optgroup label="RFID">
          <option value="ASSIGN_RFID">Assign RFID</option>
          <option value="REPLACE_RFID">Replace RFID</option>
          <option value="REVOKE_RFID">Revoke RFID</option>
        </optgroup>
        <optgroup label="Face Auth">
          <option value="FACE_AUTH_SUCCESS">Face Auth Success</option>
          <option value="FACE_AUTH_FAILED">Face Auth Failed</option>
          <option value="FACE_AUTH_LIVENESS">Liveness Failed</option>
        </optgroup>
      </select>
      <select v-model="filters.entity_type" @change="handleSearch" class="form-input form-select flex-1" id="entity-filter">
        <option value="">All Entities</option>
        <option value="user">User</option>
        <option value="rfid_card">RFID Card</option>
        <option value="bulk_import">Bulk Import</option>
        <option value="face_auth">Face Auth</option>
      </select>
    </div>

    <!-- Log List -->
    <div class="glass-panel overflow-hidden relative min-h-[400px]">
      <div v-if="isLoading" class="absolute inset-0 bg-[var(--bg-card)]/50 backdrop-blur-sm z-10 flex items-center justify-center">
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>

      <div class="divide-y divide-[var(--border-light)]">
        <div v-if="logs.length === 0 && !isLoading" class="p-12 text-center text-muted flex flex-col items-center">
          <Activity :size="48" class="mb-4 opacity-30" />
          <p>No audit events found.</p>
        </div>

        <div v-for="log in logs" :key="log.id"
          class="p-4 hover:bg-[rgba(148,163,184,0.05)] transition-colors flex flex-col sm:flex-row gap-4 sm:items-center">
          <!-- Time -->
          <div class="w-36 flex-shrink-0 text-sm text-muted">
            <div class="font-bold text-[var(--text-main)] font-mono text-xs leading-tight">{{ formatDateTime(log.created_at) }}</div>
          </div>

          <!-- Operation -->
          <div class="w-44 flex-shrink-0">
            <span :class="['text-xs font-bold px-2.5 py-1 rounded-md tracking-wide', getOperationColor(log.operation)]">
              {{ formatOperation(log.operation) }}
            </span>
          </div>

          <!-- Details -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold capitalize">{{ log.entity_type?.replace('_', ' ') }}</span>
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

          <!-- Diff button -->
          <div class="sm:pl-4 sm:border-l border-[var(--border-light)] flex-shrink-0">
            <button @click="diffLog = log" class="text-sm text-primary hover:underline font-semibold flex items-center gap-1">
              View Diff
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm">
        <span class="text-muted">{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, total) }} of {{ total }}</span>
        <div class="flex gap-1">
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-primary disabled:opacity-40" :disabled="page <= 1" @click="page--; fetchLogs()">
            <ChevronLeft :size="15" />
          </button>
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-primary disabled:opacity-40" :disabled="page >= totalPages" @click="page++; fetchLogs()">
            <ChevronRight :size="15" />
          </button>
        </div>
      </div>
    </div>

    <!-- Diff Modal -->
    <Teleport to="body">
      <div v-if="diffLog" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="diffLog = null">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="diffLog = null" />
        <div class="relative z-10 glass-panel w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] shrink-0">
            <div>
              <h3 class="font-extrabold text-lg">Audit Diff — {{ formatOperation(diffLog.operation) }}</h3>
              <p class="text-xs text-muted font-mono">{{ diffLog.entity_type }} / {{ diffLog.entity_id }}</p>
            </div>
            <button @click="diffLog = null" class="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted"><X :size="20" /></button>
          </div>
          <!-- Side-by-side diff -->
          <div class="flex-1 overflow-auto grid grid-cols-2 divide-x divide-[var(--border-light)]">
            <div class="p-4">
              <div class="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-red-400"></span> Before
              </div>
              <pre class="text-xs font-mono whitespace-pre-wrap text-red-300 leading-relaxed">{{ fmtJson(diffLog.before_state) }}</pre>
            </div>
            <div class="p-4">
              <div class="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span> After
              </div>
              <pre class="text-xs font-mono whitespace-pre-wrap text-emerald-300 leading-relaxed">{{ fmtJson(diffLog.after_state) }}</pre>
            </div>
          </div>
          <!-- Meta row -->
          <div class="px-6 py-3 border-t border-[var(--border-light)] text-xs text-muted flex gap-6 shrink-0">
            <span>Actor: <span class="font-mono text-[var(--text-main)]">{{ diffLog.actor_id || 'System' }}</span></span>
            <span>IP: <span class="font-mono">{{ diffLog.ip_address || '—' }}</span></span>
            <span>Time: <span class="font-mono">{{ formatDateTime(diffLog.created_at) }}</span></span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
