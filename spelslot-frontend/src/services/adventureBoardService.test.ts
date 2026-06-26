import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adventureBoardService } from './adventureBoardService'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

import { api } from './api'

// ── Raw shape types ────────────────────────────────────────────────────────

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
  assignments?: RawAssignment[]
  signups?: RawSignup[]
}

// ── Fixture factories ──────────────────────────────────────────────────────

function makeRawUser(overrides: Partial<RawUser> = {}): RawUser {
  return {
    id: 1,
    display_name: 'Dungeon Master',
    profile_pic: null,
    privilege_level: 2,
    story_player: false,
    ...overrides,
  }
}

function makeRawAssignment(overrides: Partial<RawAssignment> = {}): RawAssignment {
  return {
    user: makeRawUser({ id: 10, display_name: 'Player One' }),
    appeared: true,
    creation_date: '2024-03-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeRawSignup(overrides: Partial<RawSignup> = {}): RawSignup {
  return {
    user: makeRawUser({ id: 20, display_name: 'Waitlisted Player' }),
    adventure_id: 1,
    priority: 1,
    ...overrides,
  }
}

function makeRawAdventure(overrides: Partial<RawAdventure> = {}): RawAdventure {
  return {
    id: 42,
    title: 'The Dragon Heist',
    short_description: 'A city adventure',
    date: '2024-06-15T18:00:00.000Z',
    creator: makeRawUser({ id: 1, display_name: 'DM Tim' }),
    num_sessions: 1,
    predecessor_id: null,
    max_players: 5,
    tags: 'combat,social',
    requested_room: 'Room A',
    release_assignments: false,
    rank_combat: 3,
    rank_exploration: 2,
    rank_roleplaying: 5,
    is_waitinglist: 0,
    exclude_from_karma: false,
    is_story_adventure: false,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('adventureBoardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUpcomingSessions', () => {
    it('should return mapped UpcomingSession array on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ id: 1 }), makeRawAdventure({ id: 2 })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toHaveLength(2)
        expect(result.data[0]).toHaveProperty('id', 1)
        expect(result.data[0]).toHaveProperty('status')
        expect(result.data[0]).toHaveProperty('spotsLeft')
        expect(result.data[0]).toHaveProperty('partySize')
      }
    })

    it('should map release_assignments=false to status "upcoming"', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ release_assignments: false })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].status).toBe('upcoming')
      }
    })

    it('should map release_assignments=true to status "assigned"', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ release_assignments: true })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].status).toBe('assigned')
      }
    })

    it('should split tags string into an array', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ tags: 'combat, social, exploration' })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].tags).toEqual(['combat', 'social', 'exploration'])
      }
    })

    it('should return empty tags array when tags is null', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ tags: null })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].tags).toEqual([])
      }
    })

    it('should set dmName to null when creator is null', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ creator: null })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].dmName).toBeNull()
      }
    })

    it('should compute spotsLeft as max_players minus assignments length', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [
        makeRawAdventure({
          max_players: 5,
          assignments: [makeRawAssignment(), makeRawAssignment()],
        }),
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].spotsLeft).toBe(3)
        expect(result.data[0].partySize).toBe(2)
      }
    })

    it('should clamp spotsLeft to 0 when assignments exceed max_players', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [
        makeRawAdventure({
          max_players: 2,
          assignments: [makeRawAssignment(), makeRawAssignment(), makeRawAssignment()],
        }),
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUpcomingSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].spotsLeft).toBe(0)
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Network error' })
      const result = await adventureBoardService.getUpcomingSessions()
      expect(result.type).toBe('error')
    })
  })

  describe('getAllSessions', () => {
    it('should return mapped AbSession array on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ id: 10, creator: makeRawUser({ display_name: 'DM Tim' }) })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getAllSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0]).toHaveProperty('id', 10)
        expect(result.data[0]).toHaveProperty('dmName', 'DM Tim')
        expect(result.data[0]).toHaveProperty('party')
        expect(result.data[0]).toHaveProperty('waitlist')
        expect(result.data[0]).toHaveProperty('ranks')
      }
    })

    it('should fall back to "Unknown DM" when creator is null', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ creator: null })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getAllSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].dmName).toBe('Unknown DM')
      }
    })

    it('should normalise party from assignments', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const assignment = makeRawAssignment({
        user: makeRawUser({ id: 99, display_name: 'Gandalf' }),
        appeared: true,
        creation_date: '2024-04-01T09:00:00.000Z',
      })
      const raw = [makeRawAdventure({ max_players: 5, assignments: [assignment] })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getAllSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].party).toHaveLength(1)
        expect(result.data[0].party[0]).toMatchObject({
          id: 99,
          displayName: 'Gandalf',
          appeared: true,
          joinedAt: '2024-04-01T09:00:00.000Z',
        })
      }
    })

    it('should use "Player {id}" fallback when player display_name is null', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const assignment = makeRawAssignment({
        user: makeRawUser({ id: 77, display_name: null }),
      })
      const raw = [makeRawAdventure({ assignments: [assignment] })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getAllSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].party[0].displayName).toBe('Player 77')
      }
    })

    it('should sort waitlist by priority ascending', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const signups = [
        makeRawSignup({ user: makeRawUser({ id: 1, display_name: 'Third' }), priority: 3 }),
        makeRawSignup({ user: makeRawUser({ id: 2, display_name: 'First' }), priority: 1 }),
        makeRawSignup({ user: makeRawUser({ id: 3, display_name: 'Second' }), priority: 2 }),
      ]
      const raw = [makeRawAdventure({ signups })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getAllSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        const waitlist = result.data[0].waitlist
        expect(waitlist[0].priority).toBe(1)
        expect(waitlist[1].priority).toBe(2)
        expect(waitlist[2].priority).toBe(3)
      }
    })

    it('should clamp spotsLeft to 0 when assignments exceed max_players', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [
        makeRawAdventure({
          max_players: 1,
          assignments: [makeRawAssignment(), makeRawAssignment()],
        }),
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getAllSessions()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0].spotsLeft).toBe(0)
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Server error' })
      const result = await adventureBoardService.getAllSessions()
      expect(result.type).toBe('error')
    })
  })

  describe('getSession', () => {
    it('should normalise a single session on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = makeRawAdventure({ id: 99, title: 'One-Shot' })
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getSession(99)

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.id).toBe(99)
        expect(result.data.title).toBe('One-Shot')
        expect(result.data).toHaveProperty('party')
        expect(result.data).toHaveProperty('waitlist')
      }
    })

    it('should call the correct detail endpoint', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: makeRawAdventure({ id: 7 }) })
      await adventureBoardService.getSession(7)
      expect(api.get).toHaveBeenCalledWith('/api/adventure-board/sessions/7')
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await adventureBoardService.getSession(999)
      expect(result.type).toBe('error')
    })
  })

  describe('getUserAssignments', () => {
    it('should call the correct endpoint with abUserId query param', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: [] })

      // ── act ───────────────────────────────────────────────────────────────
      await adventureBoardService.getUserAssignments(42)

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.get).toHaveBeenCalledWith('/api/adventure-board/assignments?abUserId=42')
    })

    it('should return an array of normalised AbSession objects on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const raw = [makeRawAdventure({ id: 5 }), makeRawAdventure({ id: 6 })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: raw })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await adventureBoardService.getUserAssignments(42)

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toHaveLength(2)
        expect(result.data[0]).toHaveProperty('party')
        expect(result.data[0]).toHaveProperty('ranks')
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Unauthorized' })
      const result = await adventureBoardService.getUserAssignments(42)
      expect(result.type).toBe('error')
    })
  })
})
