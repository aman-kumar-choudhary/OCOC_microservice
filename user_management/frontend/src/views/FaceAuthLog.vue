<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/services/api'
import { formatDateTime, timeAgo } from '@/utils/date'
import {
  ShieldCheck, ShieldX, Activity, RefreshCw, Search,
  Filter, ChevronLeft, ChevronRight, Loader2, Eye,
  X, AlertCircle
} from 'lucide-vue-next'

interface FaceAuthLog {
  id: string
  person_external_id: string
  person_name?: string
  result: 'success' | 'failed' | 'liveness_failed' | 'unknown'
  similarity_score?: number
  liveness_score?: number
  reason?: string
  auth_type: 'single' | 'mass'
  ip_address?: string
  created_at: string
}

const logs = ref<FaceAuthLog[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(25)
const totalPages = ref(1)
const autoRefresh = ref(true)
let refreshInterval: ReturnType<typeof setInterval>

const filters = ref({ result: '', auth_type: '', from: '', to: '' })
const searchPerson = ref('')

// Stats for today
const todayStats = computed(() => {
  const success = logs.value.filter(l => l.result === 'success').length
  const failed = logs.value.filter(l => l.result !== 'success').length
  const total = logs.value.length
  const passRate = total > 0 ? Math.round((success / total) * 100) : 0
  const avgSim = logs.value.filter(l => l.similarity_score != null).reduce((a, l) => a + (l.similarity_score ?? 0), 0)
    / (logs.value.filter(l => l.similarity_score != null).length || 1)
  return { success, failed, total, passRate, avgSim: Math.round(avgSim * 100) }
})

async function fetchLogs() {
  isLoading.value = true
  try {
    const params: any = {
      page: page.value, limit: limit.value,
      ...filters.value,
    }
    if (searchPerson.value) params.person_id = searchPerson.value
    const { data } = await api.get('/face-auth/logs', { params })
    logs.value = data.data?.logs || []
    total.value = data.data?.total || 0
    totalPages.value = data.data?.total_pages || 1
  } catch {
    logs.value = []
  } finally {
    isLoading.value = false
  }
}

function startAutoRefresh() {
  refreshInterval = setInterval(() => { if (autoRefresh.value) fetchLogs() }, 10_000)
}

onMounted(() => { fetchLogs(); startAutoRefresh() })
onUnmounted(() => clearInterval(refreshInterval))

function resultStyle(result: string) {
  if (result === 'success') return { pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' }
  if (result === 'liveness_failed') return { pill: 'bg-orange-500/10 text-orange-400 border-orange-500/25', dot: 'bg-orange-400' }
  return { pill: 'bg-red-500/10 text-red-400 border-red-500/25', dot: 'bg-red-400' }
}

function confColor(score?: number) {
  if (!score) return 'bg-gray-600'
  if (score >= 0.75) return 'bg-emerald-500'
  if (score >= 0.55) return 'bg-yellow-500'
  return 'bg-red-500'
}

function resultLabel(r: string) {
  if (r === 'success') return 'AUTHENTICATED'
  if (r === 'liveness_failed') return 'LIVENESS FAIL'
  if (r === 'unknown') return 'UNKNOWN'
  return 'REJECTED'
}

function handleSearch() { page.value = 1; fetchLogs() }
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold">Auth Monitor</h1>
        <p class="text-muted text-sm mt-1">Real-time face authentication event log</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Auto-refresh toggle -->
        <button @click="autoRefresh = !autoRefresh"
          :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all',
            autoRefresh ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 animate-pulse-slow' : 'border-[var(--border-light)] text-muted']">
          <span :class="['w-2 h-2 rounded-full', autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500']"></span>
          {{ autoRefresh ? 'Live' : 'Paused' }}
        </button>
        <button @click="fetchLogs" class="btn btn-outline py-1.5 px-3" id="refresh-auth-log-btn">
          <RefreshCw :size="15" :class="isLoading ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <!-- KPI Strip -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="glass-panel p-4 flex flex-col gap-1">
        <span class="text-xs text-muted font-semibold uppercase tracking-wide">Total Events</span>
        <span class="text-3xl font-extrabold">{{ total.toLocaleString() }}</span>
      </div>
      <div class="glass-panel p-4 flex flex-col gap-1">
        <span class="text-xs text-muted font-semibold uppercase tracking-wide">Pass Rate</span>
        <div class="flex items-end gap-1">
          <span class="text-3xl font-extrabold" :class="todayStats.passRate >= 80 ? 'text-emerald-400' : 'text-red-400'">{{ todayStats.passRate }}</span>
          <span class="text-muted pb-1">%</span>
        </div>
        <div class="h-1.5 rounded-full bg-[var(--border-light)] overflow-hidden">
          <div class="h-full rounded-full transition-all" :class="todayStats.passRate >= 80 ? 'bg-emerald-500' : 'bg-red-500'" :style="`width:${todayStats.passRate}%`" />
        </div>
      </div>
      <div class="glass-panel p-4 flex flex-col gap-1">
        <span class="text-xs text-muted font-semibold uppercase tracking-wide">Authenticated</span>
        <span class="text-3xl font-extrabold text-emerald-400">{{ todayStats.success }}</span>
      </div>
      <div class="glass-panel p-4 flex flex-col gap-1">
        <span class="text-xs text-muted font-semibold uppercase tracking-wide">Rejected</span>
        <span class="text-3xl font-extrabold text-red-400">{{ todayStats.failed }}</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass-panel p-4 flex flex-wrap gap-3 items-center">
      <div class="relative flex-1 min-w-[200px]">
        <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input v-model="searchPerson" @keydown.enter="handleSearch" placeholder="Person ID or name…" class="form-input pl-8 text-sm" />
      </div>
      <select v-model="filters.result" @change="handleSearch" class="form-input form-select min-w-[145px] text-sm">
        <option value="">All Results</option>
        <option value="success">Authenticated</option>
        <option value="failed">Rejected</option>
        <option value="liveness_failed">Liveness Failed</option>
        <option value="unknown">Unknown</option>
      </select>
      <select v-model="filters.auth_type" @change="handleSearch" class="form-input form-select min-w-[130px] text-sm">
        <option value="">All Types</option>
        <option value="single">Single</option>
        <option value="mass">Mass</option>
      </select>
      <input v-model="filters.from" @change="handleSearch" type="date" class="form-input text-sm" title="From date" />
      <input v-model="filters.to" @change="handleSearch" type="date" class="form-input text-sm" title="To date" />
    </div>

    <!-- Log Table -->
    <div class="glass-panel overflow-hidden relative">
      <div v-if="isLoading" class="absolute inset-0 bg-[var(--bg-card)]/60 backdrop-blur-sm z-10 flex items-center justify-center">
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>

      <!-- Empty -->
      <div v-if="logs.length === 0 && !isLoading" class="py-20 text-center">
        <Activity :size="48" class="mx-auto text-muted opacity-30 mb-4" />
        <p class="font-semibold text-muted">No authentication events found.</p>
        <p class="text-xs text-muted mt-1">Run a face match from Face Lab to see events here.</p>
      </div>

      <!-- Log entries -->
      <div v-else class="divide-y divide-[var(--border-light)]">
        <div v-for="log in logs" :key="log.id" class="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-[rgba(148,163,184,0.04)] transition-colors group">

          <!-- Result Pill -->
          <div class="flex items-center gap-2 w-44 shrink-0">
            <component :is="log.result === 'success' ? ShieldCheck : ShieldX" :size="20" :class="log.result === 'success' ? 'text-emerald-400' : 'text-red-400'" />
            <span :class="['text-xs font-extrabold px-2.5 py-1 rounded-full border tracking-wider', resultStyle(log.result).pill]">
              {{ resultLabel(log.result) }}
            </span>
          </div>

          <!-- Time -->
          <div class="w-36 shrink-0">
            <div class="text-sm font-semibold font-mono">{{ formatDateTime(log.created_at) }}</div>
            <div class="text-xs text-muted">{{ timeAgo(log.created_at) }}</div>
          </div>

          <!-- Person -->
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm truncate">{{ log.person_name || 'Unknown Person' }}</div>
            <div class="text-xs text-muted font-mono truncate">{{ log.person_external_id || '—' }}</div>
          </div>

          <!-- Type badge -->
          <div class="shrink-0">
            <span :class="['text-xs font-bold px-2 py-0.5 rounded-full', log.auth_type === 'mass' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20']">
              {{ log.auth_type === 'mass' ? '👥 Mass' : '👤 Single' }}
            </span>
          </div>

          <!-- Confidence bar -->
          <div v-if="log.similarity_score != null" class="w-28 shrink-0">
            <div class="text-xs text-muted mb-1">Confidence</div>
            <div class="flex items-center gap-2">
              <div class="flex-1 h-1.5 rounded-full bg-[var(--border-light)] overflow-hidden">
                <div class="h-full rounded-full transition-all" :class="confColor(log.similarity_score)"
                  :style="`width:${Math.round(log.similarity_score * 100)}%`" />
              </div>
              <span class="text-xs font-bold w-8 text-right">{{ Math.round((log.similarity_score ?? 0) * 100) }}%</span>
            </div>
          </div>

          <!-- Reason -->
          <div class="shrink-0 text-xs text-muted w-36 truncate" :title="log.reason">
            {{ log.reason || '—' }}
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="logs.length > 0" class="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm">
        <span class="text-muted">{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, total) }} of {{ total }}</span>
        <div class="flex items-center gap-1">
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-primary disabled:opacity-40" :disabled="page <= 1" @click="page--; fetchLogs()">
            <ChevronLeft :size="15" />
          </button>
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-primary disabled:opacity-40" :disabled="page >= totalPages" @click="page++; fetchLogs()">
            <ChevronRight :size="15" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
