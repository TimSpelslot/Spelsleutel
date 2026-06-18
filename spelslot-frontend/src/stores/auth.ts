import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { firebaseAuth } from '@/firebase'
import { authService } from '@/services/authService'
import type { Result, User, UserRole } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const firebaseUser = ref<FirebaseUser | null>(null)
  const loading = ref(false)

  function init(): Promise<void> {
    return new Promise((resolve) => {
      let initialised = false
      onAuthStateChanged(firebaseAuth, async (fbUser) => {
        firebaseUser.value = fbUser
        loading.value = true

        if (fbUser) {
          const result = await authService.sync()
          user.value = result.type === 'ok' ? result.data : null
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
      // Sync immediately so user is available before navigation
      const result = await authService.sync()
      if (result.type === 'ok') user.value = result.data
      return { type: 'ok', data: undefined }
    } catch {
      return { type: 'error', message: 'Sign in with Google failed. Please try again.' }
    }
  }

  async function logout() {
    await signOut(firebaseAuth)
    user.value = null
    firebaseUser.value = null
  }

  function hasPermission(role: UserRole | UserRole[]): boolean {
    if (!user.value) return false
    const roles = Array.isArray(role) ? role : [role]
    return roles.includes(user.value.role)
  }

  return { user, firebaseUser, loading, init, loginWithGoogle, logout, hasPermission }
})
