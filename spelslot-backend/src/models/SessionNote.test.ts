import { describe, it, expect } from 'vitest'
import { SessionNote, type ISessionNote } from './SessionNote'

function makeNote(overrides: Partial<ISessionNote> = {}) {
  return new SessionNote({
    uid: 'firebase-uid',
    sessionId: 'sess-1',
    noteType: 'player',
    ...overrides,
  })
}

describe('SessionNote model', () => {
  it('should validate a minimal valid note', () => {
    const err = makeNote().validateSync()
    expect(err).toBeUndefined()
  })

  it('should require uid, sessionId and noteType', () => {
    // ── act ───────────────────────────────────────────────────────────────
    const err = new SessionNote({}).validateSync()

    // ── assert ────────────────────────────────────────────────────────────
    expect(err?.errors.uid).toBeDefined()
    expect(err?.errors.sessionId).toBeDefined()
    expect(err?.errors.noteType).toBeDefined()
  })

  it('should reject a noteType outside the enum', () => {
    const err = makeNote({ noteType: 'admin' as ISessionNote['noteType'] }).validateSync()
    expect(err?.errors.noteType).toBeDefined()
  })

  it('should default name, content and order', () => {
    const note = makeNote()

    expect(note.name).toBe('Note 1')
    expect(note.content).toEqual({})
    expect(note.order).toBe(0)
  })

  it('should accept both player and dm note types', () => {
    expect(makeNote({ noteType: 'player' }).validateSync()).toBeUndefined()
    expect(makeNote({ noteType: 'dm' }).validateSync()).toBeUndefined()
  })
})
