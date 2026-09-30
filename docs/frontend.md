# Frontend Application (React + Vite)

## Overview

The Frontend is a React single-page application built with Vite that provides the user interface for the OCOC platform. It communicates with the User Management Backend (Python/FastAPI) and FRECO Face Recognition Service.

**Location**: `user_management/frontend/`

**Entry Point**: `src/main.jsx`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend                              │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐    │
│  │ AuthContext │  │ React      │  │ Axios HTTP Client      │    │
│  │ (Auth +    │  │ Router     │  │ + Interceptors          │    │
│  │  Roles)    │  │ Guards     │  │ (api.js, frecoService)  │    │
│  └────────────┘  └────────────┘  └────────────────────────┘    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Views (17 pages)                                          │  │
│  │ ├─ Login / ForgotPassword / Register (Public)             │  │
│  │ ├─ Dashboard (Super Admin — analytics, KPIs)              │  │
│  │ ├─ PersonalDashboard (Student/Faculty/Worker/Visitor)     │  │
│  │ ├─ AccessManagement (Admin — rules, grants, devices)      │  │
│  │ ├─ HostelDashboard (Warden — students, movement, curfew) │  │
│  │ ├─ GuardDashboard (Guard — camera, 2-SV, gate monitor)   │  │
│  │ ├─ LeaveManagement (Leave application + approvals)        │  │
│  │ ├─ Users (User CRUD, import/export)                       │  │
│  │ ├─ Onboarding (Multi-step user creation wizard)           │  │
│  │ ├─ RFID (Card management)                                 │  │
│  │ ├─ FaceRecognition (Single/mass camera recognition)       │  │
│  │ ├─ FaceAuthLog (Authentication event history)             │  │
│  │ ├─ Analytics (Charts and trends)                          │  │
│  │ ├─ Audit (Audit trail viewer)                             │  │
│  │ └─ DeviceRegistry (Access control devices)                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Role-Based Routing

The application implements strict role-based access control at the router level. Each role is redirected to their authorized dashboard on login.

### Dashboard Routing (`DashboardRouter`)

| Role | Default Dashboard | Component |
|------|------------------|-----------|
| **Super Admin** | `/dashboard` | `Dashboard.jsx` — Campus command centre |
| **Admin** | `/access` | `AccessManagement.jsx` — Access control management |
| **Warden** | `/hostel` | `HostelDashboard.jsx` — Hostel management |
| **Guard / Security Guard / Security Admin** | `/guard` | `GuardDashboard.jsx` — Guard console |
| **Viewer** | `/analytics` | `Analytics.jsx` — Read-only analytics |
| **Student / Faculty / Worker / Visitor** | `/dashboard` | `PersonalDashboard.jsx` — Personal workspace |

### Route Permissions

| Path | Authorized Roles | Component |
|------|-----------------|-----------|
| `/login` | Public | `Login.jsx` |
| `/forgot-password` | Public | `ForgotPassword.jsx` |
| `/register` | Public | `Register.jsx` |
| `/dashboard` | SUPER_ADMIN, STUDENT, FACULTY, WORKER, VISITOR, USER, STAFF | `DashboardRouter` |
| `/users` | SUPER_ADMIN | `Users.jsx` |
| `/onboarding` | SUPER_ADMIN | `Onboarding.jsx` |
| `/analytics` | SUPER_ADMIN, VIEWER | `Analytics.jsx` |
| `/access` | SUPER_ADMIN, ADMIN | `AccessManagement.jsx` |
| `/devices` | SUPER_ADMIN, ADMIN | `DeviceRegistry.jsx` |
| `/guard` | SUPER_ADMIN, GUARD, SECURITY_GUARD, SECURITY_ADMIN | `GuardDashboard.jsx` |
| `/rfid` | SUPER_ADMIN, GUARD, SECURITY_GUARD, SECURITY_ADMIN | `RFID.jsx` |
| `/face-recognition` | SUPER_ADMIN, GUARD, SECURITY_GUARD, SECURITY_ADMIN | `FaceRecognition.jsx` |
| `/face-auth-log` | SUPER_ADMIN, GUARD, SECURITY_GUARD, SECURITY_ADMIN | `FaceAuthLog.jsx` |
| `/hostel` | SUPER_ADMIN, WARDEN | `HostelDashboard.jsx` |
| `/leave` | SUPER_ADMIN, ADMIN, STUDENT, WARDEN, CHANCELLOR, MEDICAL_OFFICER, SECURITY_ADMIN, GUARD, SECURITY_GUARD | `LeaveManagement.jsx` |
| `/audit` | SUPER_ADMIN, SECURITY_ADMIN, VIEWER | `Audit.jsx` |

### Route Protection Components

- **`ProtectedRoute`**: Blocks unauthorized access and redirects to the user's authorized dashboard
- **`PublicRoute`**: Redirects authenticated users away from login/register pages
- **`RootRedirect`**: Sends authenticated users to their role-based dashboard
- **`DashboardRouter`**: Automatically resolves the correct dashboard component based on role

### Authorization Logic

```
Super Admin → Full unrestricted access to every route
Admin → /access, /devices, /leave only
Warden → /hostel, /leave only
Guard → /guard, /rfid, /face-recognition, /face-auth-log, /leave only
Other roles → Standard ROUTE_PERMISSIONS lookup
```

---

## Authentication Flow

1. User submits credentials → `POST /api/v1/auth/login`
2. Store `access_token` + `refresh_token` in sessionStorage
3. Decode JWT to extract roles from `realm_access.roles`
4. Axios interceptor attaches Bearer token to all requests
5. On 401 → attempt token refresh → retry original request
6. On refresh failure → redirect to login

---

