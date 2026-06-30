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

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const firebaseUser = ref<FirebaseUser | null>(null)
  const loading = ref(false)

  const effectiveUser = computed<User | null>(() => user.value)

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

  async function updateProfile(data: Parameters<typeof authService.updateProfile>[0]): Promise<Result<void>> {
    const result = await authService.updateProfile(data)
    if (result.type === 'ok') user.value = result.data
    return result.type === 'ok' ? { type: 'ok', data: undefined } : result
  }

  async function switchRole(role: UserRole): Promise<void> {
    const result = await authService.switchRole(role)
    if (result.type === 'ok') user.value = result.data
  }

  async function toggleFlag(flag: 'isStoryDm' | 'isWorldbuilder'): Promise<void> {
    if (!user.value) return
    const result = await authService.switchFlags({ [flag]: !user.value[flag] })
    if (result.type === 'ok') user.value = result.data
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
    firebaseUser,
    loading,
    init,
    loginWithGoogle,
    logout,
    updateProfile,
    switchRole,
    toggleFlag,
    hasPermission,
  }
})
