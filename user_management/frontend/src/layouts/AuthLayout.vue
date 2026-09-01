<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark({ selector: 'html', attribute: 'data-theme', valueDark: 'dark', valueLight: 'light' })
const toggleDark = useToggle(isDark)
</script>

<template>
  <div class="auth-layout flex items-center justify-center min-h-screen relative p-4">
    <!-- Theme Toggle -->
    <button @click="toggleDark()" class="theme-toggle btn btn-outline absolute top-4 right-4 rounded-full p-2">
      <Sun v-if="isDark" :size="20" />
      <Moon v-else :size="20" />
    </button>
    
    <div class="auth-card glass-panel p-6 max-w-md w-full animate-fade-in">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-primary mb-2">OCOC System</h1>
        <p class="text-muted">User Management & Identity</p>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
}
.theme-toggle {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  cursor: pointer;
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}
.theme-toggle:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
}
</style>
