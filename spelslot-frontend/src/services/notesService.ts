import { api } from './api'
import type { Result } from '@/types'

export type NoteType = 'player' | 'dm'

export interface NoteMeta {
  _id: string
  name: string
  order: number
  updatedAt: string
}

export interface NoteDetail extends NoteMeta {
  content: object
}

export const notesService = {
  async list(sessionId: string, noteType: NoteType): Promise<Result<NoteMeta[]>> {
    const r = await api.get<{ notes: NoteMeta[] }>(`/api/session-notes/${sessionId}/${noteType}`)
    if (r.type === 'error') return r
    return { type: 'ok', data: r.data.notes }
  },

  async load(sessionId: string, noteType: NoteType, noteId: string): Promise<Result<NoteDetail>> {
    const r = await api.get<{ note: NoteDetail }>(`/api/session-notes/${sessionId}/${noteType}/${noteId}`)
    if (r.type === 'error') return r
    return { type: 'ok', data: r.data.note }
  },

  async create(sessionId: string, noteType: NoteType, name?: string): Promise<Result<NoteDetail>> {
    const r = await api.post<{ note: NoteDetail }>(`/api/session-notes/${sessionId}/${noteType}`, name ? { name } : {})
    if (r.type === 'error') return r
    return { type: 'ok', data: r.data.note }
  },

  async save(sessionId: string, noteType: NoteType, noteId: string, content: object): Promise<Result<NoteMeta>> {
    const r = await api.put<{ note: NoteMeta }>(`/api/session-notes/${sessionId}/${noteType}/${noteId}`, { content })
    if (r.type === 'error') return r
    return { type: 'ok', data: r.data.note }
  },

  async rename(sessionId: string, noteType: NoteType, noteId: string, name: string): Promise<Result<NoteMeta>> {
    const r = await api.put<{ note: NoteMeta }>(`/api/session-notes/${sessionId}/${noteType}/${noteId}`, { name })
    if (r.type === 'error') return r
    return { type: 'ok', data: r.data.note }
  },
}
