import { api } from './api'
import type { Result } from '@/types'

export type EntryType = 'lore' | 'location' | 'npc' | 'faction' | 'item' | 'event' | 'rule' | 'session'

export interface CodexEntry {
  id: string
  name: string
  slug: string
  type: EntryType
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  permission: 'PUBLIC' | 'PLAYERS' | 'DM_ONLY' | 'PRIVATE'
  isLocked: boolean
  parentId: string | null
  pos: string
  aliases: string[]
  tags: string[]
  iconColor?: string
  iconGlyph?: string
  iconShape?: string
  banner: { enabled: boolean; url: string; yPosition: number }
  summary?: string
  authorId: string | null
  editors: string[]
  createdAt: string
  updatedAt: string
}

export interface CodexDocument {
  id: string
  entryId: string
  lkDocId?: string
  name: string
  type: 'page' | 'time' | 'map' | 'board'
  content: unknown
  pos: string
  isHidden: boolean
  isFirst: boolean
  calendarId?: string
  createdAt: string
  updatedAt: string
}

export interface CodexRelation {
  id: string
  direction: 'outgoing' | 'incoming'
  type?: string
  relatedEntry?: { id: string; name: string; slug: string; type: string }
}

export interface CodexEntryDetail {
  entry: CodexEntry
  documents: CodexDocument[]
  relations: CodexRelation[]
}

export const codexService = {
  async listEntries(nameFilter?: string): Promise<Result<CodexEntry[]>> {
    const url = nameFilter ? `/api/codex?name=${encodeURIComponent(nameFilter)}` : '/api/codex'
    const result = await api.get<{ entries: CodexEntry[] }>(url)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.entries }
  },

  async listRecent(limit = 6): Promise<Result<CodexEntry[]>> {
    const result = await api.get<{ entries: CodexEntry[] }>(`/api/codex?sort=recent&limit=${limit}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.entries }
  },

  async getBySlug(slug: string): Promise<Result<CodexEntryDetail>> {
    return api.get<CodexEntryDetail>(`/api/codex/slug/${slug}`)
  },

  async getById(id: string): Promise<Result<CodexEntryDetail>> {
    return api.get<CodexEntryDetail>(`/api/codex/${id}`)
  },

  async createEntry(
    payload: Pick<CodexEntry, 'name' | 'type'> & Partial<Pick<CodexEntry, 'permission' | 'status' | 'parentId' | 'tags' | 'summary'>>,
  ): Promise<Result<CodexEntry>> {
    const result = await api.post<{ entry: CodexEntry }>('/api/codex', payload)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.entry }
  },

  async updateEntry(id: string, updates: Partial<CodexEntry>): Promise<Result<CodexEntry>> {
    const result = await api.patch<{ entry: CodexEntry }>(`/api/codex/${id}`, updates)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.entry }
  },

  async getDocuments(entryId: string): Promise<Result<CodexDocument[]>> {
    const result = await api.get<{ documents: CodexDocument[] }>(`/api/codex/${entryId}/documents`)
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.documents }
  },

  async updateDocument(
    entryId: string,
    docId: string,
    updates: Partial<Pick<CodexDocument, 'content' | 'name' | 'isHidden'>>,
  ): Promise<Result<CodexDocument>> {
    const result = await api.patch<{ document: CodexDocument }>(
      `/api/codex/${entryId}/documents/${docId}`,
      updates,
    )
    if (result.type === 'error') return result
    return { type: 'ok', data: result.data.document }
  },

  async deleteDocument(entryId: string, docId: string): Promise<Result<void>> {
    const result = await api.delete<{ success: boolean }>(`/api/codex/${entryId}/documents/${docId}`)
    if (result.type === 'error') return result
    return { type: 'ok', data: undefined }
  },

  async syncSession(abSessionId: number): Promise<Result<{ entryId: string; slug: string; docId: string | null }>> {
    return api.post('/api/codex/sessions/sync', { abSessionId })
  },

  async getSessionByAbId(abSessionId: number): Promise<Result<{ entryId: string; slug: string; docId: string | null }>> {
    return api.get(`/api/codex/sessions/by-ab/${abSessionId}`)
  },

  async getCalendar(calendarId: string): Promise<Result<import('@/utils/lkCalendar').LkCalendarDef>> {
    return api.get(`/api/calendars/${calendarId}`)
  },
}
