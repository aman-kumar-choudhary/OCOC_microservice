<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDark, useToggle } from '@vueuse/core'
import { 
  LayoutDashboard, Users, UserPlus, CreditCard, 
  ShieldCheck, Activity, LogOut, Sun, Moon, Menu, X 
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const isDark = useDark({ selector: 'html', attribute: 'data-theme', valueDark: 'dark', valueLight: 'light' })
const toggleDark = useToggle(isDark)

const isMobileMenuOpen = ref(false)

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Directory', path: '/users', icon: Users, permission: 'user:read' },
  { name: 'Onboarding', path: '/onboarding', icon: UserPlus, permission: 'user:create' },
  { name: 'RFID Cards', path: '/rfid', icon: CreditCard, permission: 'rfid:read' },
  { name: 'Audit Log', path: '/audit', icon: Activity, permission: 'audit:read' }
]

const filteredNavItems = navItems.filter(item => {
  if (!item.permission) return true
  return authStore.hasRole('SUPER_ADMIN') || authStore.hasRole(item.permission) || true // relaxed for demo
})

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="dashboard-layout flex h-screen overflow-hidden bg-[var(--bg-main)]">
    
    <!-- Sidebar -->
    <aside :class="['sidebar glass-panel flex-col transition-all', isMobileMenuOpen ? 'translate-x-0 absolute z-50 h-full w-64' : '-translate-x-full absolute h-full w-64 md:relative md:translate-x-0']">
      <div class="p-6 flex items-center justify-between border-b" style="border-color: var(--border-light)">
        <div class="flex items-center gap-2">
          <ShieldCheck class="text-primary" :size="28" />
          <h2 class="font-bold text-xl m-0 tracking-tight">OCOC</h2>
        </div>
        <button class="md:hidden text-muted" @click="isMobileMenuOpen = false">
          <X :size="24" />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        <router-link 
          v-for="item in filteredNavItems" 
          :key="item.path" 
          :to="item.path"
          class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          active-class="nav-item-active"
          @click="isMobileMenuOpen = false"
        >
          <component :is="item.icon" :size="18" />
          {{ item.name }}
        </router-link>
      </nav>

      <div class="p-4 border-t" style="border-color: var(--border-light)">
        <div class="mb-4 px-2 text-xs font-medium text-muted truncate">
          {{ authStore.email }}
        </div>
        <button @click="handleLogout" class="w-full btn btn-outline flex items-center justify-center gap-2 border-none hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error)] transition-colors">
          <LogOut :size="16" />
          Logout
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col h-screen overflow-hidden relative">
      <!-- Top Header -->
      <header class="glass-header h-16 flex items-center justify-between px-4 lg:px-8">
        <div class="flex items-center gap-4">
          <button class="md:hidden text-muted" @click="isMobileMenuOpen = true">
            <Menu :size="24" />
          </button>
          <h2 class="font-semibold text-lg hidden sm:block">{{ $route.name }}</h2>
        </div>
        
        <div class="flex items-center gap-4">
          <button @click="toggleDark()" class="text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-[rgba(148,163,184,0.1)]">
            <Sun v-if="isDark" :size="20" />
            <Moon v-else :size="20" />
          </button>
          <div class="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            {{ authStore.email.charAt(0).toUpperCase() }}
          </div>
        </div>
      </header>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-4 lg:p-8">
        <div class="container mx-auto max-w-7xl animate-fade-in">
          <slot />
        </div>
      </div>
    </main>

    <!-- Mobile Overlay -->
    <div 
      v-if="isMobileMenuOpen" 
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
      @click="isMobileMenuOpen = false"
    ></div>
  </div>
</template>

<style scoped>
.sidebar {
  border-right: var(--glass-border);
  border-radius: 0;
  box-shadow: var(--shadow-lg);
}

.nav-item {
  color: var(--text-muted);
}
.nav-item:hover {
  background: rgba(148, 163, 184, 0.1);
  color: var(--text-main);
}
.nav-item-active {
  background: rgba(99, 102, 241, 0.1) !important;
  color: var(--color-primary) !important;
  font-weight: 600;
}
.nav-item-active svg {
  stroke-width: 2.5px;
}
</style>
