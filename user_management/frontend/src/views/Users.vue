<script setup lang="ts">
import { ref, onMounted } from 'vue'
import userService from '@/services/userService'
import type { User } from '@/types'
import { Search, Download, MoreVertical, Loader2, UploadCloud } from 'lucide-vue-next'

const users = ref<User[]>([])
const isLoading = ref(true)
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const totalPages = ref(1)

const filters = ref({
  search: '',
  user_type: '',
  status: ''
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

function handleSearch() {
  page.value = 1
  fetchUsers()
}

function getStatusClass(status: string) {
  if (status === 'active') return 'badge-active'
  if (status === 'suspended') return 'badge-suspended'
  return 'badge-deactivated'
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold">User Directory</h1>
        <p class="text-muted text-sm">Manage all OCOC identities and their status.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline" title="Import CSV">
          <UploadCloud :size="18" /> Import
        </button>
        <button class="btn btn-outline" title="Export CSV">
          <Download :size="18" /> Export
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass-panel p-4 mb-6 flex flex-col md:flex-row gap-4">
      <div class="relative flex-1">
        <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input 
          v-model="filters.search" 
          @keyup.enter="handleSearch"
          type="text" 
          placeholder="Search name, email, roll number..." 
          class="form-input pl-10"
        />
      </div>
      <div class="flex gap-4">
        <select v-model="filters.user_type" @change="handleSearch" class="form-input form-select min-w-[140px]">
          <option value="">All Types</option>
          <option value="student">Student</option>
          <option value="faculty">Faculty</option>
          <option value="worker">Worker</option>
          <option value="visitor">Visitor</option>
        </select>
        <select v-model="filters.status" @change="handleSearch" class="form-input form-select min-w-[140px]">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-container animate-fade-in relative">
      <div v-if="isLoading" class="absolute inset-0 bg-[var(--bg-card)]/50 backdrop-blur-sm z-10 flex items-center justify-center">
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>
      
      <table class="table min-w-full">
        <thead>
          <tr>
            <th>User</th>
            <th>Type</th>
            <th>Identifier</th>
            <th>Status</th>
            <th>Joined</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0 && !isLoading">
            <td colspan="6" class="text-center py-8 text-muted">No users found matching your filters.</td>
          </tr>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="flex flex-col">
                <span class="font-medium">{{ user.profile?.full_name || 'N/A' }}</span>
                <span class="text-xs text-muted">{{ user.email }}</span>
              </div>
            </td>
            <td>
              <span class="badge badge-outline capitalize">{{ user.user_type }}</span>
            </td>
            <td>
              <span class="text-sm font-mono text-muted">
                {{ user.profile?.roll_number || user.profile?.employee_id || user.profile?.gov_id_number || '-' }}
              </span>
            </td>
            <td>
              <span :class="['badge', getStatusClass(user.status)]">{{ user.status }}</span>
            </td>
            <td class="text-sm text-muted">
              {{ new Date(user.created_at).toLocaleDateString() }}
            </td>
            <td class="text-right">
              <button class="p-1 rounded hover:bg-[var(--border-light)] text-muted transition-colors">
                <MoreVertical :size="18" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Pagination -->
      <div class="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm">
        <div class="text-muted">
          Showing <span class="font-medium">{{ users.length ? (page - 1) * limit + 1 : 0 }}</span> to 
          <span class="font-medium">{{ Math.min(page * limit, total) }}</span> of 
          <span class="font-medium">{{ total }}</span> results
        </div>
        <div class="flex gap-2">
          <button 
            class="btn btn-outline py-1 px-3" 
            :disabled="page <= 1"
            @click="page--; fetchUsers()"
          >Prev</button>
          <button 
            class="btn btn-outline py-1 px-3" 
            :disabled="page >= totalPages"
            @click="page++; fetchUsers()"
          >Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
