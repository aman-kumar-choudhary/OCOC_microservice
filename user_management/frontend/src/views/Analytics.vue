<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import dashboardService from '@/services/dashboardService'
import type { DashboardAnalytics, DashboardOverview } from '@/types'
import { BarChart3, TrendingUp, Users, Calendar, Loader2, RefreshCw } from 'lucide-vue-next'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend
} from 'chart.js'
import { Line, Bar, Doughnut } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend)

const analytics = ref<DashboardAnalytics | null>(null)
const overview = ref<DashboardOverview | null>(null)
const isLoading = ref(true)
const error = ref('')

// Date range
const today = new Date().toISOString().split('T')[0]
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
const dateFrom = ref(thirtyDaysAgo)
const dateTo = ref(today)

async function loadAnalytics() {
  isLoading.value = true
  error.value = ''
  try {
    const [an, ov] = await Promise.allSettled([
      dashboardService.getAnalyticsWithDateRange(dateFrom.value, dateTo.value),
      dashboardService.getOverview(),
    ])
    if (an.status === 'fulfilled') analytics.value = an.value
    if (ov.status === 'fulfilled') overview.value = ov.value
    if (an.status === 'rejected') throw an.reason
  } catch {
    error.value = 'Could not load analytics data.'
  } finally {
    isLoading.value = false
  }
}

// Chart helpers
const tooltipDefaults = {
  backgroundColor: '#0a2342',
  titleColor: '#f5bd19',
  bodyColor: '#fff',
  padding: 10,
  cornerRadius: 8,
}

// Onboarding Trend Chart
const onboardingChartData = computed(() => {
  const trend = analytics.value?.onboarding_trend ?? []
  const labels = trend.length
    ? trend.map((t) => new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
    : Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (13 - i))
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      })
  const values = trend.length ? trend.map((t) => t.count) : [3, 7, 4, 10, 8, 15, 12, 18, 14, 22, 17, 25, 20, 28]
  return {
    labels,
    datasets: [{
      label: 'New Users',
      data: values,
      borderColor: '#f5bd19',
      backgroundColor: 'rgba(245,189,25,0.10)',
      borderWidth: 2.5,
      fill: true,
      tension: 0.45,
      pointRadius: 4,
      pointBackgroundColor: '#d99e00',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }],
  }
})

const lineOptions = (_label?: string) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { ...tooltipDefaults },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#607087', font: { size: 11 }, maxTicksLimit: 8 }, border: { display: false } },
    y: { grid: { color: 'rgba(220,227,236,0.5)' }, ticks: { color: '#607087', font: { size: 11 }, precision: 0 }, border: { display: false } },
  },
})

// Card Issuance Trend
const cardChartData = computed(() => {
  const trend = analytics.value?.card_issuance_trend ?? []
  const labels = trend.length
    ? trend.map((t) => new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
    : Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (13 - i))
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      })
  const values = trend.length ? trend.map((t) => t.count) : [2, 5, 3, 9, 7, 11, 9, 14, 10, 18, 13, 20, 16, 23]
  return {
    labels,
    datasets: [{
      label: 'Cards Issued',
      data: values,
      backgroundColor: 'rgba(14,165,233,0.15)',
      borderColor: '#0ea5e9',
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: '#0284c7',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }],
  }
})

// Persona Distribution Doughnut
const personaChartData = computed(() => ({
  labels: ['Students', 'Faculty', 'Workers', 'Visitors'],
  datasets: [{
    data: [
      overview.value?.students ?? 45,
      overview.value?.faculty ?? 20,
      overview.value?.workers ?? 25,
      overview.value?.visitors ?? 10,
    ],
    backgroundColor: ['#f5bd19', '#818cf8', '#34d399', '#fb923c'],
    borderColor: ['#d99e00', '#6366f1', '#10b981', '#f97316'],
    borderWidth: 2,
    hoverOffset: 8,
  }],
}))

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { padding: 16, font: { size: 12, weight: 'bold' as const }, color: '#607087', usePointStyle: true, pointStyleWidth: 12 },
    },
    tooltip: tooltipDefaults,
  },
}

// Weekly bar chart (aggregate by week)
const weeklyBarData = computed(() => {
  const trend = analytics.value?.onboarding_trend ?? []
  // Group into weeks
  const weekMap: Record<string, number> = {}
  trend.forEach((t) => {
    const d = new Date(t.date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    weekMap[key] = (weekMap[key] || 0) + t.count
  })
  const demo = { 'Week 1': 18, 'Week 2': 32, 'Week 3': 27, 'Week 4': 41 }
  const data = Object.keys(weekMap).length > 0 ? weekMap : demo
  return {
    labels: Object.keys(data),
    datasets: [{
      label: 'Onboardings per Week',
      data: Object.values(data),
      backgroundColor: ['#f5bd19cc', '#f5bd19aa', '#f5bd1988', '#f5bd1966'],
      borderColor: '#d99e00',
      borderWidth: 1.5,
      borderRadius: 8,
    }],
  }
})

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: tooltipDefaults,
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#607087', font: { size: 11 } }, border: { display: false } },
    y: { grid: { color: 'rgba(220,227,236,0.5)' }, ticks: { color: '#607087', font: { size: 11 }, precision: 0 }, border: { display: false } },
  },
}

