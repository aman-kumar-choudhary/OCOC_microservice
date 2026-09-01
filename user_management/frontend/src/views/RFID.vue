<script setup lang="ts">
import { ref, onMounted } from 'vue'
import rfidService from '@/services/rfidService'
import type { RFIDCard } from '@/types'
import { Loader2, CreditCard, XCircle, AlertTriangle } from 'lucide-vue-next'

const cards = ref<RFIDCard[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(15)

const filters = ref({
  status: ''
})

async function fetchCards() {
  isLoading.value = true
  try {
    const data = await rfidService.list({
      page: page.value,
      limit: limit.value,
      ...filters.value
    })
    cards.value = data.cards || []
    total.value = data.total
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchCards()
}

function getStatusClass(status: string) {
  if (status === 'active') return 'badge-active'
  if (status === 'inactive') return 'badge-suspended'
  if (status === 'replaced') return 'badge-primary'
  return 'badge-deactivated' // revoked, lost, stolen
}

onMounted(() => {
  fetchCards()
})
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold">RFID Directory</h1>
        <p class="text-muted text-sm">Manage hardware tokens, revoke access, and track card lifecycle.</p>
      </div>
      
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[var(--status-active)] border border-[rgba(16,185,129,0.2)] text-sm font-medium">
          <div class="w-2 h-2 rounded-full bg-[var(--status-active)] animate-pulse"></div>
          Reader Online
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass-panel p-4 mb-6 flex flex-col md:flex-row justify-between gap-4">
      <div class="flex gap-2">
        <button @click="filters.status = ''; handleSearch()" :class="['btn btn-sm rounded-full', filters.status === '' ? 'bg-primary text-white' : 'btn-outline']">All</button>
        <button @click="filters.status = 'active'; handleSearch()" :class="['btn btn-sm rounded-full', filters.status === 'active' ? 'bg-[var(--status-active)] text-white border-transparent' : 'btn-outline']">Active</button>
        <button @click="filters.status = 'revoked'; handleSearch()" :class="['btn btn-sm rounded-full', filters.status === 'revoked' ? 'bg-[var(--status-error)] text-white border-transparent' : 'btn-outline']">Revoked</button>
        <button @click="filters.status = 'lost'; handleSearch()" :class="['btn btn-sm rounded-full', filters.status === 'lost' ? 'bg-orange-500 text-white border-transparent' : 'btn-outline']">Lost</button>
      </div>
    </div>

    <!-- Cards Grid -->
    <div class="relative min-h-[400px]">
      <div v-if="isLoading" class="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-main)]/50 backdrop-blur-sm">
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>
      
      <div v-if="cards.length === 0 && !isLoading" class="text-center py-20">
        <CreditCard class="mx-auto text-muted mb-4 opacity-50" :size="48" />
        <h3 class="text-lg font-medium">No RFID Cards Found</h3>
        <p class="text-muted">Adjust your filters to see results.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="card in cards" :key="card.id" class="glass-panel p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none"></div>
          
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded bg-[var(--bg-input)] border border-[var(--border-light)] flex items-center justify-center text-primary">
                <CreditCard :size="20" />
              </div>
              <div>
                <div class="font-mono font-bold tracking-wider">{{ card.uid }}</div>
                <div class="text-xs text-muted">ID: {{ card.id.substring(0,8) }}...</div>
              </div>
            </div>
            <span :class="['badge', getStatusClass(card.status)]">{{ card.status }}</span>
          </div>
          
          <div class="space-y-2 text-sm mt-6">
            <div class="flex justify-between">
              <span class="text-muted">Issued</span>
              <span class="font-medium">{{ card.issued_at ? new Date(card.issued_at).toLocaleDateString() : 'N/A' }}</span>
            </div>
            <div v-if="card.revoked_at" class="flex justify-between items-center text-[var(--status-error)]">
              <span>Revoked</span>
              <span class="font-medium flex items-center gap-1">
                <AlertTriangle :size="14" />
                {{ new Date(card.revoked_at).toLocaleDateString() }}
              </span>
            </div>
            <div v-if="card.revoked_reason" class="pt-2 border-t border-[var(--border-light)] text-xs text-muted italic">
              Reason: {{ card.revoked_reason }}
            </div>
          </div>
          
          <!-- Actions overlay -->
          <div class="absolute inset-0 bg-[var(--bg-card)]/90 backdrop-blur-sm flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button v-if="card.status === 'active'" class="btn btn-outline text-[var(--status-error)] border-[var(--status-error)] hover:bg-[var(--status-error-bg)]">
              <XCircle :size="16" /> Revoke
            </button>
            <button class="btn btn-primary">Details</button>
          </div>
        </div>
      </div>
    </div>
    
  </div>
</template>

<style scoped>
.btn-sm {
  padding: 0.25rem 1rem;
  font-size: 0.875rem;
}
</style>
