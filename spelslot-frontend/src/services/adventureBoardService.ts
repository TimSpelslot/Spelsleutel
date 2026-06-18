import { api } from './api'
import type { Result } from '@/types'

// Shape returned by our backend proxy (a subset of AbAdventure)
interface RawSession {
  id: number
  title: string
  date: string
  creator: { display_name: string | null } | null
  release_assignments: boolean
  is_story_adventure: boolean
}

export interface UpcomingSession {
  id: number
  title: string
  date: string
  dmName: string | null
  status: 'upcoming' | 'assigned'
  isStoryAdventure: boolean
}

function normalise(raw: RawSession): UpcomingSession {
  return {
    id: raw.id,
    title: raw.title,
    date: raw.date,
    dmName: raw.creator?.display_name ?? null,
    status: raw.release_assignments ? 'assigned' : 'upcoming',
    isStoryAdventure: raw.is_story_adventure,
  }
}

export const adventureBoardService = {
  async getUpcomingSessions(): Promise<Result<UpcomingSession[]>> {
    const result = await api.get<RawSession[]>('/api/adventure-board/sessions')
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.map(normalise) }
  },
}
