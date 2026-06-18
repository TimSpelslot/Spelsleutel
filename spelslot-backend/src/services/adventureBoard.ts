// Typed wrapper around the AdventureBoard live API.
// Auth: Bearer service token from ADVENTUREBOARD_API_TOKEN env var.
// Base URL: https://signup.spelslot.nl

const AB_BASE = 'https://signup.spelslot.nl'

function authHeader(): Record<string, string> {
  const token = process.env.ADVENTUREBOARD_API_TOKEN
  if (!token) throw new Error('ADVENTUREBOARD_API_TOKEN is not set')
  return { Authorization: `Bearer ${token}` }
}

// ── AB API types (derived from OpenAPI spec v0.11.0) ──────────────────

export interface AbUser {
  id: number
  display_name: string | null
  world_builder_name: string | null
  dnd_beyond_name: string | null
  dnd_beyond_campaign: number | null
  privilege_level: number
  personal_room: string | null
  profile_pic: string | null
  story_player: boolean
}

export interface AbAssignment {
  user: AbUser
  appeared: boolean
  creation_date: string // ISO datetime
}

export interface AbSignup {
  user: AbUser
  adventure_id: number
  priority: number
}

export interface AbAdventure {
  id: number
  title: string
  short_description: string
  date: string // YYYY-MM-DD
  creator: AbUser
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
  assignments: AbAssignment[]
  signups: AbSignup[]
}

// ── Internal fetch helper ─────────────────────────────────────────────

async function abGet<T>(path: string): Promise<T> {
  const res = await fetch(`${AB_BASE}${path}`, { headers: authHeader() })
  if (!res.ok) {
    throw new Error(`AdventureBoard API returned ${res.status} on ${path}`)
  }
  return res.json() as Promise<T>
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ── Exported service functions ────────────────────────────────────────

/**
 * Upcoming adventures from today + 90 days.
 * If abUserId is provided, filters to adventures where that user is assigned.
 * (abUserId linkage is wired up once we store AB user IDs on the User model.)
 */
export async function getUpcomingSessions(abUserId?: number): Promise<AbAdventure[]> {
  const weekStart = isoDate(new Date())
  const weekEnd = isoDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))

  const adventures = await abGet<AbAdventure[]>(
    `/api/adventures?week_start=${weekStart}&week_end=${weekEnd}`,
  )

  const sorted = adventures.sort((a, b) => a.date.localeCompare(b.date))

  if (abUserId === undefined) return sorted
  return sorted.filter((adv) => adv.assignments.some((a) => a.user.id === abUserId))
}

/**
 * Adventures where a specific AB user is in the assignments list.
 */
export async function getUserAssignments(abUserId: number): Promise<AbAdventure[]> {
  return getUpcomingSessions(abUserId)
}

/**
 * Single adventure by AB adventure ID.
 */
export async function getAdventure(id: number): Promise<AbAdventure> {
  return abGet<AbAdventure>(`/api/adventures/${id}`)
}
