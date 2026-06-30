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
    worldBuilderName: raw.worldBuilderName ?? null,
    dndBeyondName: raw.dndBeyondName ?? null,
    dndBeyondCampaign: raw.dndBeyondCampaign ?? null,
    avatarUrl: raw.avatarUrl ?? null,
    role: raw.role,
    isStoryDm: raw.isStoryDm,
    isWorldbuilder: raw.isWorldbuilder,
    worldbuilderRequestPending: raw.worldbuilderRequestPending,
    dndbeyondCharacterId: raw.dndbeyondCharacterId ?? null,
    karma: raw.karma ?? 1000,
    notifySignup: raw.notifySignup,
    notifyAssignment: raw.notifyAssignment,
    notifyMarketplace: raw.notifyMarketplace,
    notifySession: raw.notifySession,
    notifyCreateAdventureReminder: raw.notifyCreateAdventureReminder ?? false,
  }
}

export const authService = {
  async sync(): Promise<Result<User>> {
    const result = await api.post<RawUser>('/api/auth/sync', {})
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async requestWorldbuilder(reason?: string): Promise<Result<User>> {
    const result = await api.post<RawUser>('/api/auth/me/request-worldbuilder', { reason })
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async updateProfile(data: Partial<Pick<User, 'displayName' | 'worldBuilderName' | 'dndBeyondName'>>): Promise<Result<User>> {
    const result = await api.patch<RawUser>('/api/auth/me', data)
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async switchRole(role: 'ADMIN' | 'PLAYER'): Promise<Result<User>> {
    const result = await api.patch<RawUser>('/api/auth/me/role', { role })
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async switchFlags(flags: Partial<Pick<User, 'isStoryDm' | 'isWorldbuilder'>>): Promise<Result<User>> {
    const result = await api.patch<RawUser>('/api/auth/me/flags', flags)
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },

  async updatePreferences(
    prefs: Partial<
      Pick<User, 'notifySignup' | 'notifyAssignment' | 'notifyMarketplace' | 'notifySession' | 'notifyCreateAdventureReminder'>
    >,
  ): Promise<Result<User>> {
    const result = await api.patch<RawUser>('/api/auth/me/preferences', prefs)
    if (result.type === 'error') return result
    return { type: 'ok', data: normalise(result.data) }
  },
}
