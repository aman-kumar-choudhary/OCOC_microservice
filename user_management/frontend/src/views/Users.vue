<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import userService from '@/services/userService'
import type { User } from '@/types'
import { formatDate } from '@/utils/date'
import {
  Search, Download, Loader2, CreditCard, Camera,
  ChevronLeft, ChevronRight, X, Filter, Edit2,
  ShieldOff, ShieldCheck, UserX, MoreVertical
} from 'lucide-vue-next'
import EditUserModal from '@/components/EditUserModal.vue'
import UserStatusModal from '@/components/UserStatusModal.vue'

const users = ref<User[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const totalPages = ref(1)
const exportLoading = ref(false)

// Modal state
const editTarget = ref<User | null>(null)
const statusTarget = ref<User | null>(null)
const statusAction = ref<'suspend' | 'activate' | 'deactivate'>('suspend')
const showActions = ref<string | null>(null)

const filters = ref({
  search: '',
  user_type: '',
  status: ''
})

let searchTimeout: ReturnType<typeof setTimeout>
watch(() => filters.value.search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 1; fetchUsers() }, 350)
})

async function fetchUsers() {
  isLoading.value = true
  try {
    const data = await userService.list({ page: page.value, limit: limit.value, ...filters.value })
    users.value = data.users || []
    total.value = data.total
    totalPages.value = data.total_pages
  } catch (e) { console.error(e) }
  finally { isLoading.value = false }
}

function handleFilterChange() { page.value = 1; fetchUsers() }

function clearFilters() {
  filters.value = { search: '', user_type: '', status: '' }
  page.value = 1; fetchUsers()
}

const hasActiveFilters = () => filters.value.search || filters.value.user_type || filters.value.status

function getStatusClass(status: string) {
  if (status === 'active') return 'badge-active'
  if (status === 'suspended') return 'badge-suspended'
  return 'badge-deactivated'
}

