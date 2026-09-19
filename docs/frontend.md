# Frontend Application (Vue 3 + TypeScript)

## Overview

The Frontend is a Vue 3 + TypeScript single-page application that provides the user interface for the OCOC platform. It communicates with the User Management Backend and Freco Face Recognition Service.

**Location**: `user_management/frontend/`

**Entry Point**: `src/main.ts`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue 3 Frontend                            │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │ Pinia      │  │ Vue Router │  │ Axios HTTP Client  │   │
│  │ Auth Store │  │ Guards     │  │ + Interceptors     │   │
│  └────────────┘  └────────────┘  └────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Views                                               │   │
│  │ ├─ Login / ForgotPassword                           │   │
│  │ ├─ Dashboard (analytics, stats)                     │   │
│  │ ├─ Users (CRUD, import/export)                      │   │
│  │ ├─ Onboarding (user creation workflow)              │   │
│  │ ├─ RFID (card management)                           │   │
│  │ ├─ FaceRecognition (single/mass camera)             │   │
│  │ ├─ FaceAuthLog (authentication history)             │   │
│  │ ├─ Audit (audit trail viewer)                       │   │
│  │ └─ Analytics (charts)                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

1. User submits credentials → `POST /api/v1/auth/login`
2. Store `access_token` + `refresh_token` in localStorage
3. Decode JWT to extract roles from `realm_access.roles`
4. Axios interceptor attaches Bearer token to all requests
5. On 401 → attempt token refresh → retry original request
6. On refresh failure → redirect to login

---

## Router Configuration

### Routes

| Path | View | Permission | Layout |
|------|------|------------|--------|
| `/` | Redirect to Dashboard | - | - |
| `/login` | Login | Public | AuthLayout |
| `/forgot-password` | ForgotPassword | Public | AuthLayout |
| `/dashboard` | Dashboard | Auth | DashboardLayout |
| `/users` | Users | user:read | DashboardLayout |
| `/onboarding` | Onboarding | user:create | DashboardLayout |
| `/rfid` | RFID | rfid:read | DashboardLayout |
| `/audit` | Audit | audit:read | DashboardLayout |
| `/analytics` | Analytics | Auth | DashboardLayout |
| `/face-recognition` | FaceRecognition | Auth | DashboardLayout |
| `/face-auth-log` | FaceAuthLog | Auth | DashboardLayout |

### Navigation Guards

```typescript
router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  // Redirect to login if not authenticated
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ name: 'Login' })
  }

---

## State Management (Pinia)

### Auth Store

```typescript
interface KeycloakClaims {
  sub: string
  email: string
  preferred_username: string
  realm_access: {
    roles: string[]
  }
}

// State
const token = ref<string | null>(localStorage.getItem('access_token'))
const user = ref<KeycloakClaims | null>(null)

// Getters
const isAuthenticated = computed(() => !!token.value)
const roles = computed(() => user.value?.realm_access?.roles || [])
const hasRole = (role: string) => roles.value.includes(role)

// Actions
async function login(credentials) { /* ... */ }
async function logout() { /* ... */ }
```

---

## Service Layer

| Service | Purpose |
|---------|---------|
| `api.ts` | Axios instance with auth interceptor |
| `frecoService.ts` | Face recognition API calls |
| `userService.ts` | User CRUD operations |
| `rfidService.ts` | RFID card operations |
| `registrationService.ts` | User registration |
| `dashboardService.ts` | Dashboard analytics |
| `miscService.ts` | Miscellaneous endpoints |

### API Client Configuration

```typescript
const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor - handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Refresh token and retry
    }
    return Promise.reject(error)
  }
)
```

### Freco Service

```typescript
const FRECO_BASE = import.meta.env.VITE_FRECO_URL || 'http://localhost:8000'

export async function recognizeFace(image: File): Promise<RecognitionResult> {
  const form = new FormData()
  form.append('image', image)
  const { data } = await freco.post<RecognitionResult>('/api/v1/recognize', form)
  return data
}

export async function registerPerson(opts: {
  externalId: string
  name: string
  personType: string
  images: File[]
  poses: string[]
}): Promise<PersonRegisterResult> { /* ... */ }
```

---

## Face Recognition UI

### Single Face Mode

- Camera with oval guide
- Auto-capture when face detected
- Calls `POST /api/v1/recognize`
- Displays: name, role, similarity %

### Multi-Face Mode

- Wide camera view
- Samples frames every 1.5 seconds
- Calls `POST /api/v1/recognize/mass`
- Displays results for each detected face

### Face Authentication Logging

```typescript
function logRecognition(result: RecognitionResult, authType: 'single' | 'mass') {
  const livenessFailed = result.message === 'Liveness check failed'
  return api.post('/face-auth/log', {
    person_external_id: result.userId || '',
    person_name: result.name || '',
    result: result.recognized ? 'success' : livenessFailed ? 'liveness_failed' : 'unknown',
    similarity_score: result.similarity,
    liveness_score: (result as any).liveness_score,
    reason: result.message || '',
    auth_type: authType,
  }).catch(() => undefined)
}
```

---

## Vite Configuration

```typescript
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
```

---

## Environment Variables

Create `.env` file in `frontend/`:

```
VITE_FRECO_URL=http://localhost:8000
```

---

## Running the Frontend

```bash
cd user_management/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```
frontend/
├── src/
│   ├── assets/          # Static assets
│   ├── components/      # Reusable components
│   │   ├── FaceOvalCamera.vue
│   │   ├── FaceWideCamera.vue
│   │   ├── AssignRFIDModal.vue
│   │   ├── EditUserModal.vue
│   │   └── ...
│   ├── composables/     # Vue composables
│   │   └── useLiveFaceInference.ts
│   ├── layouts/         # Layout components
│   │   ├── AuthLayout.vue
│   │   └── DashboardLayout.vue
│   ├── router/          # Vue Router configuration
│   │   └── index.ts
│   ├── services/        # API service layer
│   │   ├── api.ts
│   │   ├── frecoService.ts
│   │   ├── userService.ts
│   │   └── ...
│   ├── stores/          # Pinia stores
│   │   └── auth.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   ├── views/           # Page components
│   │   ├── Login.vue
│   │   ├── Dashboard.vue
│   │   ├── Users.vue
│   │   ├── FaceRecognition.vue
│   │   └── ...
│   ├── App.vue          # Root component
│   └── main.ts          # Entry point
├── public/              # Static public assets
├── index.html           # HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```


  // Redirect to dashboard if already authenticated
  if (to.meta.public && auth.isAuthenticated) {
    return next({ name: 'Dashboard' })
  }

  // Check permission (simplified - SUPER_ADMIN bypasses)
  if (to.meta.permission && !auth.hasRole(to.meta.permission) && !auth.hasRole('SUPER_ADMIN')) {
    // Could redirect to dashboard or show unauthorized
  }

  next()
})
```
