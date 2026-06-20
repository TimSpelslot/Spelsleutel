import { api } from './api'
import type { Result, User } from '@/types'

type RawUser = User & { _id?: string }

function normalise(raw: RawUser): User {
  return {
    id: raw.id ?? (raw._id as string),
    uid: raw.uid,
    email: raw.email,
    name: raw.name,
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl ?? null,
    role: raw.role,
    isWorldbuilder: raw.isWorldbuilder,
    worldbuilderRequestPending: raw.worldbuilderRequestPending,
    dndbeyondCharacterId: raw.dndbeyondCharacterId ?? null,
    notifySignup: raw.notifySignup,
    notifyAssignment: raw.notifyAssignment,
    notifyMarketplace: raw.notifyMarketplace,
    notifySession: raw.notifySession,
  }
}

export const authService = {
  async sync(): Promise<Result<User>> {
    const result = await api.post<RawUser>('/api/auth/sync', {})
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async requestWorldbuilder(): Promise<Result<User>> {
    const result = await api.post<RawUser>('/api/auth/me/request-worldbuilder', {})
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async updateProfile(displayName: string): Promise<Result<User>> {
    const result = await api.patch<RawUser>('/api/auth/me', { displayName })
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async updatePreferences(prefs: Partial<Pick<User, 'notifySignup' | 'notifyAssignment' | 'notifyMarketplace' | 'notifySession'>>): Promise<Result<User>> {
    const result = await api.patch<RawUser>('/api/auth/me/preferences', prefs)
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },
}
