<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import dsvvLogo from '@/assets/Dsvv.png'
import {
  Activity, BarChart3, CreditCard, LayoutDashboard, LogOut, Menu,
  ShieldAlert, UserPlus, Users, X, ScanFace, ChevronDown, Mail,
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const isMobileMenuOpen = ref(false)
const isProfileMenuOpen = ref(false)
const userInitial = computed(() => authStore.email?.charAt(0).toUpperCase() || 'A')
const userRoles = computed(() => authStore.roles.filter((role) => !role.startsWith('default-')).slice(0, 2))

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
  isProfileMenuOpen.value = false
  await authStore.logout()
  router.push('/login')
}

function closeProfileMenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-profile-menu]')) isProfileMenuOpen.value = false
}

onMounted(() => document.addEventListener('click', closeProfileMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeProfileMenu))
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
      <div class="flex h-24 items-center justify-center border-b border-white/10 px-5">
        <router-link to="/dashboard" class="flex items-center justify-center text-white no-underline" aria-label="DSVV dashboard" @click="isMobileMenuOpen = false">
          <img :src="dsvvLogo" alt="Dev Sanskriti Vishwavidyalaya" class="h-[78px] w-[78px] object-contain" />
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
    </aside>

    <main class="min-w-0 flex-1">
      <header class="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-main)]/95 px-4 backdrop-blur lg:px-8">
        <div class="flex items-center gap-3">
          <button class="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] text-navy lg:hidden" aria-label="Open navigation" @click="isMobileMenuOpen = true">
            <Menu :size="21" />
          </button>
          <div>
            <p class="text-[16px] font-extrabold uppercase tracking-[0.18em] text-primary sm:text-xs">OCOC</p>
            <h2 class="font-display text-base font-extrabold text-[var(--text-main)] sm:text-lg">University Identity Platform</h2>
          </div>
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="relative" data-profile-menu>
            <button
              class="flex items-center gap-2 rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] p-1 pr-2 text-navy shadow-sm transition hover:border-primary hover:shadow-md"
              :aria-expanded="isProfileMenuOpen"
              aria-haspopup="menu"
              aria-label="Open account menu"
              @click.stop="isProfileMenuOpen = !isProfileMenuOpen"
            >
              <span class="grid h-9 w-9 place-items-center rounded-full bg-navy text-sm font-bold text-primary">{{ userInitial }}</span>
              <ChevronDown :size="15" class="hidden text-muted sm:block" :class="{ 'rotate-180': isProfileMenuOpen }" />
            </button>

            <div v-if="isProfileMenuOpen" class="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-72 overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-2 text-[var(--text-main)] shadow-[0_18px_48px_rgb(10_35_66/0.18)]" role="menu">
              <div class="rounded-xl bg-navy px-4 py-4 text-white">
                <div class="flex items-center gap-3">
                  <span class="grid h-10 w-10 place-items-center rounded-full bg-primary font-bold text-navy">{{ userInitial }}</span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-bold">{{ authStore.email || 'Administrator' }}</p>
                    <p class="mt-0.5 text-xs text-slate-300">Secure session</p>
                  </div>
                </div>
              </div>
              <div class="px-3 py-3">
                <div class="flex items-center gap-2 text-xs font-semibold text-muted">
                  <Mail :size="14" /> Account information
                </div>
                <p class="mt-2 break-all text-sm font-semibold">{{ authStore.email || 'Administrator' }}</p>
                <div v-if="userRoles.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span v-for="role in userRoles" :key="role" class="rounded-full bg-primary/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7b5600]">{{ role.replaceAll('_', ' ') }}</span>
                </div>
              </div>
              <button class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50" role="menuitem" @click="handleLogout">
                <LogOut :size="16" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>
