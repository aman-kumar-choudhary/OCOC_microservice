<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import dashboardService from '@/services/dashboardService'
import type { DashboardOverview } from '@/types'
import { ArrowRight, CreditCard, Loader2, RefreshCw, ShieldCheck, UserCheck, UserPlus, Users, UserX } from 'lucide-vue-next'

const router = useRouter()
const overview = ref<DashboardOverview | null>(null)
const isLoading = ref(true)
const error = ref('')

const personas = computed(() => {
  if (!overview.value) return []
  const total = Math.max(overview.value.total_users, 1)
  return [
    { label: 'Students', value: overview.value.students, color: 'bg-primary', text: 'text-navy' },
    { label: 'Faculty', value: overview.value.faculty, color: 'bg-sky-500', text: 'text-sky-700' },
    { label: 'Staff', value: overview.value.workers, color: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'Visitors', value: overview.value.visitors, color: 'bg-violet-500', text: 'text-violet-700' },
  ].map((persona) => ({ ...persona, percent: Math.round((persona.value / total) * 100) }))
})

async function loadOverview() {
  isLoading.value = true
  error.value = ''
  try {
    overview.value = await dashboardService.getOverview()
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

    <div v-if="isLoading" class="grid min-h-[420px] place-items-center">
      <div class="flex flex-col items-center gap-3 text-muted"><Loader2 class="animate-spin text-primary" :size="32" /><span class="text-sm font-semibold">Loading your dashboard…</span></div>
    </div>

    <div v-else-if="error" class="app-panel mt-6 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 class="text-lg font-extrabold">Dashboard unavailable</h2><p class="mt-1 text-sm text-muted">{{ error }}</p></div>
      <button class="btn btn-primary" @click="loadOverview"><RefreshCw :size="17" /> Try again</button>
    </div>

    <template v-else-if="overview">
      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between"><p class="text-sm font-bold text-muted">People in directory</p><div class="grid h-10 w-10 place-items-center rounded-xl bg-navy/8 text-navy"><Users :size="20" /></div></div>
          <p class="mt-5 font-display text-3xl font-extrabold">{{ overview.total_users }}</p><p class="mt-1 text-xs font-semibold text-muted">All campus identities</p>
        </article>
        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between"><p class="text-sm font-bold text-muted">Active accounts</p><div class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UserCheck :size="20" /></div></div>
          <p class="mt-5 font-display text-3xl font-extrabold">{{ overview.active_users }}</p><p class="mt-1 text-xs font-semibold text-emerald-700">Enabled for access</p>
        </article>
        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between"><p class="text-sm font-bold text-muted">Suspended</p><div class="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><UserX :size="20" /></div></div>
          <p class="mt-5 font-display text-3xl font-extrabold">{{ overview.suspended_users }}</p><p class="mt-1 text-xs font-semibold text-muted">Require review</p>
        </article>
        <article class="app-panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between"><p class="text-sm font-bold text-muted">Active RFID cards</p><div class="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-navy"><CreditCard :size="20" /></div></div>
          <p class="mt-5 font-display text-3xl font-extrabold">{{ overview.rfid_active }}</p><p class="mt-1 text-xs font-semibold text-muted">Ready for campus access</p>
        </article>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section class="app-panel p-5 sm:p-6 xl:col-span-3">
          <div class="flex items-center justify-between"><div><h2 class="text-lg font-extrabold">Campus population</h2><p class="mt-1 text-sm text-muted">Directory composition by persona</p></div><span class="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-navy">{{ overview.total_users }} total</span></div>
          <div class="mt-7 space-y-5">
            <div v-for="persona in personas" :key="persona.label">
              <div class="mb-2 flex items-center justify-between text-sm"><span class="font-bold">{{ persona.label }}</span><span class="font-bold" :class="persona.text">{{ persona.value }} <span class="font-medium text-muted">({{ persona.percent }}%)</span></span></div>
              <div class="h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full transition-all duration-500" :class="persona.color" :style="{ width: `${persona.percent}%` }" /></div>
            </div>
          </div>
        </section>

        <section class="app-panel p-5 sm:p-6 xl:col-span-2">
          <div><h2 class="text-lg font-extrabold">Credential health</h2><p class="mt-1 text-sm text-muted">RFID card lifecycle at a glance</p></div>
          <div class="mt-6 divide-y divide-[var(--border-light)]">
            <div class="flex items-center justify-between py-4"><span class="text-sm font-semibold">Cards issued</span><span class="font-display text-2xl font-extrabold">{{ overview.rfid_issued }}</span></div>
            <div class="flex items-center justify-between py-4"><span class="text-sm font-semibold">Cards active</span><span class="font-display text-2xl font-extrabold text-emerald-700">{{ overview.rfid_active }}</span></div>
            <div class="flex items-center justify-between py-4"><span class="text-sm font-semibold">Revoked or replaced</span><span class="font-display text-2xl font-extrabold text-red-700">{{ overview.rfid_revoked }}</span></div>
          </div>
          <button class="mt-4 flex items-center gap-2 text-sm font-bold text-navy hover:text-primary-hover" @click="router.push('/rfid')">Manage RFID cards <ArrowRight :size="16" /></button>
        </section>
      </div>
    </template>
  </section>
</template>
