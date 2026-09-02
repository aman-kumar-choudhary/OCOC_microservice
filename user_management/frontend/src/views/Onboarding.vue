<script setup lang="ts">
import { ref } from 'vue'
import userService from '@/services/userService'
import rfidService from '@/services/rfidService'
import { UserPlus, CreditCard, CheckCircle, Loader2 } from 'lucide-vue-next'

const step = ref<1 | 2 | 3>(1)
const persona = ref('student')
const isLoading = ref(false)
const error = ref('')
const successMsg = ref('')

// Form state
const userForm = ref({
  email: '',
  phone: '',
  password: 'Welcome@123!', // Default temporary password
  profile: {
    full_name: '',
    roll_number: '',
    employee_id: '',
    gov_id_type: '',
    gov_id_number: '',
    visit_purpose: ''
  }
})

// RFID state
const rfidUid = ref('')
const isScanning = ref(false)
const createdUserId = ref('')

async function handleCreateUser() {
  error.value = ''
  isLoading.value = true
  try {
    const payload = {
      user: {
        email: userForm.value.email,
        phone: userForm.value.phone,
        password: userForm.value.password,
        profile: { ...userForm.value.profile }
      }
    }
    const result = await userService.onboard(persona.value, payload)
    createdUserId.value = result.user.id
    step.value = 2 // Move to RFID enrollment
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to create user'
  } finally {
    isLoading.value = false
  }
}

async function scanRFID() {
  error.value = ''
  isScanning.value = true
  try {
    const result = await rfidService.scan()
    rfidUid.value = result.uid
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'RFID Scan Failed'
  } finally {
    isScanning.value = false
  }
}

async function handleEnrollRFID() {
  if (!rfidUid.value) return
  error.value = ''
  isLoading.value = true
  try {
    await userService.enrollRFID(createdUserId.value, rfidUid.value)
    await userService.issueCard(createdUserId.value)
    step.value = 3 // Success
    successMsg.value = `User successfully onboarded with RFID Card ${rfidUid.value}`
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to enroll RFID'
  } finally {
    isLoading.value = false
  }
}

