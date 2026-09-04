<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dashboardService from '@/services/dashboardService'
import type { DashboardOverview, DashboardAnalytics } from '@/types'
import {
  ArrowRight, CreditCard, Loader2, RefreshCw, ShieldCheck,
  TrendingUp, UserCheck, UserPlus, Users, UserX, BarChart3
} from 'lucide-vue-next'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const router = useRouter()
const overview = ref<DashboardOverview | null>(null)
const analytics = ref<DashboardAnalytics | null>(null)
const isLoading = ref(true)
const error = ref('')

// Animated counters
const animatedStats = ref({ total: 0, active: 0, suspended: 0, rfid: 0 })
function animateTo(key: keyof typeof animatedStats.value, target: number) {
  const duration = 800
  const start = animatedStats.value[key]
  const diff = target - start
  const startTime = performance.now()
  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
    animatedStats.value[key] = Math.round(start + diff * eased)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

watch(overview, (val) => {
  if (!val) return
  animateTo('total', val.total_users)
  animateTo('active', val.active_users)
  animateTo('suspended', val.suspended_users)
  animateTo('rfid', val.rfid_active)
})

const personas = computed(() => {
  if (!overview.value) return []
  const total = Math.max(overview.value.total_users, 1)
  return [
    { label: 'Students', value: overview.value.students, color: 'bg-primary', text: 'text-navy' },
    { label: 'Faculty', value: overview.value.faculty, color: 'bg-sky-500', text: 'text-sky-700' },
    { label: 'Staff', value: overview.value.workers, color: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'Visitors', value: overview.value.visitors, color: 'bg-violet-500', text: 'text-violet-700' },
  ].map((p) => ({ ...p, percent: Math.round((p.value / total) * 100) }))
})

// Chart data
const trendChartData = computed(() => {
  const trend = analytics.value?.onboarding_trend ?? []
  // If no real data, produce a demo sparkline
  const labels = trend.length
    ? trend.map((t) => {
        const d = new Date(t.date)
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      })
    : Array.from({ length: 14 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (13 - i))
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      })
  const values = trend.length
    ? trend.map((t) => t.count)
    : [2, 5, 3, 8, 6, 12, 9, 15, 11, 18, 14, 20, 17, 22]

  return {
    labels,
    datasets: [
      {
        label: 'New Registrations',
        data: values,
        borderColor: '#f5bd19',
        backgroundColor: 'rgba(245,189,25,0.12)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.45,
        pointRadius: 3,
        pointBackgroundColor: '#d99e00',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  }
})

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0a2342',
      titleColor: '#f5bd19',
      bodyColor: '#fff',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#607087', font: { size: 11 }, maxTicksLimit: 7 },
      border: { display: false },
    },
    y: {
      grid: { color: 'rgba(220,227,236,0.5)' },
      ticks: { color: '#607087', font: { size: 11 }, precision: 0 },
      border: { display: false },
    },
  },
}

