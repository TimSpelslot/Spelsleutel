import { api } from './api'
import type { Result } from '@/types'

export interface AdminUser {
  id: string
  uid: string
  email: string
  name: string
  displayName: string
  avatarUrl: string | null
  role: 'PLAYER' | 'DM' | 'ADMIN'
  isWorldbuilder: boolean
  worldbuilderRequestPending: boolean
  dndbeyondCharacterId: string | null
  createdAt: string
}

export interface AdminUserPatch {
  role?: 'PLAYER' | 'DM' | 'ADMIN'
  isWorldbuilder?: boolean
  worldbuilderRequestPending?: boolean
  dndbeyondCharacterId?: string | null
}

export const adminService = {
  async listUsers(): Promise<Result<AdminUser[]>> {
    const result = await api.get<{ users: AdminUser[] }>('/api/admin/users')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.users }
  },

  async updateUser(id: string, patch: AdminUserPatch): Promise<Result<AdminUser>> {
    const result = await api.patch<{ user: AdminUser }>(`/api/admin/users/${id}`, patch)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.user }
  },
}
