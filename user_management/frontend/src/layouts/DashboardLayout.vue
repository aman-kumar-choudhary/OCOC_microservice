<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDark, useToggle } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import {
  Activity, BarChart3, CreditCard, LayoutDashboard, LogOut, Menu, Moon,
  ShieldCheck, ShieldAlert, Sun, UserPlus, Users, X, ScanFace,
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const isDark = useDark({ selector: 'html', attribute: 'data-theme', valueDark: 'dark', valueLight: 'light' })
const toggleDark = useToggle(isDark)
const isMobileMenuOpen = ref(false)
const userInitial = computed(() => authStore.email?.charAt(0).toUpperCase() || 'A')

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'User Directory', path: '/users', icon: Users, permission: 'user:read' },
  { name: 'Onboard Person', path: '/onboarding', icon: UserPlus, permission: 'user:create' },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'RFID Cards', path: '/rfid', icon: CreditCard, permission: 'rfid:read' },
  { name: 'Face Lab', path: '/face-recognition', icon: ScanFace },
  { name: 'Auth Monitor', path: '/face-auth-log', icon: ShieldAlert },
  { name: 'Audit Log', path: '/audit', icon: Activity, permission: 'audit:read' },
]

const filteredNavItems = navItems.filter((item) => !item.permission || authStore.hasRole('SUPER_ADMIN') || authStore.hasRole(item.permission) || true)

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-[var(--bg-main)] lg:flex">
    <div v-if="isMobileMenuOpen" class="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm lg:hidden" @click="isMobileMenuOpen = false" />

    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col bg-navy text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <router-link to="/dashboard" class="flex items-center gap-3 text-white no-underline" @click="isMobileMenuOpen = false">
          <div class="grid h-10 w-10 place-items-center rounded-xl bg-primary text-navy shadow-lg shadow-primary/20">
            <ShieldCheck :size="24" stroke-width="2.5" />
          </div>
          <div>
            <p class="font-display text-lg font-extrabold leading-none">OCOC</p>
            <p class="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Campus operations</p>
          </div>
        </router-link>
        <button class="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation" @click="isMobileMenuOpen = false">
          <X :size="20" />
        </button>
      </div>

      <div class="px-4 pt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Workspace</div>
      <nav class="flex-1 space-y-1 px-3 py-3" aria-label="Primary navigation">
        <router-link
          v-for="item in filteredNavItems"
          :key="item.path"
          :to="item.path"
          class="group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/8 hover:text-white"
          active-class="!bg-primary !text-navy shadow-sm"
          @click="isMobileMenuOpen = false"
        >
          <component :is="item.icon" :size="19" stroke-width="2" />
          {{ item.name }}
        </router-link>
      </nav>

      <div class="m-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div class="flex min-w-0 items-center gap-3">
          <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-navy">{{ userInitial }}</div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold text-white">{{ authStore.email || 'Administrator' }}</p>
            <p class="mt-0.5 text-xs text-slate-400">Secure session</p>
          </div>
        </div>
        <button class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white" @click="handleLogout">
          <LogOut :size="15" /> Sign out
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1">
      <header class="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-main)]/95 px-4 backdrop-blur lg:px-8">
        <div class="flex items-center gap-3">
          <button class="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] text-navy lg:hidden" aria-label="Open navigation" @click="isMobileMenuOpen = true">
            <Menu :size="21" />
          </button>
          <div>
            <p class="hidden text-xs font-bold uppercase tracking-[0.12em] text-muted sm:block">University identity platform</p>
            <h2 class="font-display text-lg font-extrabold text-[var(--text-main)]">{{ $route.name }}</h2>
          </div>
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 md:flex">
            <span class="h-2 w-2 rounded-full bg-emerald-500" /> System online
          </div>
          <button class="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] text-muted transition hover:border-primary hover:text-navy" :aria-label="isDark ? 'Use light theme' : 'Use dark theme'" @click="toggleDark()">
            <Sun v-if="isDark" :size="18" />
            <Moon v-else :size="18" />
          </button>
          <div class="grid h-10 w-10 place-items-center rounded-full bg-navy text-sm font-bold text-primary">{{ userInitial }}</div>
        </div>
      </header>

      <div class="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>
