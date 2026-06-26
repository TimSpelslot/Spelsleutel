import { api } from './api'
import { t } from '@/i18n'
import type { Result } from '@/types'

// ── Raw API types (matching AbAdventure from the backend) ─────────────────

interface RawUser {
  id: number
  display_name: string | null
  profile_pic: string | null
  privilege_level: number
  story_player: boolean
}

interface RawAssignment {
  user: RawUser
  appeared: boolean
  creation_date: string
}

interface RawSignup {
  user: RawUser
  adventure_id: number
  priority: number
}

interface RawAdventure {
  id: number
  title: string
  short_description: string
  date: string
  creator: RawUser | null
  num_sessions: number
  predecessor_id: number | null
  max_players: number
  tags: string | null
  requested_room: string | null
  release_assignments: boolean
  rank_combat: number
  rank_exploration: number
  rank_roleplaying: number
  is_waitinglist: number
  exclude_from_karma: boolean
  is_story_adventure: boolean
  // Only present on detail endpoint (/api/adventures/:id), absent on list endpoint
  assignments?: RawAssignment[]
  signups?: RawSignup[]
}

// ── Normalised types ──────────────────────────────────────────────────────

export interface AbPlayer {
  id: number
  displayName: string
  appeared: boolean
  joinedAt: string
}

export interface AbWaitlistPlayer {
  id: number
  displayName: string
  priority: number
}

export interface AbSession {
  id: number
  title: string
  shortDescription: string
  date: string
  dmName: string
  maxPlayers: number
  spotsLeft: number
  tags: string[]
  ranks: { combat: number; exploration: number; roleplaying: number }
  isStoryAdventure: boolean
  isWaitingList: boolean
  excludeFromKarma: boolean
  releaseAssignments: boolean
  requestedRoom: string | null
  numSessions: number
  party: AbPlayer[]
  waitlist: AbWaitlistPlayer[]
}

// Legacy compact type still used by DashboardView
export interface UpcomingSession {
  id: number
  title: string
  date: string
  dmName: string | null
  status: 'upcoming' | 'assigned'
  isStoryAdventure: boolean
  spotsLeft: number
  shortDescription: string
  tags: string[]
  ranks: { combat: number; exploration: number; roleplaying: number }
  partySize: number
  maxPlayers: number
}

// ── Normalisers ───────────────────────────────────────────────────────────

function parseTags(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function normaliseSession(raw: RawAdventure): AbSession {
  return {
    id: raw.id,
    title: raw.title,
    shortDescription: raw.short_description,
    date: raw.date,
    dmName: raw.creator?.display_name ?? t('dashboard.sessions.unknownDm'),
    maxPlayers: raw.max_players,
    spotsLeft: Math.max(0, raw.max_players - (raw.assignments?.length ?? 0)),
    tags: parseTags(raw.tags),
    ranks: {
      combat: raw.rank_combat,
      exploration: raw.rank_exploration,
      roleplaying: raw.rank_roleplaying,
    },
    isStoryAdventure: raw.is_story_adventure,
    isWaitingList: Boolean(raw.is_waitinglist),
    excludeFromKarma: raw.exclude_from_karma,
    releaseAssignments: raw.release_assignments,
    requestedRoom: raw.requested_room,
    numSessions: raw.num_sessions,
    party: (raw.assignments ?? []).map((a) => ({
      id: a.user.id,
      displayName: a.user.display_name ?? t('adventureBoard.playerFallback', { id: a.user.id }),
      appeared: a.appeared,
      joinedAt: a.creation_date,
    })),
    waitlist: (raw.signups ?? [])
      .sort((a, b) => a.priority - b.priority)
      .map((s) => ({
        id: s.user.id,
        displayName: s.user.display_name ?? t('adventureBoard.playerFallback', { id: s.user.id }),
        priority: s.priority,
      })),
  }
}

function normaliseCompact(raw: RawAdventure): UpcomingSession {
  return {
    id: raw.id,
    title: raw.title,
    shortDescription: raw.short_description,
    date: raw.date,
    dmName: raw.creator?.display_name ?? null,
    status: raw.release_assignments ? 'assigned' : 'upcoming',
    isStoryAdventure: raw.is_story_adventure,
    spotsLeft: Math.max(0, raw.max_players - (raw.assignments?.length ?? 0)),
    tags: parseTags(raw.tags),
    ranks: {
      combat: raw.rank_combat,
      exploration: raw.rank_exploration,
      roleplaying: raw.rank_roleplaying,
    },
    partySize: raw.assignments?.length ?? 0,
    maxPlayers: raw.max_players,
  }
}

// ── Service ───────────────────────────────────────────────────────────────

export const adventureBoardService = {
  async getUpcomingSessions(): Promise<Result<UpcomingSession[]>> {
    const result = await api.get<RawAdventure[]>('/api/adventure-board/sessions')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.map(normaliseCompact) }
  },

  async getAllSessions(): Promise<Result<AbSession[]>> {
    const result = await api.get<RawAdventure[]>('/api/adventure-board/sessions')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.map(normaliseSession) }
  },

  async getSession(id: number): Promise<Result<AbSession>> {
    const result = await api.get<RawAdventure>(`/api/adventure-board/sessions/${id}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: normaliseSession(result.data) }
  },

  async getUserAssignments(abUserId: number): Promise<Result<AbSession[]>> {
    const result = await api.get<RawAdventure[]>(
      `/api/adventure-board/assignments?abUserId=${abUserId}`,
    )
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.map(normaliseSession) }
  },
}
