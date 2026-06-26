import { describe, it, expect, vi, beforeEach } from 'vitest'
import { codexService } from './codexService'
import type { CodexEntry, CodexDocument } from './codexService'

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

// ── Fixture factories ──────────────────────────────────────────────────────

function makeCodexEntry(overrides: Partial<CodexEntry> = {}): CodexEntry {
  return {
    id: 'entry-1',
    name: 'Waterdeep',
    slug: 'waterdeep',
    type: 'location',
    status: 'PUBLISHED',
    permission: 'PLAYERS',
    isLocked: false,
    parentId: null,
    pos: 'a0',
    aliases: [],
    tags: [],
    banner: { enabled: false, url: '', yPosition: 0 },
    authorId: 'user-1',
    editors: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeCodexDocument(overrides: Partial<CodexDocument> = {}): CodexDocument {
  return {
    id: 'doc-1',
    entryId: 'entry-1',
    name: 'Main Page',
    type: 'page',
    content: { type: 'doc', content: [] },
    pos: 'a0',
    isHidden: false,
    isFirst: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('codexService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listEntries', () => {
    it('should unwrap the entries envelope and return the array on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const entries = [makeCodexEntry({ id: 'e-1' }), makeCodexEntry({ id: 'e-2' })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { entries } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.listEntries()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toHaveLength(2)
        expect(result.data[0]).toMatchObject({ id: 'e-1' })
      }
    })

    it('should call /api/codex without a filter', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { entries: [] } })
      await codexService.listEntries()
      expect(api.get).toHaveBeenCalledWith('/api/codex')
    })

    it('should append the name query param when a filter is provided', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { entries: [] } })

      // ── act ───────────────────────────────────────────────────────────────
      await codexService.listEntries('dragons')

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.get).toHaveBeenCalledWith('/api/codex?name=dragons')
    })

    it('should url-encode special characters in the name filter', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { entries: [] } })
      await codexService.listEntries('sword & sorcery')
      expect(api.get).toHaveBeenCalledWith('/api/codex?name=sword%20%26%20sorcery')
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Forbidden' })
      const result = await codexService.listEntries()
      expect(result.type).toBe('error')
    })
  })

  describe('listRecent', () => {
    it('should call the correct endpoint with default limit 6', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { entries: [] } })
      await codexService.listRecent()
      expect(api.get).toHaveBeenCalledWith('/api/codex?sort=recent&limit=6')
    })

    it('should call the correct endpoint with a custom limit', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { entries: [] } })
      await codexService.listRecent(10)
      expect(api.get).toHaveBeenCalledWith('/api/codex?sort=recent&limit=10')
    })

    it('should unwrap the entries envelope and return the array on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const entries = [makeCodexEntry({ id: 'recent-1' })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { entries } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.listRecent()

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data[0]).toMatchObject({ id: 'recent-1' })
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Server error' })
      const result = await codexService.listRecent()
      expect(result.type).toBe('error')
    })
  })

  describe('getBySlug', () => {
    it('should call the correct endpoint and return the result directly', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const detail = {
        entry: makeCodexEntry({ slug: 'waterdeep' }),
        documents: [],
        relations: [],
      }
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: detail })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.getBySlug('waterdeep')

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.get).toHaveBeenCalledWith('/api/codex/slug/waterdeep')
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toHaveProperty('entry')
        expect(result.data).toHaveProperty('documents')
        expect(result.data).toHaveProperty('relations')
      }
    })

    it('should pass through an error result without re-wrapping', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await codexService.getBySlug('no-such-slug')
      expect(result.type).toBe('error')
    })
  })

  describe('getById', () => {
    it('should call the correct endpoint and return the result directly', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const detail = { entry: makeCodexEntry({ id: 'abc' }), documents: [], relations: [] }
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: detail })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.getById('abc')

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.get).toHaveBeenCalledWith('/api/codex/abc')
      expect(result.type).toBe('ok')
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await codexService.getById('missing')
      expect(result.type).toBe('error')
    })
  })

  describe('createEntry', () => {
    it('should unwrap the entry envelope and return the created entry on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const entry = makeCodexEntry({ id: 'new-1', name: 'New NPC', type: 'npc' })
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: { entry } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.createEntry({ name: 'New NPC', type: 'npc' })

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toMatchObject({ id: 'new-1', name: 'New NPC', type: 'npc' })
      }
    })

    it('should post to the correct endpoint with the payload', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const entry = makeCodexEntry()
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: { entry } })
      const payload = { name: 'Dragon', type: 'npc' as const, tags: ['monster'] }

      // ── act ───────────────────────────────────────────────────────────────
      await codexService.createEntry(payload)

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.post).toHaveBeenCalledWith('/api/codex', payload)
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'error', message: 'Validation failed' })
      const result = await codexService.createEntry({ name: 'X', type: 'lore' })
      expect(result.type).toBe('error')
    })
  })

  describe('updateEntry', () => {
    it('should unwrap the entry envelope and return the updated entry on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const entry = makeCodexEntry({ id: 'entry-5', name: 'Updated Name' })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: { entry } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.updateEntry('entry-5', { name: 'Updated Name' })

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data.name).toBe('Updated Name')
      }
    })

    it('should patch the correct endpoint', async () => {
      const entry = makeCodexEntry({ id: 'entry-5' })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: { entry } })
      await codexService.updateEntry('entry-5', { isLocked: true })
      expect(api.patch).toHaveBeenCalledWith('/api/codex/entry-5', { isLocked: true })
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'error', message: 'Forbidden' })
      const result = await codexService.updateEntry('entry-5', { name: 'X' })
      expect(result.type).toBe('error')
    })
  })

  describe('getDocuments', () => {
    it('should unwrap the documents envelope and return the array on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const documents = [makeCodexDocument({ id: 'doc-1' }), makeCodexDocument({ id: 'doc-2' })]
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { documents } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.getDocuments('entry-1')

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toHaveLength(2)
        expect(result.data[0]).toMatchObject({ id: 'doc-1' })
      }
    })

    it('should call the correct endpoint', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: { documents: [] } })
      await codexService.getDocuments('entry-9')
      expect(api.get).toHaveBeenCalledWith('/api/codex/entry-9/documents')
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await codexService.getDocuments('entry-9')
      expect(result.type).toBe('error')
    })
  })

  describe('updateDocument', () => {
    it('should unwrap the document envelope and return the updated document on ok', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const document = makeCodexDocument({ id: 'doc-3', name: 'Updated Doc' })
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: { document } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.updateDocument('entry-1', 'doc-3', { name: 'Updated Doc' })

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toMatchObject({ id: 'doc-3', name: 'Updated Doc' })
      }
    })

    it('should patch the correct endpoint', async () => {
      const document = makeCodexDocument()
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'ok', data: { document } })
      await codexService.updateDocument('entry-1', 'doc-3', { isHidden: true })
      expect(api.patch).toHaveBeenCalledWith('/api/codex/entry-1/documents/doc-3', {
        isHidden: true,
      })
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ type: 'error', message: 'Forbidden' })
      const result = await codexService.updateDocument('entry-1', 'doc-3', { name: 'X' })
      expect(result.type).toBe('error')
    })
  })

  describe('deleteDocument', () => {
    it('should return { type: "ok", data: undefined } on success', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      vi.mocked(api.delete).mockResolvedValueOnce({ type: 'ok', data: { success: true } })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.deleteDocument('entry-1', 'doc-3')

      // ── assert ────────────────────────────────────────────────────────────
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toBeUndefined()
      }
    })

    it('should call the correct delete endpoint', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ type: 'ok', data: { success: true } })
      await codexService.deleteDocument('entry-1', 'doc-3')
      expect(api.delete).toHaveBeenCalledWith('/api/codex/entry-1/documents/doc-3')
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await codexService.deleteDocument('entry-1', 'doc-missing')
      expect(result.type).toBe('error')
    })
  })

  describe('syncSession', () => {
    it('should post to the correct endpoint and return the result directly', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const syncResult = { entryId: 'entry-99', slug: 'session-99', docId: 'doc-1' }
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'ok', data: syncResult })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.syncSession(99)

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.post).toHaveBeenCalledWith('/api/codex/sessions/sync', { abSessionId: 99 })
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toMatchObject({ entryId: 'entry-99', slug: 'session-99' })
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await codexService.syncSession(0)
      expect(result.type).toBe('error')
    })
  })

  describe('getSessionByAbId', () => {
    it('should call the correct endpoint and return the result directly', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const sessionRef = { entryId: 'entry-55', slug: 'session-55', docId: null }
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: sessionRef })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.getSessionByAbId(55)

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.get).toHaveBeenCalledWith('/api/codex/sessions/by-ab/55')
      expect(result.type).toBe('ok')
      if (result.type === 'ok') {
        expect(result.data).toMatchObject({ entryId: 'entry-55', docId: null })
      }
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await codexService.getSessionByAbId(999)
      expect(result.type).toBe('error')
    })
  })

  describe('getCalendar', () => {
    it('should call the correct endpoint and return the result directly', async () => {
      // ── arrange ──────────────────────────────────────────────────────────
      const calendar = { id: 'cal-1', name: 'Forgotten Realms Calendar' }
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'ok', data: calendar })

      // ── act ───────────────────────────────────────────────────────────────
      const result = await codexService.getCalendar('cal-1')

      // ── assert ────────────────────────────────────────────────────────────
      expect(api.get).toHaveBeenCalledWith('/api/calendars/cal-1')
      expect(result.type).toBe('ok')
    })

    it('should pass through an error result', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ type: 'error', message: 'Not found' })
      const result = await codexService.getCalendar('missing')
      expect(result.type).toBe('error')
    })
  })
})