function getRoleColor(type: string) {
  const map: Record<string, string> = {
    student: 'bg-blue-50 text-blue-700 border-blue-200',
    faculty: 'bg-purple-50 text-purple-700 border-purple-200',
    worker: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    visitor: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return map[type] || 'bg-gray-50 text-gray-700 border-gray-200'
}

function getIdentifier(user: User) {
  const p = user.profile
  return p?.roll_number || p?.employee_id || (p as any)?.gov_id_number || '—'
}

function getUserName(user: User) {
  return user.profile?.full_name || 'Unnamed User'
}

function openAction(user: User, action: 'suspend' | 'activate' | 'deactivate') {
  statusTarget.value = user
  statusAction.value = action
  showActions.value = null
}

async function exportToCSV() {
  exportLoading.value = true
  try {
    const data = await userService.list({ page: 1, limit: 10000, ...filters.value })
    const rows = data.users || []
    const headers = ['Name', 'Email', 'Phone', 'Type', 'Identifier', 'Department', 'Status', 'RFID Tag', 'Joined']
    const csvContent = [
      headers.join(','),
      ...rows.map((u) => [
        `"${getUserName(u)}"`, `"${u.email}"`, `"${u.phone || ''}"`, u.user_type,
        `"${getIdentifier(u)}"`, `"${(u.profile as any)?.department || ''}"`,
        u.status, u.active_rfid || '',
        formatDate(u.created_at),
      ].join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ococ-users-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  } catch (e) { console.error(e) }
  finally { exportLoading.value = false }
}

onMounted(fetchUsers)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold">User Directory</h1>
        <p class="text-muted text-sm mt-1">
          <span v-if="!isLoading">{{ total.toLocaleString() }} campus identities</span>
          <span v-else>Loading directory…</span>
        </p>
      </div>
      <button class="btn btn-primary" @click="exportToCSV" :disabled="exportLoading" id="export-csv-btn">
        <Loader2 v-if="exportLoading" class="animate-spin" :size="16" />
        <Download v-else :size="16" />
        Export CSV
      </button>
    </div>

    <!-- Filters -->
    <div class="glass-panel p-4 mb-6">
      <div class="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div class="relative flex-1 min-w-0">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input v-model="filters.search" type="text" placeholder="Search name, email, roll number…" class="form-input pl-9 pr-8" id="user-search-input" />
          <button v-if="filters.search" @click="filters.search = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-red-500 transition-colors">
            <X :size="15" />
          </button>
        </div>
        <div class="flex gap-3 flex-wrap">
          <div class="relative">
            <Filter :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <select v-model="filters.user_type" @change="handleFilterChange" class="form-input form-select pl-8 min-w-[150px]" id="user-type-filter">
              <option value="">All Roles</option>
              <option value="student">🎓 Student</option>
              <option value="faculty">👨‍🏫 Faculty</option>
              <option value="worker">🔧 Worker</option>
              <option value="visitor">👤 Visitor</option>
            </select>
          </div>
          <select v-model="filters.status" @change="handleFilterChange" class="form-input form-select min-w-[145px]" id="status-filter">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <button v-if="hasActiveFilters()" @click="clearFilters" class="btn btn-outline text-red-500 border-red-200 hover:bg-red-50 px-3" id="clear-filters-btn">
            <X :size="15" /> Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container animate-fade-in relative">
      <div v-if="isLoading" class="absolute inset-0 bg-[var(--bg-card)]/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>

      <table class="table min-w-full">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Identifier</th>
            <th>Department / School</th>
            <th>Status</th>
            <th class="text-center"><span class="flex items-center justify-center gap-1"><CreditCard :size="13" /> RFID Tag</span></th>
            <th class="text-center"><span class="flex items-center justify-center gap-1"><Camera :size="13" /> Photo</span></th>
            <th>Joined</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0 && !isLoading">
            <td colspan="9" class="text-center py-16 text-muted">
              <div class="flex flex-col items-center gap-3">
                <Search :size="32" class="opacity-30" />
                <p class="text-sm font-semibold">No users match your filters.</p>
                <button @click="clearFilters" class="text-xs text-navy font-bold hover:underline">Clear filters</button>
              </div>
            </td>
          </tr>

          <tr v-for="user in users" :key="user.id" class="group">
            <!-- User -->
            <td>
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-navy/8 flex items-center justify-center text-sm font-bold text-navy shrink-0">
                  {{ getUserName(user).charAt(0).toUpperCase() }}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-semibold truncate max-w-[150px]">{{ getUserName(user) }}</span>
                  <span class="text-xs text-muted truncate max-w-[150px]">{{ user.email }}</span>
                </div>
              </div>
            </td>

            <!-- Role -->
            <td>
              <span :class="['badge border text-xs capitalize', getRoleColor(user.user_type)]">{{ user.user_type }}</span>
            </td>

            <!-- Identifier (roll / employee / gov ID) -->
            <td>
              <span class="text-sm font-mono font-medium">{{ getIdentifier(user) }}</span>
            </td>

            <!-- Dept / School -->
            <td>
              <span class="text-sm text-muted">{{ (user.profile as any)?.department || (user.profile as any)?.school || '—' }}</span>
            </td>

            <!-- Status -->
            <td>
              <span :class="['badge', getStatusClass(user.status)]">{{ user.status }}</span>
            </td>

            <!-- RFID Tag -->
            <td class="text-center">
              <span v-if="user.active_rfid" class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 font-mono" :title="user.active_rfid">
                <CreditCard :size="12" /> {{ user.active_rfid.slice(0, 8) }}…
              </span>
              <span v-else class="text-xs text-muted">— None</span>
            </td>

            <!-- Photo -->
            <td class="text-center">
              <span v-if="(user.profile as any)?.photo_reference" class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                <Camera :size="12" /> Set
              </span>
              <span v-else class="text-xs text-muted">— None</span>
            </td>

            <!-- Joined -->
            <td class="text-sm text-muted whitespace-nowrap">{{ formatDate(user.created_at) }}</td>

            <!-- Actions -->
            <td class="text-right">
              <div class="relative inline-block">
                <button class="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted transition-colors" @click.stop="showActions = showActions === user.id ? null : user.id">
                  <MoreVertical :size="17" />
                </button>
                <div v-if="showActions === user.id" class="absolute right-0 top-9 z-20 min-w-[170px] rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-1 shadow-xl">
                  <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors"
                    @click="editTarget = user; showActions = null">
                    <Edit2 :size="14" /> Edit Profile
                  </button>
                  <template v-if="user.status !== 'active'">
                    <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-emerald-700"
                      @click="openAction(user, 'activate')">
                      <ShieldCheck :size="14" /> Activate
                    </button>
                  </template>
                  <template v-if="user.status === 'active'">
                    <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-amber-700"
                      @click="openAction(user, 'suspend')">
                      <ShieldOff :size="14" /> Suspend
                    </button>
                  </template>
                  <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-red-600"
                    @click="openAction(user, 'deactivate')">
                    <UserX :size="14" /> Deactivate
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
          Showing <span class="font-semibold text-[var(--text-main)]">{{ users.length ? (page - 1) * limit + 1 : 0 }}</span>–<span class="font-semibold text-[var(--text-main)]">{{ Math.min(page * limit, total) }}</span>
          of <span class="font-semibold text-[var(--text-main)]">{{ total.toLocaleString() }}</span>
        </div>
        <div class="flex items-center gap-1">
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-primary hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed" :disabled="page <= 1" @click="page--; fetchUsers()" id="prev-page-btn">
            <ChevronLeft :size="16" />
          </button>
          <button v-for="p in Math.min(totalPages, 7)" :key="p" @click="page = p; fetchUsers()" :class="['h-8 min-w-[2rem] px-2 rounded-lg border text-xs font-bold transition', p === page ? 'bg-navy text-primary border-navy' : 'border-[var(--border-light)] text-muted hover:border-primary hover:text-navy']">{{ p }}</button>
          <span v-if="totalPages > 7" class="text-muted px-1">…</span>
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-primary hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed" :disabled="page >= totalPages" @click="page++; fetchUsers()" id="next-page-btn">
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <EditUserModal v-if="editTarget" :user="editTarget" @close="editTarget = null" @saved="fetchUsers" />
    <UserStatusModal
      v-if="statusTarget"
      :user="statusTarget"
      :action="statusAction"
      @close="statusTarget = null"
      @done="fetchUsers"
    />
  </div>
</template>
