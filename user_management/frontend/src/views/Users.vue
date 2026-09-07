<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import userService from '@/services/userService'
import type { User } from '@/types'
import { formatDate } from '@/utils/date'
import {
  Search, Download, Upload, Loader2, CreditCard, Camera,
  ChevronLeft, ChevronRight, X, Filter, Edit2,
  ShieldOff, ShieldCheck, UserX, MoreVertical
} from 'lucide-vue-next'
import EditUserModal from '@/components/EditUserModal.vue'
import UserStatusModal from '@/components/UserStatusModal.vue'

const users = ref<User[]>([])
const isLoading = ref(true)
const apiError = ref('')
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const totalPages = ref(1)
const exportLoading = ref(false)
const importLoading = ref(false)
const importMessage = ref('')
const importError = ref('')
const importInput = ref<HTMLInputElement | null>(null)

const dbDepartments = ref<any[]>([])
const dbHostels = ref<any[]>([])

// Static reference data for dropdowns
const courses = [
  'B.Sc. IT', 'BCA', 'M.Sc. Data Science', 'MCA', 'BBA Tourism', 'MBA Tourism',
  'B.A. Mass Comm', 'M.A. Mass Comm', 'B.Sc. Animation', 'M.Sc. Animation',
  'BBA Rural Management', 'MBA Rural Management', 'B.Sc. Environmental Science',
  'M.Sc. Environmental Science', 'B.Ed.', 'M.Ed.', 'B.A. Psychology',
  'M.A. Clinical Psychology', 'B.A. English (Honors)', 'M.A. English',
  'B.A. Sanskrit (Honors)', 'M.A. Sanskrit', 'B.A. Hindi (Honors)',
  'M.A. History and Indian Culture', 'B.A. History (Honors)', 'B.A. Music (Vocal) (Honors)',
  'M.A. Music (Vocal)', 'B.A. Music Instrumental Mridang/Tabla (Honors)',
  'M.A. Music (Tabla, Pakhaawaj)', 'M.A. Hindu Studies', 'M.A. Philosophy',
  'B.Sc. Yogic Science (Honors)', 'M.Sc. Yoga Therapy',
  'M.A. Human Consciousness & Yogic Science', 'M.Sc. Human Consciousness & Yogic Science',
  'P. G. Diploma Human Consciousness, Yoga & Alternative Therapy',
  'Certificate In Yoga And Alternative Therapy'
]
const semesters = ['1', '2', '3', '4', '5', '6', '7', '8']
const schools = computed(() => [...new Set(dbDepartments.value.map((department) => department.school).filter(Boolean))])
const filteredDepartments = computed(() => dbDepartments.value.filter((department) => !filters.value.school || department.school === filters.value.school))

// Modal state
const viewTarget = ref<User | null>(null)
const editTarget = ref<User | null>(null)
const statusTarget = ref<User | null>(null)
const statusAction = ref<'suspend' | 'activate' | 'deactivate'>('suspend')
const showActions = ref<string | null>(null)

const filters = ref({
  search: '',
  user_type: 'student', // Default to student
  status: '',
  school: '',
  department: '',
  course: '',
  semester: '',
  hostel_id: '',
  hostel_status: ''
})

let searchTimeout: ReturnType<typeof setTimeout>
watch(() => filters.value.search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 1; fetchUsers() }, 350)
})

async function fetchUsers() {
  isLoading.value = true
  apiError.value = ''
  try {
    const data = await userService.list({ page: page.value, limit: limit.value, ...filters.value })
    users.value = data.users || []
    total.value = data.total
    totalPages.value = data.total_pages
  } catch (e: any) {
    console.error(e)
    apiError.value = e.response?.data?.error?.message || 'Failed to load users. Please try again.'
  }
  finally { isLoading.value = false }
}

function handleFilterChange() { page.value = 1; fetchUsers() }

function clearFilters() {
  filters.value = { search: '', user_type: 'student', status: '', school: '', department: '', course: '', semester: '', hostel_id: '', hostel_status: '' }
  page.value = 1; fetchUsers()
}

const hasActiveFilters = () => filters.value.search || filters.value.user_type !== 'student' || filters.value.status || filters.value.school || filters.value.department || filters.value.course || filters.value.semester || filters.value.hostel_id || filters.value.hostel_status

function getStatusClass(status: string) {
  if (status === 'active') return 'badge-active'
  if (status === 'suspended') return 'badge-suspended'
  return 'badge-deactivated'
}

