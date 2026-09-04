<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import userService from '@/services/userService'
import type { User } from '@/types'
import {
  Search, Download, MoreVertical, Loader2, CreditCard, Camera,
  ChevronLeft, ChevronRight, X, Filter
} from 'lucide-vue-next'

const users = ref<User[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const totalPages = ref(1)
const exportLoading = ref(false)
const showActionsFor = ref<string | null>(null)

const filters = ref({
  search: '',
  user_type: '',
  status: ''
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>
watch(() => filters.value.search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    fetchUsers()
  }, 350)
})

async function fetchUsers() {
  isLoading.value = true
  try {
    const data = await userService.list({
      page: page.value,
      limit: limit.value,
      ...filters.value
    })
    users.value = data.users || []
    total.value = data.total
    totalPages.value = data.total_pages
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

function handleFilterChange() {
  page.value = 1
  fetchUsers()
}

function clearFilters() {
  filters.value = { search: '', user_type: '', status: '' }
  page.value = 1
  fetchUsers()
}

const hasActiveFilters = () => filters.value.search || filters.value.user_type || filters.value.status

function getStatusClass(status: string) {
  if (status === 'active') return 'badge-active'
  if (status === 'suspended') return 'badge-suspended'
  return 'badge-deactivated'
}

function getUserTypeColor(type: string) {
  const map: Record<string, string> = {
    student: 'bg-blue-50 text-blue-700 border-blue-200',
    faculty: 'bg-purple-50 text-purple-700 border-purple-200',
    worker: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    visitor: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return map[type] || 'bg-gray-50 text-gray-700 border-gray-200'
}

function getIdentifier(user: User) {
  return user.profile?.roll_number || user.profile?.employee_id || user.profile?.gov_id_number || '—'
}

function getDeptDisplay(user: User) {
  return (user.profile as any)?.department || (user.profile as any)?.school || '—'
}

// CSV Export
async function exportToCSV() {
  exportLoading.value = true
  try {
    // Fetch all matching users (high limit)
    const data = await userService.list({ page: 1, limit: 10000, ...filters.value })
    const rows = (data.users || [])
    const headers = ['Name', 'Email', 'Phone', 'Type', 'Identifier', 'Department', 'Status', 'RFID Card', 'Joined']
    const csvContent = [
      headers.join(','),
      ...rows.map((u) => [
        `"${u.profile?.full_name || ''}"`,
        `"${u.email}"`,
        `"${u.phone || ''}"`,
        u.user_type,
        `"${getIdentifier(u)}"`,
        `"${getDeptDisplay(u)}"`,
        u.status,
        u.active_rfid ? 'Yes' : 'No',
        new Date(u.created_at).toLocaleDateString('en-IN'),
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ococ-users-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Export failed', e)
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div>
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold">User Directory</h1>
        <p class="text-muted text-sm mt-1">
          <span v-if="!isLoading">{{ total.toLocaleString() }} identities registered in the campus ecosystem</span>
          <span v-else>Loading directory…</span>
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="btn btn-primary"
          @click="exportToCSV"
          :disabled="exportLoading"
          id="export-csv-btn"
          title="Export filtered list to CSV"
        >
          <Loader2 v-if="exportLoading" class="animate-spin" :size="16" />
          <Download v-else :size="16" />
          Export CSV
        </button>
      </div>
    </div>

    <!-- Filters Panel -->
    <div class="glass-panel p-4 mb-6">
      <div class="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <!-- Search -->
        <div class="relative flex-1 min-w-0">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            v-model="filters.search"
            type="text"
            placeholder="Search name, email, roll number…"
            class="form-input pl-9 pr-8"
            id="user-search-input"
          />
          <button v-if="filters.search" @click="filters.search = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-red-500 transition-colors">
            <X :size="15" />
          </button>
        </div>

        <div class="flex gap-3 flex-wrap">
          <!-- Role Filter -->
          <div class="relative">
            <Filter :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <select
              v-model="filters.user_type"
              @change="handleFilterChange"
              class="form-input form-select pl-8 min-w-[150px]"
              id="user-type-filter"
            >
              <option value="">All Roles</option>
              <option value="student">🎓 Student</option>
              <option value="faculty">👨‍🏫 Faculty</option>
              <option value="worker">🔧 Worker</option>
              <option value="visitor">👤 Visitor</option>
            </select>
          </div>

          <!-- Status Filter -->
          <select
            v-model="filters.status"
            @change="handleFilterChange"
            class="form-input form-select min-w-[145px]"
            id="status-filter"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>

          <!-- Clear button -->
          <button
            v-if="hasActiveFilters()"
            @click="clearFilters"
            class="btn btn-outline text-red-500 border-red-200 hover:bg-red-50 px-3"
            id="clear-filters-btn"
          >
            <X :size="15" /> Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-container animate-fade-in relative">
      <!-- Loading overlay -->
      <div
        v-if="isLoading"
        class="absolute inset-0 bg-[var(--bg-card)]/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl"
      >
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>

      <table class="table min-w-full">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Identifier / Dept</th>
            <th>Status</th>
            <th class="text-center">
              <span class="flex items-center justify-center gap-1">
                <CreditCard :size="13" /> RFID
              </span>
            </th>
            <th class="text-center">
              <span class="flex items-center justify-center gap-1">
                <Camera :size="13" /> Photo
              </span>
            </th>
            <th>Joined</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0 && !isLoading">
            <td colspan="8" class="text-center py-16 text-muted">
              <div class="flex flex-col items-center gap-3">
                <Search :size="32" class="opacity-30" />
                <p class="text-sm font-semibold">No users found matching your filters.</p>
                <button @click="clearFilters" class="text-xs text-navy font-bold hover:underline">Clear filters</button>
              </div>
            </td>
          </tr>

          <tr v-for="user in users" :key="user.id" class="group">
            <!-- User info -->
            <td>
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-navy/8 flex items-center justify-center text-sm font-bold text-navy shrink-0">
                  {{ (user.profile?.full_name || user.email)?.charAt(0).toUpperCase() }}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-semibold truncate max-w-[160px]">{{ user.profile?.full_name || 'N/A' }}</span>
                  <span class="text-xs text-muted truncate max-w-[160px]">{{ user.email }}</span>
                </div>
              </div>
            </td>

            <!-- Role badge -->
            <td>
              <span :class="['badge border text-xs', getUserTypeColor(user.user_type)]">
                {{ user.user_type }}
              </span>
            </td>

            <!-- Identifier + Dept -->
            <td>
              <div class="flex flex-col">
                <span class="text-sm font-mono font-medium">{{ getIdentifier(user) }}</span>
                <span class="text-xs text-muted">{{ getDeptDisplay(user) }}</span>
              </div>
            </td>

            <!-- Status -->
            <td>
              <span :class="['badge', getStatusClass(user.status)]">{{ user.status }}</span>
            </td>

            <!-- RFID flag -->
            <td class="text-center">
              <span
                v-if="user.active_rfid"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700"
                :title="`RFID: ${user.active_rfid}`"
              >
                <CreditCard :size="12" /> Linked
              </span>
              <span v-else class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-muted">
                — None
              </span>
            </td>

            <!-- Photo flag -->
            <td class="text-center">
              <span
                v-if="(user.profile as any)?.photo_reference"
                class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700"
              >
                <Camera :size="12" /> Set
              </span>
              <span v-else class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-muted">
                — None
              </span>
            </td>

            <!-- Joined -->
            <td class="text-sm text-muted whitespace-nowrap">
              {{ new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }}
            </td>

            <!-- Actions -->
            <td class="text-right">
              <div class="relative inline-block">
                <button
                  class="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted transition-colors"
                  @click="showActionsFor = showActionsFor === user.id ? null : user.id"
                >
                  <MoreVertical :size="17" />
                </button>
                <div
                  v-if="showActionsFor === user.id"
                  class="absolute right-0 top-8 z-20 min-w-[140px] rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-1 shadow-lg"
                >
                  <button class="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors">
                    View profile
                  </button>
                  <button class="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-amber-700">
                    Suspend
                  </button>
                  <button class="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-red-600">
                    Deactivate
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm bg-[var(--bg-card)] rounded-b-2xl">
        <div class="text-muted">
          Showing
          <span class="font-semibold text-[var(--text-main)]">{{ users.length ? (page - 1) * limit + 1 : 0 }}</span>–<span class="font-semibold text-[var(--text-main)]">{{ Math.min(page * limit, total) }}</span>
          of <span class="font-semibold text-[var(--text-main)]">{{ total.toLocaleString() }}</span> users
        </div>
        <div class="flex items-center gap-1">
          <button
            class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-primary hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="page <= 1"
            @click="page--; fetchUsers()"
            id="prev-page-btn"
          >
            <ChevronLeft :size="16" />
          </button>

          <!-- Page numbers -->
          <button
            v-for="p in Math.min(totalPages, 7)"
            :key="p"
            @click="page = p; fetchUsers()"
            :class="[
              'h-8 min-w-[2rem] px-2 rounded-lg border text-xs font-bold transition',
              p === page
                ? 'bg-navy text-primary border-navy'
                : 'border-[var(--border-light)] text-muted hover:border-primary hover:text-navy'
            ]"
          >{{ p }}</button>
          <span v-if="totalPages > 7" class="text-muted px-1">…</span>

          <button
            class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-primary hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="page >= totalPages"
            @click="page++; fetchUsers()"
            id="next-page-btn"
          >
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