## State Management (AuthContext)

```jsx
// Context provides:
const { user, roles, email, isAuthenticated, isInitializing } = useAuth()

// Role checking:
const hasRole = (role) => roles.includes(role.toUpperCase())
```

---

## Service Layer

| Service | File | Purpose |
|---------|------|---------|
| API Client | `api.js` | Axios instance with auth interceptor and token refresh |
| FRECO Service | `frecoService.js` | Face recognition API calls (direct to FRECO, no auth) |
| User Service | `userService.js` | User CRUD operations |
| RFID Service | `rfidService.js` | RFID card operations |
| Registration Service | `registrationService.js` | Public user registration |
| Dashboard Service | `dashboardService.js` | Dashboard analytics and overview |
| Access Service | `accessService.js` | Access control rules, grants, events, guard data |
| Hostel Service | `hostelService.js` | Hostel management operations |
| Misc Service | `miscService.js` | Reference data (departments, roles, hostels) |

### Dual API Client Pattern

```javascript
// User Management API (proxied via Vite, JWT auth)
const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${sessionStorage.getItem('access_token')}`
})

// FRECO API (direct connection, no auth)
const FRECO_BASE = import.meta.env.VITE_FRECO_URL || 'http://localhost:8000'
const freco = axios.create({ baseURL: FRECO_BASE })
```

---

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `FaceOvalCamera` | `FaceOvalCamera.jsx` | Camera with oval guide, pose detection, auto-capture |
| `FaceWideCamera` | `FaceWideCamera.jsx` | Wide-angle camera for mass face detection |
| `UserProfileForm` | `UserProfileForm.jsx` | Dynamic persona form (student/faculty/worker/visitor) |
| `EditUserModal` | `EditUserModal.jsx` | User edit dialog with all profile fields |
| `AssignRFIDModal` | `AssignRFIDModal.jsx` | RFID card assignment modal |
| `UserStatusModal` | `UserStatusModal.jsx` | Suspend/activate/deactivate confirmation |
| `PassportPhotoCapture` | `PassportPhotoCapture.jsx` | Photo capture for user registration |
| `HostelStudentModal` | `HostelStudentModal.jsx` | Hostel student detail modal |
| `UserAccessPanel` | `access/UserAccessPanel.jsx` | Per-user access grant management |
| `LiveStatusTable` | `hostel/LiveStatusTable.jsx` | Real-time hostel student status |
| `HostelStatsCards` | `hostel/HostelStatsCards.jsx` | Hostel overview statistics |
| `PermissionPanel` | `hostel/PermissionPanel.jsx` | Leave and permission management |
| `MovementHistoryTable` | `hostel/MovementHistoryTable.jsx` | Student movement history |
| `EmergencyMode` | `hostel/EmergencyMode.jsx` | Emergency headcount mode |
| `HostelStudentsList` | `hostel/HostelStudentsList.jsx` | Hostel student directory |

---

## Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useLiveFaceInference` | `hooks/useLiveFaceInference.js` | Manages WebSocket connection to FRECO face stream, camera lifecycle, and face detection state |

---

## Vite Configuration

```javascript
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
│   ├── assets/             # Static assets
│   ├── components/         # Reusable components
│   │   ├── FaceOvalCamera.jsx
│   │   ├── FaceWideCamera.jsx
│   │   ├── AssignRFIDModal.jsx
│   │   ├── EditUserModal.jsx
│   │   ├── HostelStudentModal.jsx
│   │   ├── PassportPhotoCapture.jsx
│   │   ├── UserProfileForm.jsx
│   │   ├── UserStatusModal.jsx
│   │   ├── access/         # Access management components
│   │   │   └── UserAccessPanel.jsx
│   │   └── hostel/         # Hostel management components
│   │       ├── LiveStatusTable.jsx
│   │       ├── HostelStatsCards.jsx
│   │       ├── PermissionPanel.jsx
│   │       ├── MovementHistoryTable.jsx
│   │       ├── EmergencyMode.jsx
│   │       └── HostelStudentsList.jsx
│   ├── context/            # React context providers
│   │   └── AuthContext.jsx
│   ├── hooks/              # Custom hooks
│   │   └── useLiveFaceInference.js
│   ├── layouts/            # Layout components
│   │   ├── AuthLayout.jsx
│   │   └── DashboardLayout.jsx
│   ├── services/           # API service layer
│   │   ├── api.js
│   │   ├── frecoService.js
│   │   ├── userService.js
│   │   ├── rfidService.js
│   │   ├── accessService.js
│   │   ├── hostelService.js
│   │   ├── dashboardService.js
│   │   ├── registrationService.js
│   │   └── miscService.js
│   ├── utils/              # Utility functions
│   │   ├── roleDashboard.js
│   │   └── date.js
│   ├── views/              # Page components (17 views)
│   │   ├── Login.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── PersonalDashboard.jsx
│   │   ├── AccessManagement.jsx
│   │   ├── HostelDashboard.jsx
│   │   ├── GuardDashboard.jsx
│   │   ├── LeaveManagement.jsx
│   │   ├── Users.jsx
│   │   ├── Onboarding.jsx
│   │   ├── RFID.jsx
│   │   ├── FaceRecognition.jsx
│   │   ├── FaceAuthLog.jsx
│   │   ├── Analytics.jsx
│   │   ├── Audit.jsx
│   │   └── DeviceRegistry.jsx
│   ├── App.jsx             # Root component with routing
│   ├── main.jsx            # Entry point
│   ├── auth.css            # Authentication page styles
│   └── style.css           # Global application styles
├── public/                 # Static public assets
├── index.html              # HTML template
├── package.json
├── vite.config.js
└── .gitignore
```
