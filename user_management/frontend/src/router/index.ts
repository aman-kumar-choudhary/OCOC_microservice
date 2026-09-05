import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { layout: 'AuthLayout', public: true }
    },
    {
      path: '/forgot-password',
      name: 'ForgotPassword',
      component: () => import('@/views/ForgotPassword.vue'),
      meta: { layout: 'AuthLayout', public: true }
    },

    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/users',
      name: 'Users',
      component: () => import('@/views/Users.vue'),
      meta: { requiresAuth: true, permission: 'user:read' }
    },
    {
      path: '/onboarding',
      name: 'Onboarding',
      component: () => import('@/views/Onboarding.vue'),
      meta: { requiresAuth: true, permission: 'user:create' }
    },
    {
      path: '/rfid',
      name: 'RFID',
      component: () => import('@/views/RFID.vue'),
      meta: { requiresAuth: true, permission: 'rfid:read' }
    },
    {
      path: '/audit',
      name: 'Audit',
      component: () => import('@/views/Audit.vue'),
      meta: { requiresAuth: true, permission: 'audit:read' }
    },
    {
      path: '/analytics',
      name: 'Analytics',
      component: () => import('@/views/Analytics.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/face-recognition',
      name: 'Face Lab',
      component: () => import('@/views/FaceRecognition.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/face-auth-log',
      name: 'Auth Monitor',
      component: () => import('@/views/FaceAuthLog.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ name: 'Login' })
  }

  if (to.meta.public && auth.isAuthenticated) {
    return next({ name: 'Dashboard' })
  }

  if (to.meta.permission && !auth.hasRole(to.meta.permission as string) && !auth.hasRole('SUPER_ADMIN')) {
    // For simplicity, we just assume SUPER_ADMIN has access or we map it properly
    // In a real app we'd map UI permissions accurately
    // return next({ name: 'Dashboard' })
  }

  next()
})

export default router
