import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, requiresGuest: true },
    },
    {
      // All authenticated routes share the app shell layout
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'codex',
          name: 'codex',
          component: () => import('@/views/CodexView.vue'),
        },
        {
          path: 'codex/new',
          name: 'codex-new',
          component: () => import('@/views/CodexNewEntry.vue'),
        },
        {
          path: 'codex/:slug',
          name: 'codex-entry',
          component: () => import('@/views/CodexEntryView.vue'),
        },
        {
          path: 'sessions',
          name: 'sessions',
          component: () => import('@/views/AdventureBoardView.vue'),
        },
        {
          path: 'session',
          name: 'session',
          component: () => import('@/views/SessionView.vue'),
        },
        {
          path: 'session/dm',
          name: 'session-dm',
          component: () => import('@/views/SessionDmView.vue'),
          meta: { requiresDM: true },
        },
        {
          path: 'session/player',
          name: 'session-player',
          component: () => import('@/views/SessionPlayerView.vue'),
        },
        {
          path: 'marketplace',
          name: 'marketplace',
          component: () => import('@/views/MarketplaceView.vue'),
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/views/NotificationsView.vue'),
        },
        {
          path: 'admin',
          name: 'admin',
          component: () => import('@/views/AdminView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // Check the full matched chain so nested children inherit requiresAuth from layout
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)

  if (requiresAuth && !auth.user) {
    return { name: 'login' }
  }

  if (to.meta.requiresGuest && auth.user) {
    return { name: 'dashboard' }
  }

  if (to.meta.requiresDM && !auth.hasPermission(['DM', 'ADMIN'])) {
    return { name: 'dashboard' }
  }

  if (to.meta.requiresAdmin && !auth.hasPermission('ADMIN')) {
    return { name: 'dashboard' }
  }
})

export default router
