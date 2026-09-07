<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { 
  User, Mail, Phone, Hash, Building, Briefcase, FileText, UserCheck, 
  MapPin, ArrowRight, Loader2, CheckCircle, Lock, Eye, EyeOff
} from 'lucide-vue-next'

const router = useRouter()

const role = ref('student')
const fullName = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)

// Student specific
const rollNumber = ref('')
const department = ref('')

// Faculty / Worker specific
const employeeId = ref('')

// Visitor specific
const govIdType = ref('Aadhaar')
const govIdNumber = ref('')
const visitPurpose = ref('')
const hostContact = ref('')

const isLoading = ref(false)
const error = ref('')
const success = ref(false)
const formReady = ref(false)

onMounted(() => {
  nextTick(() => { formReady.value = true })
})

const isStudent = computed(() => role.value === 'student')
const isFaculty = computed(() => role.value === 'faculty')
const isWorker = computed(() => role.value === 'worker')
const isVisitor = computed(() => role.value === 'visitor')

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,12}$/

async function handleRegister() {
  error.value = ''
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  
  if (!passwordRegex.test(password.value)) {
    error.value = 'Password must be 8-12 chars, with uppercase, lowercase, number, and special symbol.'
    return
  }

  isLoading.value = true
  
  const payload: any = {
    role: role.value,
    full_name: fullName.value,
    email: email.value,
    phone: phone.value
  }

  if (isStudent.value) {
    payload.roll_number = rollNumber.value
    payload.department = department.value
  } else if (isFaculty.value) {
    payload.employee_id = employeeId.value
    payload.department = department.value
  } else if (isWorker.value) {
    payload.employee_id = employeeId.value
  } else if (isVisitor.value) {
    payload.gov_id_type = govIdType.value
    payload.gov_id_number = govIdNumber.value
    payload.visit_purpose = visitPurpose.value
    payload.host_contact = hostContact.value
  }

  try {
    // Unauthenticated call to register
    await api.post('/register', payload)
    success.value = true
    
    // Automatically redirect to login after a few seconds
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Registration failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-view" :class="{ 'is-ready': formReady }">
    <!-- Success State -->
    <div v-if="success" class="success-state text-center flex flex-col items-center justify-center py-6">
      <div class="success-icon mb-4 text-green-500">
        <CheckCircle :size="64" />
      </div>
      <h2 class="login-title mb-2 text-green-700">Registration Successful</h2>
      <p class="login-subtitle mb-6 text-gray-600">Your details have been submitted for review. You will be redirected to the login page shortly.</p>
      <button @click="router.push('/login')" class="login-btn w-full">
        <span>Go to Login</span>
      </button>
    </div>

    <template v-else>
      <div class="auth-tabs">
        <router-link to="/login" class="auth-tab">Sign In</router-link>
        <router-link to="/register" class="auth-tab active">Sign Up</router-link>
      </div>
      
      <div class="login-welcome">
        <h2 id="login-heading" class="login-title">Create Account</h2>
        <p class="login-subtitle">Register for your OCOC Identity</p>
      </div>

      <!-- Error banner -->
      <Transition name="shake">
        <div v-if="error" id="login-error" class="login-error" role="alert">
          <div class="login-error-bar"></div>
          <span>{{ error }}</span>
        </div>
      </Transition>

      <form id="register-form" @submit.prevent="handleRegister" class="login-form">
        
        <!-- Role Selection -->
        <div class="form-group">
          <label class="form-label">I am a...</label>
          <div class="role-selector">
            <label class="role-option" :class="{'active': role === 'student'}">
              <input type="radio" v-model="role" value="student" class="sr-only" />
              <span>Student</span>
            </label>
            <label class="role-option" :class="{'active': role === 'faculty'}">
              <input type="radio" v-model="role" value="faculty" class="sr-only" />
              <span>Faculty</span>
            </label>
            <label class="role-option" :class="{'active': role === 'worker'}">
              <input type="radio" v-model="role" value="worker" class="sr-only" />
              <span>Worker</span>
            </label>
            <label class="role-option" :class="{'active': role === 'visitor'}">
              <input type="radio" v-model="role" value="visitor" class="sr-only" />
              <span>Visitor</span>
            </label>
          </div>
        </div>

        <div class="scrollable-fields">
          <!-- Full Name -->
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <div class="relative">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><User :size="18" /></div>
              <input v-model="fullName" type="text" required class="form-input pl-9" placeholder="e.g. John Doe" :disabled="isLoading" />
            </div>
          </div>

          <!-- Email -->
          <div class="form-group">
            <label class="form-label">Email</label>
            <div class="relative">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Mail :size="18" /></div>
              <input v-model="email" type="email" required class="form-input pl-9" placeholder="john.doe@example.com" :disabled="isLoading" />
            </div>
          </div>

          <!-- Phone -->
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <div class="relative">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Phone :size="18" /></div>
              <input v-model="phone" type="tel" required class="form-input pl-9" placeholder="10-digit number" pattern="[0-9]{10,15}" :disabled="isLoading" />
            </div>
          </div>

          <!-- Password -->
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="relative">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Lock :size="18" /></div>
              <input v-model="password" :type="showPassword ? 'text' : 'password'" required class="form-input pl-9" placeholder="8-12 chars, strong" minlength="8" maxlength="12" :disabled="isLoading" />
              <button type="button" class="field-toggle" @click="showPassword = !showPassword" tabindex="-1">
                <EyeOff v-if="showPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <div class="relative">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Lock :size="18" /></div>
              <input v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" required class="form-input pl-9" placeholder="Re-enter password" minlength="8" maxlength="12" :disabled="isLoading" />
            </div>
          </div>

          <!-- Student Fields -->
          <template v-if="isStudent">
            <div class="form-group">
              <label class="form-label">Roll Number</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Hash :size="18" /></div>
                <input v-model="rollNumber" type="text" required class="form-input pl-9" placeholder="e.g. CS2024001" :disabled="isLoading" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Department</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Building :size="18" /></div>
                <input v-model="department" type="text" required class="form-input pl-9" placeholder="e.g. Computer Science" :disabled="isLoading" />
              </div>
            </div>
          </template>

          <!-- Faculty Fields -->
          <template v-if="isFaculty">
            <div class="form-group">
              <label class="form-label">Employee ID</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Briefcase :size="18" /></div>
                <input v-model="employeeId" type="text" required class="form-input pl-9" placeholder="e.g. FAC001" :disabled="isLoading" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Department</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Building :size="18" /></div>
                <input v-model="department" type="text" required class="form-input pl-9" placeholder="e.g. Computer Science" :disabled="isLoading" />
              </div>
            </div>
          </template>

          <!-- Worker Fields -->
          <template v-if="isWorker">
            <div class="form-group">
              <label class="form-label">Employee ID</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Briefcase :size="18" /></div>
                <input v-model="employeeId" type="text" required class="form-input pl-9" placeholder="e.g. WRK001" :disabled="isLoading" />
              </div>
            </div>
          </template>

          <!-- Visitor Fields -->
          <template v-if="isVisitor">
            <div class="form-group">
              <label class="form-label">Gov ID Type</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><FileText :size="18" /></div>
                <select v-model="govIdType" required class="form-input pl-9" :disabled="isLoading">
                  <option value="Aadhaar">Aadhaar</option>
                  <option value="PAN">PAN</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Gov ID Number</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><Hash :size="18" /></div>
                <input v-model="govIdNumber" type="text" required class="form-input pl-9" placeholder="Enter ID number" :disabled="isLoading" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Visit Purpose</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><MapPin :size="18" /></div>
                <input v-model="visitPurpose" type="text" required class="form-input pl-9" placeholder="e.g. Meeting" :disabled="isLoading" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Host Contact (Phone/Email)</label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><UserCheck :size="18" /></div>
                <input v-model="hostContact" type="text" required class="form-input pl-9" placeholder="Who are you visiting?" :disabled="isLoading" />
              </div>
            </div>
          </template>
        </div>

        <button type="submit" class="btn btn-primary w-full mt-4" :disabled="isLoading">
          <template v-if="!isLoading">
            <span>Submit Registration</span>
            <ArrowRight :size="18" class="login-btn-arrow" />
          </template>
          <template v-else>
            <Loader2 class="animate-spin" :size="18" />
            <span>Registering...</span>
          </template>
        </button>

        <div class="login-footer">
          <span class="text-muted">Already have an account?</span>
          <router-link to="/login" class="field-link ml-1">Sign In</router-link>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
/* ─── Login/Register View ─── */
.login-view {
  display: flex;
  flex-direction: column;
  gap: 0;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s ease, transform 0.5s ease;
  max-height: 80vh;
}

.login-view.is-ready {
  opacity: 1;
  transform: translateY(0);
}

.login-welcome {
  margin-bottom: 0.5rem;
}

.login-title {
  font-size: 1.65rem;
  font-weight: 800;
  color: #0c4b0f;
  margin: 0 0 0.35rem;
  align-items: center;
  justify-content: center;
}

.login-subtitle {
  font-size: 1.2rem;
  color: black;
  margin-top: 5px;
  align-items: center;
  justify-content: center;
}

/* Tabs */
.auth-tabs {
  display: flex;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-light);
}

.auth-tab {
  flex: 1;
  text-align: center;
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s ease;
}

.auth-tab:hover {
  color: #b87800;
}

.auth-tab.active {
  color: #d99e00;
  border-bottom-color: #d99e00;
}

/* Form container and scrollable fields for long forms */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.scrollable-fields {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  max-height: 40vh;
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* Custom Scrollbar for fields */
.scrollable-fields::-webkit-scrollbar {
  width: 6px;
}
.scrollable-fields::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
}
.scrollable-fields::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
}

