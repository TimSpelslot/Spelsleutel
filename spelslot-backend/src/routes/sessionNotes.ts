import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { SessionNote, type NoteType } from '../models/SessionNote'

export const sessionNotesRouter = Router()

sessionNotesRouter.use(requireAuth)

const VALID_TYPES = new Set<NoteType>(['player', 'dm'])

function uid(req: Parameters<typeof requireAuth>[0]) {
  return (req as AuthRequest).user!.uid
}

// ── GET /api/session-notes/:sessionId/:noteType
// List all notes (metadata only — no content) for this user+session.
sessionNotesRouter.get('/:sessionId/:noteType', async (req, res, next) => {
  try {
    if (!VALID_TYPES.has(req.params.noteType as NoteType)) {
      res.status(400).json({ message: 'Invalid note type' })
      return
    }
    const notes = await SessionNote.find({
      uid: uid(req),
      sessionId: req.params.sessionId,
      noteType: req.params.noteType,
    })
      .sort({ order: 1, createdAt: 1 })
      .select('name order updatedAt')
      .lean()

    res.json({ notes })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/session-notes/:sessionId/:noteType/:noteId
// Load one note including its content.
sessionNotesRouter.get('/:sessionId/:noteType/:noteId', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.noteId)) {
      res.status(400).json({ message: 'Invalid note ID' })
      return
    }
    const note = await SessionNote.findOne({
      _id: req.params.noteId,
      uid: uid(req),
      sessionId: req.params.sessionId,
      noteType: req.params.noteType,
    }).lean()

    if (!note) {
      res.status(404).json({ message: 'Note not found' })
      return
    }
    res.json({ note })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/session-notes/:sessionId/:noteType
// Create a new note. Auto-names it "Note N".
sessionNotesRouter.post('/:sessionId/:noteType', async (req, res, next) => {
  try {
    if (!VALID_TYPES.has(req.params.noteType as NoteType)) {
      res.status(400).json({ message: 'Invalid note type' })
      return
    }
    const count = await SessionNote.countDocuments({
      uid: uid(req),
      sessionId: req.params.sessionId,
      noteType: req.params.noteType,
    })

    const note = await SessionNote.create({
      uid: uid(req),
      sessionId: req.params.sessionId,
      noteType: req.params.noteType as NoteType,
      name: req.body?.name ?? `Note ${count + 1}`,
      content: { type: 'doc', content: [] },
      order: count,
    })

    res.status(201).json({ note })
  } catch (err) {
    next(err)
  }
})

// ── PUT /api/session-notes/:sessionId/:noteType/:noteId
// Save content (and optionally rename) a note.
sessionNotesRouter.put('/:sessionId/:noteType/:noteId', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.noteId)) {
      res.status(400).json({ message: 'Invalid note ID' })
      return
    }
    const { content, name } = req.body as { content?: object; name?: string }
    if (!content && !name) {
      res.status(400).json({ message: 'Provide content or name' })
      return
    }

    const update: Record<string, unknown> = {}
    if (content) update.content = content
    if (name) update.name = name

    const note = await SessionNote.findOneAndUpdate(
      { _id: req.params.noteId, uid: uid(req), sessionId: req.params.sessionId },
      { $set: update },
      { new: true, select: 'name order updatedAt' },
    ).lean()

    if (!note) {
      res.status(404).json({ message: 'Note not found' })
      return
    }
    res.json({ note })
  } catch (err) {
    next(err)
  }
})
