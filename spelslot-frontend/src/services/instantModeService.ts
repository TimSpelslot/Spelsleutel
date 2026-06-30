import { api } from './api'
import type { Result } from '@/types'

export interface InstantModeRange {
  id: string
  label: string | null
  startDate: string | null
  endDate: string | null
  isRecurring: boolean
  recurrenceWeekday: number | null  // 0=Mon … 6=Sun
  recurrenceWeekOfMonth: number | null  // 1–5
}

export const instantModeService = {
  async list(): Promise<Result<InstantModeRange[]>> {
    const result = await api.get<{ ranges: InstantModeRange[] }>('/api/instant-mode')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.ranges }
  },

  async check(date?: string): Promise<Result<boolean>> {
    const url = date ? `/api/instant-mode/check?date=${encodeURIComponent(date)}` : '/api/instant-mode/check'
    const result = await api.get<{ isActive: boolean }>(url)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.isActive }
  },

  async create(data: {
    label?: string | null
    startDate?: string | null
    endDate?: string | null
    isRecurring?: boolean
    recurrenceWeekday?: number | null
    recurrenceWeekOfMonth?: number | null
  }): Promise<Result<InstantModeRange>> {
    const result = await api.post<{ range: InstantModeRange }>('/api/instant-mode', data)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.range }
  },

  async remove(id: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>(`/api/instant-mode/${id}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },
}
