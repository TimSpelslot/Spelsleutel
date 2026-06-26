import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import { notesService } from './notesService'
import type { NoteMeta, NoteDetail } from './notesService'
import { api } from './api'

function makeNoteMeta(overrides: Partial<NoteMeta> = {}): NoteMeta {
  return {
    _id: 'note-1',
    name: 'Session Notes',
    order: 0,
    updatedAt: '2026-06-25T00:00:00Z',
    ...overrides,
  }
}

function makeNoteDetail(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    ...makeNoteMeta(),
    content: { type: 'doc', content: [] },
    ...overrides,
  }
}

const apiMock = api as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('notesService.list', () => {
  it('should call api.get with the correct URL and unwrap { notes }', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const notes = [makeNoteMeta(), makeNoteMeta({ _id: 'note-2', name: 'Combat Notes' })]
    apiMock.get.mockResolvedValue({ type: 'ok', data: { notes } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notesService.list('session-abc', 'player')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.get).toHaveBeenCalledWith('/api/session-notes/session-abc/player')
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data).toHaveLength(2)
      expect(result.data[0]._id).toBe('note-1')
    }
  })

  it('should pass through error from api', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Session not found' })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notesService.list('session-xyz', 'dm')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.message).toBe('Session not found')
    }
  })
})

describe('notesService.load', () => {
  it('should call api.get with the correct URL and unwrap { note }', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const note = makeNoteDetail({ _id: 'note-99', name: 'Loaded Note' })
    apiMock.get.mockResolvedValue({ type: 'ok', data: { note } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notesService.load('session-abc', 'player', 'note-99')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.get).toHaveBeenCalledWith('/api/session-notes/session-abc/player/note-99')
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data.name).toBe('Loaded Note')
      expect(result.data.content).toBeDefined()
    }
  })

  it('should pass through error from api', async () => {
    apiMock.get.mockResolvedValue({ type: 'error', message: 'Note not found' })

    const result = await notesService.load('session-abc', 'player', 'missing')

    expect(result.type).toBe('error')
  })
})

describe('notesService.create', () => {
  it('should send { name } in the body when a name is provided', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const note = makeNoteDetail({ name: 'My New Note' })
    apiMock.post.mockResolvedValue({ type: 'ok', data: { note } })

    // ── act ──────────────────────────────────────────────────────────────────
    await notesService.create('session-abc', 'player', 'My New Note')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.post).toHaveBeenCalledWith('/api/session-notes/session-abc/player', {
      name: 'My New Note',
    })
  })

  it('should send {} in the body when no name is provided', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const note = makeNoteDetail()
    apiMock.post.mockResolvedValue({ type: 'ok', data: { note } })

    // ── act ──────────────────────────────────────────────────────────────────
    await notesService.create('session-abc', 'player')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.post).toHaveBeenCalledWith('/api/session-notes/session-abc/player', {})
  })

  it('should unwrap { note } on ok', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const note = makeNoteDetail({ _id: 'note-new', name: 'Created Note' })
    apiMock.post.mockResolvedValue({ type: 'ok', data: { note } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notesService.create('session-abc', 'dm', 'Created Note')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data._id).toBe('note-new')
    }
  })

  it('should pass through error from api', async () => {
    apiMock.post.mockResolvedValue({ type: 'error', message: 'Forbidden' })

    const result = await notesService.create('session-abc', 'dm')

    expect(result.type).toBe('error')
  })
})

describe('notesService.save', () => {
  it('should use api.put and unwrap { note }', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const note = makeNoteMeta({ _id: 'note-1', updatedAt: '2026-06-25T12:00:00Z' })
    apiMock.put.mockResolvedValue({ type: 'ok', data: { note } })
    const content = { type: 'doc', content: [{ type: 'paragraph' }] }

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notesService.save('session-abc', 'player', 'note-1', content)

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.put).toHaveBeenCalledWith('/api/session-notes/session-abc/player/note-1', {
      content,
    })
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data._id).toBe('note-1')
    }
  })

  it('should pass through error from api', async () => {
    apiMock.put.mockResolvedValue({ type: 'error', message: 'Conflict' })

    const result = await notesService.save('session-abc', 'player', 'note-1', {})

    expect(result.type).toBe('error')
  })
})

describe('notesService.rename', () => {
  it('should use api.put with the new name and unwrap { note }', async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    const note = makeNoteMeta({ _id: 'note-1', name: 'Renamed Note' })
    apiMock.put.mockResolvedValue({ type: 'ok', data: { note } })

    // ── act ──────────────────────────────────────────────────────────────────
    const result = await notesService.rename('session-abc', 'dm', 'note-1', 'Renamed Note')

    // ── assert ────────────────────────────────────────────────────────────────
    expect(apiMock.put).toHaveBeenCalledWith('/api/session-notes/session-abc/dm/note-1', {
      name: 'Renamed Note',
    })
    expect(result.type).toBe('ok')
    if (result.type === 'ok') {
      expect(result.data.name).toBe('Renamed Note')
    }
  })

  it('should pass through error from api', async () => {
    apiMock.put.mockResolvedValue({ type: 'error', message: 'Not found' })

    const result = await notesService.rename('session-abc', 'dm', 'note-1', 'New Name')

    expect(result.type).toBe('error')
  })
})
