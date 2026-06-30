import { api } from './api'
import type { Result } from '@/types'

export interface Room {
  id: string
  name: string
  isActive: boolean
}

export const roomService = {
  async list(): Promise<Result<Room[]>> {
    const result = await api.get<{ rooms: Room[] }>('/api/rooms')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.rooms }
  },

  async create(name: string): Promise<Result<Room>> {
    const result = await api.post<{ room: Room }>('/api/rooms', { name })
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.room }
  },

  async update(id: string, patch: { name?: string; isActive?: boolean }): Promise<Result<Room>> {
    const result = await api.patch<{ room: Room }>(`/api/rooms/${id}`, patch)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.room }
  },

  async remove(id: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>(`/api/rooms/${id}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },
}
