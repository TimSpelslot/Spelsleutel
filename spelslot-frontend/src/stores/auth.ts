import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { firebaseAuth } from '@/firebase'
import { t } from '@/i18n'
import { authService } from '@/services/authService'
import type { Result, User, UserRole } from '@/types'

const DEV_ROLE_KEY = 'spelslot-dev-role'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const firebaseUser = ref<FirebaseUser | null>(null)
  const loading = ref(false)

  // Dev-only: override role for testing different views (persisted across page loads)
  const devRole = ref<UserRole | null>(
    import.meta.env.DEV ? (localStorage.getItem(DEV_ROLE_KEY) as UserRole | null) || null : null,
  )

  // The user seen by permission checks — devRole overrides role but not identity
  const effectiveUser = computed<User | null>(() => {
    if (!user.value) return null
    if (!devRole.value) return user.value
    return {
      ...user.value,
      role: devRole.value,
      // DMs and Admins implicitly have worldbuilder rights
      isWorldbuilder:
        devRole.value === 'DM' || devRole.value === 'ADMIN' ? true : user.value.isWorldbuilder,
    }
  })

  function setDevRole(role: UserRole | null) {
    if (!import.meta.env.DEV) return
    devRole.value = role
    if (role) localStorage.setItem(DEV_ROLE_KEY, role)
    else localStorage.removeItem(DEV_ROLE_KEY)
  }

  function init(): Promise<void> {
    return new Promise((resolve) => {
      let initialised = false
      onAuthStateChanged(firebaseAuth, async (fbUser) => {
        firebaseUser.value = fbUser
        loading.value = true

        if (fbUser) {
          const result = await authService.sync()
          if (result.type === 'ok') user.value = result.data
          // on error keep existing user — backend may be temporarily down
        } else {
          user.value = null
        }

        loading.value = false

        if (!initialised) {
          initialised = true
          resolve()
        }
      })
    })
  }

  async function loginWithGoogle(): Promise<Result<void>> {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(firebaseAuth, provider)
      const result = await authService.sync()
      if (result.type === 'ok') user.value = result.data
      return { type: 'ok', data: undefined }
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      console.error('[auth] loginWithGoogle failed:', code, err)

      const messages: Record<string, string> = {
        'auth/popup-blocked': t('auth.errors.popupBlocked'),
        'auth/popup-closed-by-user': t('auth.errors.popupClosedByUser'),
        'auth/unauthorized-domain': t('auth.errors.unauthorizedDomain'),
        'auth/operation-not-allowed': t('auth.errors.operationNotAllowed'),
        'auth/network-request-failed': t('auth.errors.networkRequestFailed'),
      }

      return {
        type: 'error',
        message: messages[code] ?? t('auth.errors.default', { code: code || 'unknown error' }),
      }
    }
  }

  async function logout() {
    await signOut(firebaseAuth)
    user.value = null
    firebaseUser.value = null
  }

  async function updateProfile(displayName: string): Promise<Result<void>> {
    const result = await authService.updateProfile(displayName)
    if (result.type === 'ok') user.value = result.data
    return result.type === 'ok' ? { type: 'ok', data: undefined } : result
  }

  function hasPermission(role: UserRole | UserRole[]): boolean {
    const u = effectiveUser.value
    if (!u) return false
    const roles = Array.isArray(role) ? role : [role]
    return roles.includes(u.role)
  }

  return {
    user,
    effectiveUser,
    devRole,
    setDevRole,
    firebaseUser,
    loading,
    init,
    loginWithGoogle,
    logout,
    updateProfile,
    hasPermission,
  }
})
