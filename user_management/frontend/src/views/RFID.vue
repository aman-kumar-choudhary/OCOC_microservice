<script setup lang="ts">
import { ref } from 'vue'
import rfidService from '@/services/rfidService'
import type { RFIDCard } from '@/types'
import { formatDate } from '@/utils/date'
import {
  CreditCard, XCircle, AlertTriangle, Loader2,
  ChevronLeft, ChevronRight, RefreshCw, Plus
} from 'lucide-vue-next'
import AssignRFIDModal from '@/components/AssignRFIDModal.vue'

const cards = ref<RFIDCard[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const totalPages = ref(1)
const revokeTarget = ref<RFIDCard | null>(null)
const replaceTarget = ref<RFIDCard | null>(null)
const revokeReason = ref('')
const revokeLoading = ref(false)

const filters = ref({ status: '' })

async function fetchCards() {
  isLoading.value = true
  try {
    const data = await rfidService.list({ page: page.value, limit: limit.value, ...filters.value })
    cards.value = data.cards || []
    total.value = data.total
    totalPages.value = data.total_pages
  } catch (e) { console.error(e) }
  finally { isLoading.value = false }
}

function handleSearch() { page.value = 1; fetchCards() }

async function doRevoke() {
  if (!revokeTarget.value) return
  revokeLoading.value = true
  try {
    await rfidService.revoke(revokeTarget.value.id, revokeReason.value)
    revokeTarget.value = null
    revokeReason.value = ''
    fetchCards()
  } catch { }
  finally { revokeLoading.value = false }
}

function statusBadge(s: string) {
  if (s === 'active') return 'badge-active'
  if (s === 'inactive') return 'badge-suspended'
  if (s === 'replaced') return 'text-blue-600 bg-blue-100'
  return 'badge-deactivated'
}

import { onMounted } from 'vue'
onMounted(fetchCards)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold">RFID Directory</h1>
        <p class="text-muted text-sm mt-1">Manage hardware tokens, lifecycle, and replacement.</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Reader Online
        </div>
        <button @click="fetchCards" class="btn btn-outline py-1.5 px-3" id="rfid-refresh-btn">
          <RefreshCw :size="15" :class="isLoading ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <!-- Status pills -->
    <div class="flex gap-2 mb-5 flex-wrap">
      <button v-for="s in [{ v: '', l: 'All' }, { v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }, { v: 'revoked', l: 'Revoked' }, { v: 'lost', l: 'Lost' }, { v: 'replaced', l: 'Replaced' }]"
        :key="s.v" @click="filters.status = s.v; handleSearch()"
        :class="['px-4 py-1.5 rounded-full text-sm font-bold border transition-all', filters.status === s.v ? 'bg-navy text-primary border-navy' : 'border-[var(--border-light)] text-muted hover:border-primary']">
        {{ s.l }}
      </button>
    </div>

    <!-- Table -->
    <div class="table-container relative">
      <div v-if="isLoading" class="absolute inset-0 bg-[var(--bg-card)]/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
        <Loader2 class="animate-spin text-primary" :size="28" />
      </div>

      <table class="table min-w-full">
        <thead>
          <tr>
            <th>UID</th>
            <th>Assigned User</th>
            <th>Status</th>
            <th>Issued</th>
            <th>Revoked</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cards.length === 0 && !isLoading">
            <td colspan="6" class="text-center py-16 text-muted">
              <CreditCard :size="40" class="mx-auto mb-3 opacity-30" />
              <p class="text-sm">No RFID cards found</p>
            </td>
          </tr>

          <tr v-for="card in cards" :key="card.id">
            <!-- UID -->
            <td>
              <span class="font-mono font-bold tracking-widest text-sm">{{ card.uid }}</span>
              <div class="text-[10px] text-muted font-mono mt-0.5">{{ card.id.substring(0, 12) }}…</div>
            </td>

            <!-- Assigned User -->
            <td>
              <span v-if="card.user_email" class="text-sm">{{ card.user_email }}</span>
              <span v-else class="text-xs text-muted">— Unassigned</span>
            </td>

            <!-- Status -->
            <td>
              <span :class="['badge', statusBadge(card.status)]">{{ card.status }}</span>
            </td>

            <!-- Issued -->
            <td class="text-sm text-muted">{{ card.issued_at ? formatDate(card.issued_at) : '—' }}</td>

            <!-- Revoked -->
            <td>
              <span v-if="card.revoked_at" class="text-xs text-red-400 font-medium">{{ formatDate(card.revoked_at) }}</span>
              <span v-else class="text-muted text-xs">—</span>
            </td>

            <!-- Actions -->
            <td class="text-right">
              <div class="flex justify-end gap-2">
                <button v-if="card.status === 'active'" @click="replaceTarget = card"
                  class="btn btn-outline py-1 px-3 text-xs text-blue-400 border-blue-400/30 hover:bg-blue-500/10" :id="`replace-${card.id}-btn`">
                  <Plus :size="13" /> Replace
                </button>
                <button v-if="card.status === 'active' || card.status === 'inactive'" @click="revokeTarget = card; revokeReason = ''"
                  class="btn btn-outline py-1 px-3 text-xs text-red-400 border-red-400/30 hover:bg-red-500/10" :id="`revoke-${card.id}-btn`">
                  <XCircle :size="13" /> Revoke
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm bg-[var(--bg-card)] rounded-b-2xl">
        <span class="text-muted">{{ total }} cards total</span>
        <div class="flex gap-1">
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-primary disabled:opacity-40" :disabled="page <= 1" @click="page--; fetchCards()">
            <ChevronLeft :size="15" />
          </button>
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted hover:border-primary disabled:opacity-40" :disabled="page >= totalPages" @click="page++; fetchCards()">
            <ChevronRight :size="15" />
          </button>
        </div>
      </div>
    </div>

    <!-- Revoke Confirm Dialog -->
    <Teleport to="body">
      <div v-if="revokeTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="revokeTarget = null">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="revokeTarget = null" />
        <div class="relative z-10 glass-panel p-6 w-full max-w-sm space-y-4 shadow-2xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
              <AlertTriangle :size="20" />
            </div>
            <h3 class="text-lg font-extrabold">Revoke Card</h3>
          </div>
          <p class="text-sm text-muted">Card <span class="font-mono font-bold text-[var(--text-main)]">{{ revokeTarget.uid }}</span> will be permanently revoked. User will lose physical access.</p>
          <div>
            <label class="form-label">Reason</label>
            <select v-model="revokeReason" class="form-input form-select">
              <option value="">Select reason…</option>
              <option value="lost">Lost</option>
              <option value="stolen">Stolen</option>
              <option value="damaged">Damaged</option>
              <option value="admin_action">Admin Action</option>
            </select>
          </div>
          <div class="flex justify-end gap-3">
            <button @click="revokeTarget = null" class="btn btn-outline">Cancel</button>
            <button @click="doRevoke" :disabled="revokeLoading" class="btn bg-red-600 text-white hover:bg-red-700" id="confirm-revoke-btn">
              <Loader2 v-if="revokeLoading" class="animate-spin" :size="15" /> Revoke
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Replace Modal -->
    <AssignRFIDModal v-if="replaceTarget" :card="replaceTarget" @close="replaceTarget = null" @done="fetchCards" />
  </div>
</template>