function getRoleColor(type: string) {
  const map: Record<string, string> = {
    student: 'bg-blue-50 text-blue-700 border-blue-200',
    faculty: 'bg-purple-50 text-purple-700 border-purple-200',
    worker: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    visitor: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return map[type] || 'bg-gray-50 text-gray-700 border-gray-200'
}

function getIdentifier(user: User) {
  const p = user.profile
  return p?.roll_number || p?.employee_id || (p as any)?.gov_id_number || '—'
}

function getUserName(user: User) {
  return user.profile?.full_name || 'Unnamed User'
}

function openAction(user: User, action: 'suspend' | 'activate' | 'deactivate') {
  statusTarget.value = user
  statusAction.value = action
  showActions.value = null
}

async function exportToCSV() {
  exportLoading.value = true
  try {
    const data = await userService.list({ page: 1, limit: 10000, ...filters.value })
    const rows = data.users || []
    const headers = ['Name', 'Email', 'Phone', 'Type', 'Identifier', 'Department', 'Status', 'RFID Tag', 'Joined']
    const csvContent = [
      headers.join(','),
      ...rows.map((u) => [
        `"${getUserName(u)}"`, `"${u.email}"`, `"${u.phone || ''}"`, u.user_type,
        `"${getIdentifier(u)}"`, `"${(u.profile as any)?.department || ''}"`,
        u.status, u.active_rfid || '',
        formatDate(u.created_at),
      ].join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ococ-users-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  } catch (e) { console.error(e) }
  finally { exportLoading.value = false }
}

function openImportPicker() {
  importMessage.value = ''
  importError.value = ''
  importInput.value?.click()
}

async function importFromCSV(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importLoading.value = true
  importMessage.value = ''
  importError.value = ''
  try {
    const result = await userService.importCsv(file)
    const created = result?.created_rows ?? 0
    const invalid = result?.invalid_rows ?? 0
    const failed = result?.failed_rows ?? 0
    importMessage.value = `Import complete: ${created} user${created === 1 ? '' : 's'} added${invalid || failed ? `, ${invalid + failed} row${invalid + failed === 1 ? '' : 's'} skipped` : ''}.`
    await fetchUsers()
  } catch (e: any) {
    console.error(e)
    importError.value = e.response?.data?.error?.message || 'Failed to import CSV. Please check the file and try again.'
  } finally {
    importLoading.value = false
    input.value = ''
  }
}

onMounted(async () => {
  fetchUsers()
  try {
    dbDepartments.value = await userService.getDepartments()
    dbHostels.value = await userService.getHostels()
  } catch (e) {
    console.error('Failed to load reference data', e)
  }
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-7">
      <div>
        <h1 class="text-2xl font-bold">User Directory</h1>
        <p class="text-muted text-sm mt-1">
          <span v-if="!isLoading">{{ total.toLocaleString() }} campus identities</span>
          <span v-else>Loading directory…</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <input ref="importInput" type="file" accept=".csv,text/csv" class="hidden" @change="importFromCSV" />
        <button class="btn btn-outline" @click="openImportPicker" :disabled="importLoading" id="import-csv-btn">
          <Loader2 v-if="importLoading" class="animate-spin" :size="16" />
          <Upload v-else :size="16" />
          Import CSV
        </button>
        <button class="btn btn-primary" @click="exportToCSV" :disabled="exportLoading" id="export-csv-btn">
          <Loader2 v-if="exportLoading" class="animate-spin" :size="16" />
          <Download v-else :size="16" />
          Export CSV
        </button>
      </div>
    </div>

    <p v-if="importMessage" class="mb-4 text-sm font-semibold text-emerald-700">{{ importMessage }}</p>
    <p v-if="importError" class="mb-4 text-sm font-semibold text-red-600">{{ importError }}</p>

    <!-- Filters -->
    <div class="glass-panel p-4 sm:p-5 mb-6">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <p class="text-sm font-bold">Find a campus identity</p>
          <p class="text-xs text-muted mt-0.5">Use the filters below to narrow the directory.</p>
        </div>
        <span v-if="hasActiveFilters()" class="hidden sm:inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
          Filters applied
        </span>
      </div>
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1.4fr)_repeat(3,minmax(150px,1fr))]">
        <div class="relative min-w-0 xl:col-span-1">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input v-model="filters.search" type="text" placeholder="Search name, email, roll number…" class="form-input pl-9 pr-8" id="user-search-input" />
          <button v-if="filters.search" @click="filters.search = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-red-500 transition-colors">
            <X :size="15" />
          </button>
        </div>
        <div class="relative min-w-0">
          <Filter :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <select v-model="filters.user_type" @change="handleFilterChange" class="form-input form-select pl-8 text-sm" id="user-type-filter">
            <option value="">All Registration Types</option>
            <option value="student">🎓 Student</option>
            <option value="faculty">👨‍🏫 Faculty</option>
            <option value="worker">🔧 Worker</option>
            <option value="visitor">👤 Visitor</option>
          </select>
        </div>

        <!-- Student specific filters -->
        <template v-if="filters.user_type === 'student'">
          <select v-model="filters.school" @change="filters.department = ''; filters.course = ''; handleFilterChange()" class="form-input form-select text-sm" id="school-filter">
            <option value="">All Schools</option>
            <option v-for="school in schools" :key="school" :value="school">{{ school }}</option>
          </select>
          <select v-model="filters.course" @change="handleFilterChange" class="form-input form-select text-sm">
            <option value="">All Courses</option>
            <option v-for="c in courses" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="filters.semester" @change="handleFilterChange" class="form-input form-select text-sm">
            <option value="">All Semesters</option>
            <option v-for="s in semesters" :key="s" :value="s">Sem {{ s }}</option>
          </select>
          <select v-model="filters.department" @change="handleFilterChange" class="form-input form-select text-sm">
            <option value="">All Departments</option>
            <option v-for="d in filteredDepartments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
          <select v-model="filters.hostel_id" @change="filters.hostel_status = ''; handleFilterChange()" class="form-input form-select text-sm">
            <option value="">All Hostels</option>
            <option v-for="h in dbHostels" :key="h.id" :value="h.id">{{ h.name }}</option>
          </select>
          <select v-model="filters.hostel_status" @change="filters.hostel_id = ''; handleFilterChange()" class="form-input form-select text-sm" id="hostel-status-filter">
            <option value="">All Residence Types</option>
            <option value="resident">Hostel Resident</option>
            <option value="day_scholar">Day Scholar</option>
          </select>
        </template>

        <select v-model="filters.status" @change="handleFilterChange" class="form-input form-select text-sm" id="status-filter">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <button v-if="hasActiveFilters()" @click="clearFilters" class="btn btn-outline text-red-500 border-red-200 hover:bg-red-50 text-sm xl:col-span-1" id="clear-filters-btn">
          <X :size="14" /> Clear filters
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container animate-fade-in relative overflow-x-auto">
      <div v-if="isLoading" class="absolute inset-0 bg-[var(--bg-card)]/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>

      <table class="table min-w-[1080px]">
        <thead>
          <tr>
            <th>User</th>
            <th>Role & ID</th>
            <th v-if="filters.user_type === 'student'">Course & Sem</th>
            <th>Department / School</th>
            <th v-if="filters.user_type === 'student'">Hostel</th>
            <th>Status</th>
            <th class="text-center"><span class="flex items-center justify-center gap-1"><CreditCard :size="13" /> RFID Tag</span></th>
            <th class="text-center"><span class="flex items-center justify-center gap-1"><Camera :size="13" /> Photo</span></th>
            <th>Joined</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="apiError && !isLoading">
            <td colspan="10" class="text-center py-16 text-red-500">
              <div class="flex flex-col items-center gap-3">
                <ShieldOff :size="32" class="opacity-50" />
                <p class="text-sm font-semibold">{{ apiError }}</p>
                <button @click="fetchUsers" class="text-xs font-bold hover:underline">Retry</button>
              </div>
            </td>
          </tr>
          <tr v-else-if="users.length === 0 && !isLoading">
            <td colspan="10" class="text-center py-16 text-muted">
              <div class="flex flex-col items-center gap-3">
                <Search :size="32" class="opacity-30" />
                <p class="text-sm font-semibold">No users match your filters.</p>
                <button @click="clearFilters" class="text-xs text-navy font-bold hover:underline">Clear filters</button>
              </div>
            </td>
          </tr>

          <tr v-for="user in users" :key="user.id" class="group cursor-pointer hover:bg-slate-50 transition-colors" @click="viewTarget = user">
            <!-- User Name (Primary) & Email -->
            <td>
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-navy/8 flex items-center justify-center text-sm font-bold text-navy shrink-0">
                  {{ getUserName(user).charAt(0).toUpperCase() }}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-semibold truncate max-w-[150px] text-[var(--text-main)]">{{ getUserName(user) }}</span>
                  <span class="text-xs text-muted truncate max-w-[150px]">{{ user.email }}</span>
                </div>
              </div>
            </td>

            <!-- Role & Identifier -->
            <td>
              <div class="flex flex-col gap-1 items-start">
                <span :class="['badge border text-[10px] uppercase font-bold tracking-wider', getRoleColor(user.user_type)]">{{ user.user_type }}</span>
                <span class="text-xs font-mono font-medium text-muted" title="Identifier">{{ getIdentifier(user) }}</span>
              </div>
            </td>

            <!-- Course & Sem (Students only) -->
            <td v-if="filters.user_type === 'student'">
              <div class="flex flex-col">
                <span class="text-sm">{{ (user.profile as any)?.course || '—' }}</span>
                <span class="text-xs text-muted" v-if="(user.profile as any)?.semester">Sem {{ (user.profile as any)?.semester }}</span>
              </div>
            </td>

            <!-- Dept / School -->
            <td>
              <span class="text-sm text-muted">{{ (user.profile as any)?.department || (user.profile as any)?.school || '—' }}</span>
            </td>

            <!-- Hostel (Students only) -->
            <td v-if="filters.user_type === 'student'">
               <span v-if="(user.profile as any)?.hostel_flag" class="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                 Hostel
               </span>
               <span v-else class="text-xs text-muted">—</span>
            </td>

            <!-- Status -->
            <td>
              <span :class="['badge', getStatusClass(user.status)]">{{ user.status }}</span>
            </td>

            <!-- RFID Tag -->
            <td class="text-center">
              <span v-if="user.active_rfid" class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 font-mono" :title="user.active_rfid">
                <CreditCard :size="12" /> {{ user.active_rfid.slice(0, 8) }}…
              </span>
              <span v-else class="text-xs text-muted">— None</span>
            </td>

            <!-- Photo -->
            <td class="text-center">
              <span v-if="user.has_face_auth" class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                <Camera :size="12" /> Enrolled
              </span>
              <span v-else class="text-xs text-muted">— None</span>
            </td>

            <!-- Joined -->
            <td class="text-sm text-muted whitespace-nowrap">{{ formatDate(user.created_at) }}</td>

            <!-- Actions -->
            <td class="text-right">
              <div class="relative inline-block">
                <button class="p-1.5 rounded-lg hover:bg-[var(--border-light)] text-muted transition-colors" @click.stop="showActions = showActions === user.id ? null : user.id">
                  <MoreVertical :size="17" />
                </button>
                <div v-if="showActions === user.id" class="absolute right-0 top-9 z-20 min-w-[170px] rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-1 shadow-xl">
                  <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors"
                    @click="editTarget = user; showActions = null">
                    <Edit2 :size="14" /> Edit Profile
                  </button>
                  <template v-if="user.status !== 'active'">
                    <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-emerald-700"
                      @click="openAction(user, 'activate')">
                      <ShieldCheck :size="14" /> Activate
                    </button>
                  </template>
                  <template v-if="user.status === 'active'">
                    <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-amber-700"
                      @click="openAction(user, 'suspend')">
                      <ShieldOff :size="14" /> Suspend
                    </button>
                  </template>
                  <button class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-main)] rounded-lg transition-colors text-red-600"
                    @click="openAction(user, 'deactivate')">
                    <UserX :size="14" /> Deactivate
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="p-4 border-t border-[var(--border-light)] flex justify-between items-center text-sm bg-[var(--bg-card)] rounded-b-2xl">
        <div class="text-muted">
          Showing <span class="font-semibold text-[var(--text-main)]">{{ users.length ? (page - 1) * limit + 1 : 0 }}</span>–<span class="font-semibold text-[var(--text-main)]">{{ Math.min(page * limit, total) }}</span>
          of <span class="font-semibold text-[var(--text-main)]">{{ total.toLocaleString() }}</span>
        </div>
        <div class="flex items-center gap-1">
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-primary hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed" :disabled="page <= 1" @click="page--; fetchUsers()" id="prev-page-btn">
            <ChevronLeft :size="16" />
          </button>
          <button v-for="p in Math.min(totalPages, 7)" :key="p" @click="page = p; fetchUsers()" :class="['h-8 min-w-[2rem] px-2 rounded-lg border text-xs font-bold transition', p === page ? 'bg-navy text-primary border-navy' : 'border-[var(--border-light)] text-muted hover:border-primary hover:text-navy']">{{ p }}</button>
          <span v-if="totalPages > 7" class="text-muted px-1">…</span>
          <button class="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-light)] text-muted transition hover:border-primary hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed" :disabled="page >= totalPages" @click="page++; fetchUsers()" id="next-page-btn">
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Modals & Drawers -->

    <!-- View User Details Drawer -->
    <Teleport to="body">
      <div v-if="viewTarget" class="fixed inset-0 z-50 flex justify-end" @click.self="viewTarget = null">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="viewTarget = null" />
        <div class="relative z-10 w-full max-w-lg h-full bg-[var(--bg-main)] shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 bg-[var(--bg-card)] border-b border-[var(--border-light)] shrink-0 shadow-sm z-10">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-navy/8 flex items-center justify-center text-lg font-bold text-navy shrink-0">
                {{ getUserName(viewTarget).charAt(0).toUpperCase() }}
              </div>
              <div>
                <h2 class="text-lg font-extrabold text-[var(--text-main)] leading-tight">{{ getUserName(viewTarget) }}</h2>
                <div class="flex items-center gap-2 mt-1">
                  <span class="badge border text-[10px] uppercase font-bold tracking-wider" :class="getRoleColor(viewTarget.user_type)">{{ viewTarget.user_type }}</span>
                  <span class="text-xs text-muted">{{ viewTarget.email }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button @click="editTarget = viewTarget; viewTarget = null" class="p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-slate-700" title="Edit User">
                <Edit2 :size="16" />
              </button>
              <button @click="viewTarget = null" class="p-2 rounded-lg hover:bg-slate-100 transition-colors text-muted shrink-0" title="Close">
                <X :size="20" />
              </button>
            </div>
          </div>
          
          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            
            <div class="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
              <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 border-b border-[var(--border-light)] pb-2">Status & Identity</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-muted mb-1 font-semibold">Account Status</p>
                  <span :class="['badge', getStatusClass(viewTarget.status)]">{{ viewTarget.status }}</span>
                </div>
                <div>
                  <p class="text-xs text-muted mb-1 font-semibold">Primary Identifier</p>
                  <p class="text-sm font-mono font-medium">{{ getIdentifier(viewTarget) }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted mb-1 font-semibold">RFID Tag</p>
                  <span v-if="viewTarget.active_rfid" class="text-sm font-mono font-medium text-emerald-700">{{ viewTarget.active_rfid.slice(0, 8) }}…</span>
                  <span v-else class="text-sm text-muted">None</span>
                </div>
                <div>
                  <p class="text-xs text-muted mb-1 font-semibold">Face Enrollment</p>
                  <span v-if="viewTarget.has_face_auth" class="text-sm font-semibold text-blue-700">Enrolled</span>
                  <span v-else class="text-sm text-muted">Not enrolled</span>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-[var(--border-light)] p-5 bg-[var(--bg-card)]">
              <h3 class="text-xs font-extrabold uppercase tracking-widest text-navy mb-4 border-b border-[var(--border-light)] pb-2">Profile Details</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <p class="text-xs text-muted mb-1 font-semibold">Phone Number</p>
                  <p class="text-sm">{{ viewTarget.phone || '—' }}</p>
                </div>
                
                <template v-if="viewTarget.user_type === 'student'">
                  <div class="col-span-2">
                    <p class="text-xs text-muted mb-1 font-semibold">School & Department</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.school || '—' }}</p>
                    <p class="text-sm text-muted mt-0.5">{{ (viewTarget.profile as any)?.department || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted mb-1 font-semibold">Course</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.course || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted mb-1 font-semibold">Semester</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.semester || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-muted mb-1 font-semibold">Guardian Contact</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.guardian_contact || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-muted mb-1 font-semibold">Hostel Resident</p>
                    <p class="text-sm">
                      <span v-if="(viewTarget.profile as any)?.hostel_flag" class="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">Yes (Hostel ID: {{ (viewTarget.profile as any)?.hostel_id }})</span>
                      <span v-else>No (Day Scholar)</span>
                    </p>
                  </div>
                </template>
                <template v-else-if="viewTarget.user_type === 'faculty' || viewTarget.user_type === 'worker'">
                  <div class="col-span-2">
                    <p class="text-xs text-muted mb-1 font-semibold">Designation</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.designation || '—' }}</p>
                  </div>
                  <div class="col-span-2" v-if="viewTarget.user_type === 'faculty'">
                    <p class="text-xs text-muted mb-1 font-semibold">Department</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.department || '—' }}</p>
                  </div>
                </template>
                
                <template v-else-if="viewTarget.user_type === 'visitor'">
                  <div class="col-span-2">
                    <p class="text-xs text-muted mb-1 font-semibold">Visit Purpose</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.visit_purpose || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-muted mb-1 font-semibold">Host Contact</p>
                    <p class="text-sm">{{ (viewTarget.profile as any)?.host_contact || '—' }}</p>
                  </div>
                </template>
                
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </Teleport>

    <EditUserModal v-if="editTarget" :user="editTarget" @close="editTarget = null" @saved="fetchUsers" />
    <UserStatusModal
      v-if="statusTarget"
      :user="statusTarget"
      :action="statusAction"
      @close="statusTarget = null"
      @done="fetchUsers"
    />
  </div>
</template>
