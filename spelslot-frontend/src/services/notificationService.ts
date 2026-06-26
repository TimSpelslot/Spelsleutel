import { api } from './api'
import type { Result } from '@/types'

export interface AppNotification {
  _id: string
  userId: string
  type: 'signup' | 'assignment' | 'marketplace' | 'session' | 'system'
  title: string
  message: string
  read: boolean
  href?: string
  createdAt: string
  updatedAt: string
}

export interface NotificationPreferences {
  notifySignup: boolean
  notifyAssignment: boolean
  notifyMarketplace: boolean
  notifySession: boolean
}

export const notificationService = {
  async list(): Promise<Result<AppNotification[]>> {
    const result = await api.get<{ notifications: AppNotification[] }>('/api/notifications')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.notifications }
  },

  async markRead(id: string): Promise<Result<AppNotification>> {
    const result = await api.patch<{ notification: AppNotification }>(
      `/api/notifications/${id}/read`,
      {},
    )
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.notification }
  },

  async markAllRead(): Promise<Result<void>> {
    const result = await api.patch<{ success: boolean }>('/api/notifications/read-all', {})
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async remove(id: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>(`/api/notifications/${id}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<Result<void>> {
    const result = await api.patch<unknown>('/api/auth/me/preferences', prefs)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async registerFcmToken(token: string): Promise<Result<void>> {
    const result = await api.post<{ success: boolean }>('/api/notifications/fcm-token', { token })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async unregisterFcmToken(token: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>('/api/notifications/fcm-token', { token })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },
}
