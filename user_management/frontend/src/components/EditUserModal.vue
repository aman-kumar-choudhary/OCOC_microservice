<script setup lang="ts">
import { ref, watch } from 'vue'
import userService from '@/services/userService'
import type { User } from '@/types'
import { X, Loader2, Save } from 'lucide-vue-next'
import UserProfileForm from '@/components/UserProfileForm.vue'

const props = defineProps<{ user: User }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const isLoading = ref(false)
const error = ref('')
const success = ref(false)

const form = ref({
  email: props.user.email || '',
  phone: props.user.phone || '',
  profile: {
    ...props.user.profile,
    full_name: props.user.profile?.full_name || '',
    hostel_flag: (props.user.profile as any)?.hostel_flag || false,
    hostel: (props.user.profile as any)?.hostel || false,
  }
})

async function save() {
  error.value = ''
  isLoading.value = true
  try {
    await userService.update(props.user.id, {
      phone: form.value.phone,
      profile: form.value.profile,
    })
    success.value = true
    setTimeout(() => emit('saved'), 800)
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Update failed'
  } finally {
    isLoading.value = false
  }
}

// Close on Escape
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
window.addEventListener('keydown', onKeydown)
watch(() => props.user, () => {}, { onCleanup: () => window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end" @click.self="emit('close')">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />
      <!-- Drawer -->
      <div class="relative z-10 w-full max-w-lg h-full bg-[var(--bg-card)] shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-5 border-b border-[var(--border-light)] shrink-0">
          <div>
            <h2 class="text-lg font-extrabold">Edit Profile</h2>
            <p class="text-sm text-muted">{{ user.profile?.full_name || user.email }}</p>
          </div>
          <button @click="emit('close')" class="p-2 rounded-lg hover:bg-[var(--border-light)] transition-colors text-muted">
            <X :size="20" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <!-- Success flash -->
          <div v-if="success" class="p-3 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-sm flex items-center gap-2 border border-emerald-200">
            ✅ Profile updated successfully!
          </div>
          <!-- Error flash -->
          <div v-if="error" class="p-3 rounded-xl bg-red-50 text-red-700 font-semibold text-sm border border-red-200">
            {{ error }}
          </div>

          <UserProfileForm v-model="form" :persona="user.user_type" :isEdit="true" />
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-[var(--border-light)] flex justify-end gap-3 shrink-0">
          <button @click="emit('close')" class="btn btn-outline">Cancel</button>
          <button @click="save" :disabled="isLoading" class="btn btn-primary" id="save-edit-user-btn">
            <Loader2 v-if="isLoading" class="animate-spin" :size="16" />
            <Save v-else :size="16" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.animate-slide-in-right {
  animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
