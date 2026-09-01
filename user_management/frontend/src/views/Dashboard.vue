<script setup lang="ts">
import { ref, onMounted } from 'vue'
import dashboardService from '@/services/dashboardService'
import type { DashboardOverview } from '@/types'
import { Users, UserCheck, UserX, CreditCard, Loader2 } from 'lucide-vue-next'

const overview = ref<DashboardOverview | null>(null)
const isLoading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    overview.value = await dashboardService.getOverview()
  } catch (e: any) {
    error.value = 'Failed to load dashboard data.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-muted">Overview of OCOC identity and access system.</p>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <Loader2 class="animate-spin text-primary" :size="32" />
    </div>

    <div v-else-if="error" class="p-4 bg-[var(--status-error-bg)] text-[var(--status-error)] rounded-lg">
      {{ error }}
    </div>

    <div v-else-if="overview" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
      <!-- Total Users -->
      <div class="glass-panel p-6 flex items-center justify-between hover:-translate-y-1 transition-transform cursor-default">
        <div>
          <p class="text-sm font-medium text-muted mb-1">Total Users</p>
          <h3 class="text-3xl font-bold">{{ overview.total_users }}</h3>
        </div>
        <div class="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <Users :size="24" />
        </div>
      </div>

      <!-- Active Users -->
      <div class="glass-panel p-6 flex items-center justify-between hover:-translate-y-1 transition-transform cursor-default">
        <div>
          <p class="text-sm font-medium text-muted mb-1">Active Users</p>
          <h3 class="text-3xl font-bold">{{ overview.active_users }}</h3>
        </div>
        <div class="h-12 w-12 rounded-full bg-[var(--status-active-bg)] text-[var(--status-active)] flex items-center justify-center">
          <UserCheck :size="24" />
        </div>
      </div>

      <!-- Suspended Users -->
      <div class="glass-panel p-6 flex items-center justify-between hover:-translate-y-1 transition-transform cursor-default">
        <div>
          <p class="text-sm font-medium text-muted mb-1">Suspended</p>
          <h3 class="text-3xl font-bold">{{ overview.suspended_users }}</h3>
        </div>
        <div class="h-12 w-12 rounded-full bg-[var(--status-suspended-bg)] text-[var(--status-suspended)] flex items-center justify-center">
          <UserX :size="24" />
        </div>
      </div>

      <!-- Active RFIDs -->
      <div class="glass-panel p-6 flex items-center justify-between hover:-translate-y-1 transition-transform cursor-default">
        <div>
          <p class="text-sm font-medium text-muted mb-1">Active RFIDs</p>
          <h3 class="text-3xl font-bold">{{ overview.rfid_active }}</h3>
        </div>
        <div class="h-12 w-12 rounded-full bg-[rgba(99,102,241,0.15)] text-[var(--color-primary)] flex items-center justify-center">
          <CreditCard :size="24" />
        </div>
      </div>

      <!-- Persona Breakdown -->
      <div class="glass-panel p-6 lg:col-span-2">
        <h3 class="text-lg font-semibold mb-4 border-b border-[var(--border-light)] pb-2">User Breakdown</h3>
        <div class="flex justify-between items-end h-32">
          <div class="flex flex-col items-center gap-2 flex-1">
            <div class="w-12 bg-primary rounded-t-sm" :style="{ height: `${Math.max((overview.students / overview.total_users) * 100, 5)}%` }"></div>
            <span class="text-xs font-medium">Students ({{ overview.students }})</span>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <div class="w-12 bg-blue-500 rounded-t-sm" :style="{ height: `${Math.max((overview.faculty / overview.total_users) * 100, 5)}%` }"></div>
            <span class="text-xs font-medium">Faculty ({{ overview.faculty }})</span>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <div class="w-12 bg-green-500 rounded-t-sm" :style="{ height: `${Math.max((overview.workers / overview.total_users) * 100, 5)}%` }"></div>
            <span class="text-xs font-medium">Workers ({{ overview.workers }})</span>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <div class="w-12 bg-orange-400 rounded-t-sm" :style="{ height: `${Math.max((overview.visitors / overview.total_users) * 100, 5)}%` }"></div>
            <span class="text-xs font-medium">Visitors ({{ overview.visitors }})</span>
          </div>
        </div>
      </div>

      <!-- RFID Summary -->
      <div class="glass-panel p-6 lg:col-span-2 flex flex-col justify-center">
        <h3 class="text-lg font-semibold mb-6">RFID Directory Status</h3>
        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span>Total Issued</span>
              <span class="font-bold">{{ overview.rfid_issued }}</span>
            </div>
            <div class="w-full h-2 rounded-full bg-[var(--border-light)] overflow-hidden">
              <div class="h-full bg-blue-500" style="width: 100%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span>Active</span>
              <span class="font-bold">{{ overview.rfid_active }}</span>
            </div>
            <div class="w-full h-2 rounded-full bg-[var(--border-light)] overflow-hidden">
              <div class="h-full bg-[var(--status-active)]" :style="{ width: `${(overview.rfid_active / Math.max(overview.rfid_issued, 1)) * 100}%` }"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span>Revoked / Replaced</span>
              <span class="font-bold">{{ overview.rfid_revoked }}</span>
            </div>
            <div class="w-full h-2 rounded-full bg-[var(--border-light)] overflow-hidden">
              <div class="h-full bg-[var(--status-error)]" :style="{ width: `${(overview.rfid_revoked / Math.max(overview.rfid_issued, 1)) * 100}%` }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
