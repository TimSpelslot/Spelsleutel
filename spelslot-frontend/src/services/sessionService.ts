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

export interface AssignedPlayer {
  userId: string
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
  requestedRoom: string | null
  assignedRoom: string | null
  predecessorId: string | null
  numSessions: number
  sessionNumber: number
  requestedPlayerIds: string[]
  isWaitingList: boolean
  signupCount: number
  assignedCount: number
  mySignUp: { id: string; status: SignUpStatus; priority: number; appeared: boolean } | null
  assignedPlayers: AssignedPlayer[] | null
}

export interface AdminSignupsUser {
  userId: string
  displayName: string
  avatarUrl: string | null
  karma: number
  signups: Array<{ sessionId: string; sessionTitle: string; priority: number; status: string }>
}

export interface AdminSignupsResult {
  weekStart: string
  sessions: Array<{ id: string; title: string }>
  users: AdminSignupsUser[]
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

export interface AdminRoomSession {
  id: string
  title: string
  date: string
  status: SessionStatus
  dm: { id: string; displayName: string; defaultRoom: string | null } | null
  requestedRoom: string | null
  assignedRoom: string | null
}

export type SessionFilter = 'upcoming' | 'mine' | 'dm' | 'all' | 'week'

export const sessionService = {
  async list(filter: SessionFilter = 'upcoming', week?: string): Promise<Result<SessionSummary[]>> {
    const params = new URLSearchParams({ filter })
    if (week) params.set('week', week)
    const result = await api.get<{ sessions: SessionSummary[] }>(`/api/sessions?${params}`)
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
    requestedRoom?: string | null
    predecessorId?: string | null
    numSessions?: number
    sessionNumber?: number
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

  async signUp(sessionId: string, priority: 1 | 2 | 3): Promise<Result<{ id: string; status: SignUpStatus; priority: number } | null>> {
    const result = await api.post<{ signUp?: { id: string; status: SignUpStatus; priority: number }; removed?: boolean }>(
      `/api/sessions/${sessionId}/signup`, { priority },
    )
    if (result.type === 'error') return result
    // Backend returns { removed: true } when same session + same priority is toggled off
    return { type: 'ok', data: result.data.signUp ?? null }
  },

  async instantSignUp(sessionId: string): Promise<Result<{ id: string; status: SignUpStatus; priority: number } | null>> {
    const result = await api.post<{ signUp?: { id: string; status: SignUpStatus; priority: number }; removed?: boolean }>(
      `/api/sessions/${sessionId}/signup`, {},
    )
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.signUp ?? null }
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

  async requestPlayer(sessionId: string, userId: string): Promise<Result<void>> {
    const result = await api.post<{ success: boolean }>(`/api/sessions/${sessionId}/request-player`, { userId })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async removeRequestedPlayer(sessionId: string, userId: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>(`/api/sessions/${sessionId}/request-player/${userId}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async getWeekRooms(): Promise<Result<AdminRoomSession[]>> {
    const result = await api.get<{ sessions: AdminRoomSession[] }>('/api/sessions/admin/rooms/week')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.sessions }
  },

  async assignRoom(sessionId: string, assignedRoom: string | null): Promise<Result<void>> {
    const result = await api.patch<{ success: boolean }>(`/api/sessions/${sessionId}/room`, { assignedRoom })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async getWeekSignups(): Promise<Result<Array<{ adventure_id: string; priority: number }>>> {
    const result = await api.get<{ signups: Array<{ adventure_id: string; priority: number }> }>('/api/sessions/signups')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.signups }
  },

  async adminAction(action: 'assign' | 'release' | 'reset' | 'karma' | 'reassign', date?: string): Promise<Result<void>> {
    const result = await api.post<{ message: string }>('/api/sessions/admin/action', { action, date })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async movePlayer(signUpId: string, toSessionId: string): Promise<Result<void>> {
    const result = await api.patch<{ success: boolean }>('/api/sessions/move-player', { signUpId, toSessionId })
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async getAdminSignups(week?: string): Promise<Result<AdminSignupsResult>> {
    const params = week ? `?week=${week}` : ''
    const result = await api.get<AdminSignupsResult>(`/api/sessions/admin/signups${params}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data }
  },
}