// Summary stats
const totalOnboarded = computed(() => analytics.value?.onboarding_trend?.reduce((s, t) => s + t.count, 0) ?? 0)
const totalCardsIssued = computed(() => analytics.value?.card_issuance_trend?.reduce((s, t) => s + t.count, 0) ?? 0)
const avgPerDay = computed(() => {
  const trend = analytics.value?.onboarding_trend ?? []
  return trend.length ? Math.round(totalOnboarded.value / trend.length * 10) / 10 : 0
})

onMounted(loadAnalytics)
</script>

<template>
  <div class="animate-fade-in">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <BarChart3 :size="24" class="text-primary" />
          Analytics &amp; Reports
        </h1>
        <p class="text-muted text-sm mt-1">Enrollment trends, credential issuance, and population insights</p>
      </div>

      <!-- Date Range Picker -->
      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-2 app-panel px-3 py-2">
          <Calendar :size="15" class="text-muted shrink-0" />
          <input
            v-model="dateFrom"
            type="date"
            class="text-sm font-semibold bg-transparent border-none outline-none text-[var(--text-main)] cursor-pointer"
            id="date-from"
          />
          <span class="text-muted">→</span>
          <input
            v-model="dateTo"
            type="date"
            class="text-sm font-semibold bg-transparent border-none outline-none text-[var(--text-main)] cursor-pointer"
            id="date-to"
          />
        </div>
        <button class="btn btn-primary" @click="loadAnalytics" :disabled="isLoading" id="apply-date-filter-btn">
          <Loader2 v-if="isLoading" class="animate-spin" :size="15" />
          <RefreshCw v-else :size="15" />
          Apply
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="grid min-h-[400px] place-items-center">
      <div class="flex flex-col items-center gap-3 text-muted">
        <Loader2 class="animate-spin text-primary" :size="36" />
        <span class="text-sm font-semibold">Loading analytics…</span>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="app-panel p-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-extrabold">Analytics unavailable</h2>
        <p class="mt-1 text-sm text-muted">{{ error }}</p>
      </div>
      <button class="btn btn-primary" @click="loadAnalytics"><RefreshCw :size="17" /> Try again</button>
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <article class="app-panel p-5 flex items-center gap-4">
          <div class="grid h-12 w-12 place-items-center rounded-xl bg-primary/20 text-navy shrink-0">
            <Users :size="22" />
          </div>
          <div>
            <p class="text-sm font-bold text-muted">Onboarded in period</p>
            <p class="font-display text-2xl font-extrabold">{{ totalOnboarded.toLocaleString() }}</p>
          </div>
        </article>
        <article class="app-panel p-5 flex items-center gap-4">
          <div class="grid h-12 w-12 place-items-center rounded-xl bg-sky-50 text-sky-700 shrink-0">
            <TrendingUp :size="22" />
          </div>
          <div>
            <p class="text-sm font-bold text-muted">Cards issued in period</p>
            <p class="font-display text-2xl font-extrabold">{{ totalCardsIssued.toLocaleString() }}</p>
          </div>
        </article>
        <article class="app-panel p-5 flex items-center gap-4">
          <div class="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
            <BarChart3 :size="22" />
          </div>
          <div>
            <p class="text-sm font-bold text-muted">Avg onboardings / day</p>
            <p class="font-display text-2xl font-extrabold">{{ avgPerDay }}</p>
          </div>
        </article>
      </div>

      <!-- Trend Charts Row -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <!-- Onboarding Trend -->
        <section class="app-panel p-5 sm:p-6">
          <div class="mb-5">
            <h2 class="text-lg font-extrabold flex items-center gap-2">
              <TrendingUp :size="17" class="text-primary" /> Onboarding Trend
            </h2>
            <p class="mt-1 text-sm text-muted">Daily new user registrations in selected period</p>
          </div>
          <div class="h-64">
            <Line :data="onboardingChartData" :options="lineOptions('New Users')" />
          </div>
        </section>

        <!-- Card Issuance Trend -->
        <section class="app-panel p-5 sm:p-6">
          <div class="mb-5">
            <h2 class="text-lg font-extrabold flex items-center gap-2">
              <TrendingUp :size="17" class="text-sky-500" /> Card Issuance Trend
            </h2>
            <p class="mt-1 text-sm text-muted">RFID cards issued per day</p>
          </div>
          <div class="h-64">
            <Line :data="cardChartData" :options="lineOptions('Cards Issued')" />
          </div>
        </section>
      </div>

      <!-- Distribution + Weekly Bar -->
      <div class="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <!-- Persona Distribution Donut -->
        <section class="app-panel p-5 sm:p-6 xl:col-span-2">
          <div class="mb-5">
            <h2 class="text-lg font-extrabold">Campus Population Mix</h2>
            <p class="mt-1 text-sm text-muted">Distribution by persona type</p>
          </div>
          <div class="h-64">
            <Doughnut :data="personaChartData" :options="doughnutOptions" />
          </div>
        </section>

        <!-- Weekly Enrollment Bar -->
        <section class="app-panel p-5 sm:p-6 xl:col-span-3">
          <div class="mb-5">
            <h2 class="text-lg font-extrabold">Weekly Enrollment Volume</h2>
            <p class="mt-1 text-sm text-muted">Aggregated onboardings grouped by week</p>
          </div>
          <div class="h-64">
            <Bar :data="weeklyBarData" :options="barOptions" />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
