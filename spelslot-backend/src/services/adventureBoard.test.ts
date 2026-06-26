import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getUpcomingSessions,
  getUserAssignments,
  getAdventure,
  type AbAdventure,
} from './adventureBoard'

const fetchMock = vi.fn()

function makeAdventure(overrides: Partial<AbAdventure> = {}): AbAdventure {
  return {
    id: 1,
    title: 'The Lost Mine',
    short_description: 'A short delve',
    date: '2026-07-01',
    creator: {} as AbAdventure['creator'],
    num_sessions: 1,
    predecessor_id: null,
    max_players: 5,
    tags: null,
    requested_room: null,
    release_assignments: true,
    rank_combat: 0,
    rank_exploration: 0,
    rank_roleplaying: 0,
    is_waitinglist: 0,
    exclude_from_karma: false,
    is_story_adventure: false,
    assignments: [],
    signups: [],
    ...overrides,
  }
}

function okJson(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) }
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  delete process.env.ADVENTUREBOARD_API_TOKEN
})

describe('getUpcomingSessions', () => {
  it('should call the adventures endpoint with a 90-day window and sort by date', async () => {
    // ── arrange ───────────────────────────────────────────────────────────
    fetchMock.mockResolvedValue(
      okJson([
        makeAdventure({ id: 2, date: '2026-08-01' }),
        makeAdventure({ id: 1, date: '2026-07-01' }),
      ]),
    )

    // ── act ───────────────────────────────────────────────────────────────
    const result = await getUpcomingSessions()

    // ── assert ────────────────────────────────────────────────────────────
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('https://signup.spelslot.nl/api/adventures?week_start=')
    expect(url).toContain('week_end=')
    expect(result.map((a) => a.id)).toEqual([1, 2])
  })

  it('should send an Authorization header when a token is configured', async () => {
    process.env.ADVENTUREBOARD_API_TOKEN = 'secret-token'
    fetchMock.mockResolvedValue(okJson([]))

    await getUpcomingSessions()

    const opts = fetchMock.mock.calls[0][1] as { headers: Record<string, string> }
    expect(opts.headers.Authorization).toBe('Bearer secret-token')
  })

  it('should send no Authorization header when no token is configured', async () => {
    fetchMock.mockResolvedValue(okJson([]))

    await getUpcomingSessions()

    const opts = fetchMock.mock.calls[0][1] as { headers: Record<string, string> }
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('should filter to the given user when abUserId is provided', async () => {
    const assigned = makeAdventure({
      id: 10,
      assignments: [{ user: { id: 42 } as never, appeared: false, creation_date: '' }],
    })
    const other = makeAdventure({ id: 11, assignments: [] })
    fetchMock.mockResolvedValue(okJson([assigned, other]))

    const result = await getUpcomingSessions(42)

    expect(result.map((a) => a.id)).toEqual([10])
  })

  it('should throw when the upstream response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) })

    await expect(getUpcomingSessions()).rejects.toThrow(/503/)
  })
})

describe('getUserAssignments', () => {
  it('should delegate to getUpcomingSessions filtered by the user', async () => {
    const assigned = makeAdventure({
      id: 5,
      assignments: [{ user: { id: 7 } as never, appeared: false, creation_date: '' }],
    })
    fetchMock.mockResolvedValue(okJson([assigned, makeAdventure({ id: 6 })]))

    const result = await getUserAssignments(7)

    expect(result.map((a) => a.id)).toEqual([5])
  })
})

describe('getAdventure', () => {
  it('should fetch a single adventure by id', async () => {
    fetchMock.mockResolvedValue(okJson(makeAdventure({ id: 99 })))

    const result = await getAdventure(99)

    expect(fetchMock.mock.calls[0][0]).toBe('https://signup.spelslot.nl/api/adventures/99')
    expect(result.id).toBe(99)
  })

  it('should throw when the adventure is not found', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) })

    await expect(getAdventure(1)).rejects.toThrow(/404/)
  })
})
