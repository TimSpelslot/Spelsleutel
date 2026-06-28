import { api } from './api'
import type { Result } from '@/types'

export type SessionStatus = 'draft' | 'open' | 'confirmed' | 'completed' | 'cancelled'
export type SignUpStatus = 'pending' | 'assigned' | 'waitlist' | 'cancelled'

export interface SessionDm {
  id: string
  uid: string
  displayName: string
  avatarUrl: string | null
}

export interface SessionSummary {
  id: string
  title: string
  shortDescription: string
  date: string
  dm: SessionDm | null
  maxPlayers: number
  status: SessionStatus
  tags: string[]
  isStoryAdventure: boolean
  excludeFromKarma: boolean
  rankCombat: number
  rankExploration: number
  rankRoleplaying: number
  releaseAssignments: boolean
  signupCount: number
  assignedCount: number
  mySignUp: { id: string; status: SignUpStatus; appeared: boolean } | null
}

export interface SessionPlayer {
  signUpId: string
  userId: string
  displayName: string
  avatarUrl: string | null
  status: SignUpStatus
  appeared: boolean
  priority: number
  joinedAt: string
}

export interface SessionDetail extends Omit<SessionSummary, 'signupCount' | 'assignedCount'> {
  codexEntryId: string | null
  signups: SessionPlayer[]
}

export type SessionFilter = 'upcoming' | 'mine' | 'dm' | 'all'

export const sessionService = {
  async list(filter: SessionFilter = 'upcoming'): Promise<Result<SessionSummary[]>> {
    const result = await api.get<{ sessions: SessionSummary[] }>(`/api/sessions?filter=${filter}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.sessions }
  },

  async get(id: string): Promise<Result<SessionDetail>> {
    const result = await api.get<{ session: SessionDetail }>(`/api/sessions/${id}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.session }
  },

  async create(data: {
    title: string
    shortDescription?: string
    date: string
    maxPlayers?: number
    tags?: string[]
    isStoryAdventure?: boolean
    excludeFromKarma?: boolean
    rankCombat?: number
    rankExploration?: number
    rankRoleplaying?: number
  }): Promise<Result<SessionSummary>> {
    const result = await api.post<{ session: SessionSummary }>('/api/sessions', data)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.session }
  },

  async update(id: string, data: Partial<SessionSummary>): Promise<Result<SessionSummary>> {
    const result = await api.patch<{ session: SessionSummary }>(`/api/sessions/${id}`, data)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.session }
  },

  async delete(id: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>(`/api/sessions/${id}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async signUp(sessionId: string): Promise<Result<{ id: string; status: SignUpStatus }>> {
    const result = await api.post<{ signUp: { id: string; status: SignUpStatus } }>(
      `/api/sessions/${sessionId}/signup`, {},
    )
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.signUp }
  },

  async cancelSignUp(sessionId: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>(`/api/sessions/${sessionId}/signup`)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async assign(
    sessionId: string,
    assignments: Array<{ signUpId: string; status: SignUpStatus }>,
  ): Promise<Result<void>> {
    const result = await api.post<{ success: boolean }>(`/api/sessions/${sessionId}/assign`, { assignments })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async markAttendance(
    sessionId: string,
    attendance: Array<{ signUpId: string; appeared: boolean }>,
  ): Promise<Result<void>> {
    const result = await api.post<{ success: boolean }>(`/api/sessions/${sessionId}/attendance`, { attendance })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async getKarma(): Promise<Result<number>> {
    const result = await api.get<{ karma: number }>('/api/sessions/karma')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.karma }
  },
}