function resetForm() {
  step.value = 1
  rfidUid.value = ''
  error.value = ''
  userForm.value = {
    email: '', phone: '', password: 'Welcome@123!',
    profile: { full_name: '', roll_number: '', employee_id: '', gov_id_type: '', gov_id_number: '', visit_purpose: '' }
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-8">
      <h1 class="text-2xl font-bold">Onboarding</h1>
      <p class="text-muted text-sm">Unified workflow for creating users and issuing RFID cards.</p>
    </div>

    <!-- Progress Steps -->
    <div class="flex items-center justify-between mb-8 relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-0.5 before:bg-[var(--border-light)] before:-z-10 z-0">
      <div :class="['flex flex-col items-center gap-2 bg-[var(--bg-main)] px-4', step >= 1 ? 'text-primary' : 'text-muted']">
        <div :class="['w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm', step >= 1 ? 'bg-primary text-navy' : 'bg-[var(--border-light)] text-[var(--text-main)]']">1</div>
        <span class="text-sm font-medium">User Details</span>
      </div>
      <div :class="['flex flex-col items-center gap-2 bg-[var(--bg-main)] px-4', step >= 2 ? 'text-primary' : 'text-muted']">
        <div :class="['w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm', step >= 2 ? 'bg-primary text-navy' : 'bg-[var(--border-light)] text-[var(--text-main)]']">2</div>
        <span class="text-sm font-medium">RFID Enrollment</span>
      </div>
      <div :class="['flex flex-col items-center gap-2 bg-[var(--bg-main)] px-4', step >= 3 ? 'text-primary' : 'text-muted']">
        <div :class="['w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm', step >= 3 ? 'bg-[var(--status-active)] text-white' : 'bg-[var(--border-light)] text-[var(--text-main)]']">3</div>
        <span class="text-sm font-medium">Complete</span>
      </div>
    </div>

    <div v-if="error" class="mb-6 p-4 rounded-lg bg-[var(--status-error-bg)] text-[var(--status-error)] flex items-center gap-2 border border-red-200">
      {{ error }}
    </div>

    <!-- Step 1: User Form -->
    <div v-if="step === 1" class="glass-panel p-6 sm:p-8 animate-fade-in">
      <div class="flex flex-wrap gap-4 mb-8 pb-6 border-b border-[var(--border-light)]">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" v-model="persona" value="student" class="text-primary" />
          <span class="font-medium">Student</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" v-model="persona" value="faculty" class="text-primary" />
          <span class="font-medium">Faculty</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" v-model="persona" value="worker" class="text-primary" />
          <span class="font-medium">Worker</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" v-model="persona" value="visitor" class="text-primary" />
          <span class="font-medium">Visitor</span>
        </label>
      </div>

      <form @submit.prevent="handleCreateUser">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <!-- Common Fields -->
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input v-model="userForm.profile.full_name" type="text" required class="form-input" placeholder="John Doe" />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address *</label>
            <input v-model="userForm.email" type="email" required class="form-input" placeholder="john@example.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input v-model="userForm.phone" type="tel" class="form-input" placeholder="+1234567890" />
          </div>

          <!-- Persona specific fields -->
          <div v-if="persona === 'student'" class="form-group">
            <label class="form-label">Roll Number *</label>
            <input v-model="userForm.profile.roll_number" type="text" required class="form-input" placeholder="CS24001" />
          </div>
          <div v-if="persona === 'faculty' || persona === 'worker'" class="form-group">
            <label class="form-label">Employee ID</label>
            <input v-model="userForm.profile.employee_id" type="text" class="form-input" placeholder="EMP123" />
          </div>
          <template v-if="persona === 'visitor'">
            <div class="form-group">
              <label class="form-label">Gov ID Type *</label>
              <select v-model="userForm.profile.gov_id_type" required class="form-input form-select">
                <option value="">Select type...</option>
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="driving_license">Driving License</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Gov ID Number *</label>
              <input v-model="userForm.profile.gov_id_number" type="text" required class="form-input" placeholder="XYZ123456" />
            </div>
            <div class="form-group md:col-span-2">
              <label class="form-label">Visit Purpose *</label>
              <input v-model="userForm.profile.visit_purpose" type="text" required class="form-input" placeholder="Meeting with IT Dept" />
            </div>
          </template>
        </div>

        <div class="mt-8 flex justify-end">
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="flex items-center gap-2"><Loader2 class="animate-spin" :size="18" /> Processing...</span>
            <span v-else class="flex items-center gap-2">Continue to RFID <UserPlus :size="18" /></span>
          </button>
        </div>
      </form>
    </div>

    <!-- Step 2: RFID Enrollment -->
    <div v-else-if="step === 2" class="glass-panel p-6 sm:p-12 animate-fade-in text-center">
      <div class="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
        <CreditCard :size="32" />
        <span v-if="isScanning" class="absolute inset-0 rounded-full border-4 border-blue-400 border-t-transparent animate-spin"></span>
      </div>
      
      <h2 class="text-2xl font-bold mb-2">Scan RFID Card</h2>
      <p class="text-muted mb-8 max-w-md mx-auto">Please place the new RFID card on the reader to associate it with the newly created user.</p>
      
      <div class="max-w-xs mx-auto mb-8 relative">
        <input 
          v-model="rfidUid" 
          type="text" 
          readonly 
          class="form-input text-center font-mono text-lg tracking-widest bg-gray-50 dark:bg-gray-800" 
          placeholder="WAITING FOR SCAN..."
        />
      </div>

      <div class="flex justify-center gap-4">
        <button @click="scanRFID" class="btn btn-outline" :disabled="isScanning || isLoading">
          <span v-if="isScanning">Scanning...</span>
          <span v-else>Trigger Scanner</span>
        </button>
        
        <button @click="handleEnrollRFID" class="btn btn-primary" :disabled="!rfidUid || isLoading">
          <span v-if="isLoading"><Loader2 class="animate-spin" :size="18" /></span>
          <span v-else>Issue Card</span>
        </button>
      </div>
    </div>

    <!-- Step 3: Success -->
    <div v-else class="glass-panel p-12 animate-fade-in text-center">
      <div class="w-24 h-24 bg-[var(--status-active-bg)] text-[var(--status-active)] rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle :size="48" />
      </div>
      <h2 class="text-3xl font-bold mb-4 text-[var(--status-active)]">Onboarding Complete</h2>
      <p class="text-lg text-muted mb-8">{{ successMsg }}</p>
      <button @click="resetForm" class="btn btn-primary">Start New Onboarding</button>
    </div>

  </div>
</template>