/* Role Selector */
.role-selector {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.role-option {
  flex: 1;
  min-width: 70px;
  text-align: center;
  padding: 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.role-option:hover {
  background: rgba(245, 189, 25, 0.05);
}

.role-option.active {
  background: linear-gradient(135deg, #f5bd19 0%, #d99e00 100%);
  color: #0a2342;
  border-color: #d99e00;
  box-shadow: 0 2px 8px rgba(245, 189, 25, 0.2);
}

/* Error */
.login-error {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.82rem;
  font-weight: 500;
  background: var(--status-error-bg);
  color: var(--status-error);
  margin-bottom: 1.25rem;
  animation: shake 0.4s ease;
}

.login-error-bar {
  width: 3px;
  align-self: stretch;
  border-radius: 3px;
  background: var(--status-error);
  flex-shrink: 0;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-4px); }
}

/* Replaced custom form CSS to use global style.css definitions */

/* Submit button */
.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 3rem;
  margin-top: 0.5rem;
  border: none;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #f5bd19 0%, #d99e00 100%);
  color: #0a2342;
  font-size: 0.95rem;
  font-weight: 800;
  font-family: 'Manrope', sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(245, 189, 25, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(245, 189, 25, 0.38);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.login-btn-arrow {
  transition: transform 0.2s ease;
}

.login-btn:hover:not(:disabled) .login-btn-arrow {
  transform: translateX(4px);
}

.login-footer {
  text-align: center;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.field-link {
  font-weight: 600;
  color: #b87800;
  text-decoration: none;
  transition: color 0.15s ease;
}

.field-link:hover {
  color: #f5bd19;
  text-decoration: underline;
}

/* Transition */
.shake-enter-active {
  animation: shake 0.4s ease;
}

.text-muted {
  color: var(--text-muted);
}
</style>