async function loadOverview() {
  isLoading.value = true
  error.value = ''
  try {
    const [ov, an] = await Promise.allSettled([
      dashboardService.getOverview(),
      dashboardService.getAnalytics(),
    ])
    if (ov.status === 'fulfilled') overview.value = ov.value
    if (an.status === 'fulfilled') analytics.value = an.value
    if (ov.status === 'rejected') throw ov.reason
  } catch {
    error.value = 'We could not load the latest campus access data.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadOverview)
</script>

<template>
  <section class="animate-fade-in">
    <!-- Hero Banner -->
    <div class="overflow-hidden rounded-2xl bg-navy text-white shadow-[0_18px_48px_rgb(10_35_66/0.18)]">
      <div class="relative px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <div class="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-primary/15" />
        <div class="absolute bottom-0 right-16 h-24 w-24 rounded-t-full bg-primary/10" />
        <div class="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div class="max-w-2xl">
            <div class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              <ShieldCheck :size="16" /> Campus access command centre
            </div>
            <h1 class="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Identity operations, made clear.</h1>
            <p class="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Monitor people, credentials, and access status from one secure workspace built for day-to-day university operations.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="btn btn-primary" @click="router.push('/onboarding')"><UserPlus :size="17" /> Onboard person</button>
            <button class="btn border border-white/20 bg-white/5 text-white hover:bg-white/10" @click="router.push('/users')">Open directory <ArrowRight :size="17" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="grid min-h-[420px] place-items-center">
      <div class="flex flex-col items-center gap-3 text-muted"><Loader2 class="animate-spin text-primary" :size="32" /><span class="text-sm font-semibold">Loading your dashboard…</span></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="app-panel mt-6 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 class="text-lg font-extrabold">Dashboard unavailable</h2><p class="mt-1 text-sm text-muted">{{ error }}</p></div>
      <button class="btn btn-primary" @click="loadOverview"><RefreshCw :size="17" /> Try again</button>
    </div>

    <template v-else-if="overview">
      <!-- KPI Cards -->
      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
          <div class="flex items-start justify-between">
            <p class="text-sm font-bold text-muted">People in directory</p>
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-navy/8 text-navy"><Users :size="20" /></div>
          </div>
          <p class="mt-5 font-display text-3xl font-extrabold tabular-nums">{{ animatedStats.total.toLocaleString() }}</p>
          <p class="mt-1 text-xs font-semibold text-muted">All campus identities</p>
        </article>

        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
          <div class="flex items-start justify-between">
            <p class="text-sm font-bold text-muted">Active accounts</p>
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UserCheck :size="20" /></div>
          </div>
          <p class="mt-5 font-display text-3xl font-extrabold tabular-nums">{{ animatedStats.active.toLocaleString() }}</p>
          <p class="mt-1 text-xs font-semibold text-emerald-700">Enabled for access</p>
        </article>

        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
          <div class="flex items-start justify-between">
            <p class="text-sm font-bold text-muted">Suspended</p>
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><UserX :size="20" /></div>
          </div>
          <p class="mt-5 font-display text-3xl font-extrabold tabular-nums">{{ animatedStats.suspended.toLocaleString() }}</p>
          <p class="mt-1 text-xs font-semibold text-muted">Require review</p>
        </article>

        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-default">
          <div class="flex items-start justify-between">
            <p class="text-sm font-bold text-muted">Active RFID cards</p>
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-navy"><CreditCard :size="20" /></div>
          </div>
          <p class="mt-5 font-display text-3xl font-extrabold tabular-nums">{{ animatedStats.rfid.toLocaleString() }}</p>
          <p class="mt-1 text-xs font-semibold text-muted">Ready for campus access</p>
        </article>
      </div>

      <!-- Activity Chart + Population -->
      <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <!-- Trend Chart -->
        <section class="app-panel p-5 sm:p-6 xl:col-span-3">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-lg font-extrabold flex items-center gap-2"><TrendingUp :size="18" class="text-primary" /> Daily Registration Activity</h2>
              <p class="mt-1 text-sm text-muted">New onboarding events over the last 14 days</p>
            </div>
            <button class="text-xs font-bold text-navy hover:text-primary transition-colors flex items-center gap-1" @click="router.push('/analytics')">
              Full analytics <ArrowRight :size="14" />
            </button>
          </div>
          <div class="h-56">
            <Line :data="trendChartData" :options="trendChartOptions" />
          </div>
        </section>

        <!-- Campus Population + RFID Health -->
        <div class="xl:col-span-2 flex flex-col gap-6">
          <section class="app-panel p-5 sm:p-6 flex-1">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-extrabold">Campus population</h2>
                <p class="mt-1 text-sm text-muted">Directory composition</p>
              </div>
              <span class="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-navy">{{ overview.total_users }} total</span>
            </div>
            <div class="mt-5 space-y-4">
              <div v-for="persona in personas" :key="persona.label">
                <div class="mb-1.5 flex items-center justify-between text-sm">
                  <span class="font-bold">{{ persona.label }}</span>
                  <span class="font-bold" :class="persona.text">{{ persona.value }} <span class="font-medium text-muted">({{ persona.percent }}%)</span></span>
                </div>
                <div class="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full transition-all duration-700 ease-out" :class="persona.color" :style="{ width: `${persona.percent}%` }" />
                </div>
              </div>
            </div>
          </section>

          <section class="app-panel p-5 sm:p-6">
            <div><h2 class="text-lg font-extrabold flex items-center gap-2"><BarChart3 :size="18" class="text-sky-500" /> Credential health</h2><p class="mt-1 text-sm text-muted">RFID card lifecycle</p></div>
            <div class="mt-4 divide-y divide-[var(--border-light)]">
              <div class="flex items-center justify-between py-3"><span class="text-sm font-semibold">Cards issued</span><span class="font-display text-xl font-extrabold">{{ overview.rfid_issued }}</span></div>
              <div class="flex items-center justify-between py-3"><span class="text-sm font-semibold">Cards active</span><span class="font-display text-xl font-extrabold text-emerald-700">{{ overview.rfid_active }}</span></div>
              <div class="flex items-center justify-between py-3"><span class="text-sm font-semibold">Revoked or replaced</span><span class="font-display text-xl font-extrabold text-red-700">{{ overview.rfid_revoked }}</span></div>
            </div>
            <button class="mt-3 flex items-center gap-2 text-sm font-bold text-navy hover:text-primary-hover transition-colors" @click="router.push('/rfid')">Manage RFID cards <ArrowRight :size="16" /></button>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>
