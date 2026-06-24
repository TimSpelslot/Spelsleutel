import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { WorldEntry } from '../models/WorldEntry'
import { WorldDocument } from '../models/WorldDocument'
import { User } from '../models/User'
import { getAdventure } from '../services/adventureBoard'
import { toSlug } from '../utils/slug'

export const codexSessionsRouter = Router()

const DUTCH_MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
]

// Find or upsert an entry by slug. Uses $setOnInsert so existing entries
// are never overwritten on repeated sync calls.
async function findOrCreateBySlug(
  slug: string,
  fields: Record<string, unknown>,
) {
  return WorldEntry.findOneAndUpdate(
    { slug },
    { $setOnInsert: { slug, ...fields } },
    { upsert: true, new: true },
  )
}

// ── POST /api/codex/sessions/sync ─────────────────────────────────────────
// Body: { abSessionId: number }
// Creates "Adventure Diary → Month YYYY → Session" hierarchy for the chain
// root of the given AB session. Idempotent.
codexSessionsRouter.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest
    const mongoUser = await User.findOne({ uid: authReq.user!.uid }).lean()
    if (!mongoUser || (mongoUser.role !== 'DM' && mongoUser.role !== 'ADMIN')) {
      res.status(403).json({ message: 'DM or ADMIN required' }); return
    }

    const abSessionId = Number(req.body.abSessionId)
    if (!Number.isFinite(abSessionId)) {
      res.status(400).json({ message: 'abSessionId must be a number' }); return
    }

    const current = await getAdventure(abSessionId)

    const [yearStr, monthStr] = current.date.split('-')
    const year = Number(yearStr)
    const monthIdx = Number(monthStr) - 1 // 0-based

    // ── Adventure Diary root ──────────────────────────────────────────────
    const diary = await findOrCreateBySlug('adventure-diary', {
      name: 'Adventure Diary',
      type: 'lore',
      status: 'PUBLISHED',
      permission: 'PLAYERS',
      pos: '~',
      aliases: [], tags: [], editors: [], lkProperties: [],
      banner: { enabled: false, url: '', yPosition: 50 },
    })

    // ── Month entry ───────────────────────────────────────────────────────
    const monthSlug = `adventure-diary-${yearStr}-${monthStr}`
    const monthEntry = await findOrCreateBySlug(monthSlug, {
      name: `${DUTCH_MONTHS[monthIdx]} ${year}`,
      type: 'lore',
      status: 'PUBLISHED',
      permission: 'PLAYERS',
      parentId: diary._id,
      pos: `${yearStr}-${monthStr}`,
      aliases: [], tags: [], editors: [], lkProperties: [],
      banner: { enabled: false, url: '', yPosition: 50 },
    })

    // ── Session entry — deduped by title + month ──────────────────────────
    // Sessions with the same name in the same month are continuations of the
    // same adventure and share one page. No predecessor-chain traversal needed.
    const sessionSlug = `adventure-diary-${toSlug(current.title)}-${yearStr}-${monthStr}`
    const sessionEntry = await findOrCreateBySlug(sessionSlug, {
      name: current.title,
      type: 'session',
      status: 'PUBLISHED',
      permission: 'PLAYERS',
      parentId: monthEntry._id,
      pos: current.date,
      abSessionId: current.id,
      summary: current.short_description ?? '',
      aliases: [], tags: ['session'], editors: [], lkProperties: [],
      banner: { enabled: false, url: '', yPosition: 50 },
    })

    // ── Find or create a page document ───────────────────────────────────
    const existingDoc = await WorldDocument.findOne({ entryId: sessionEntry._id, type: 'page' })
      .sort({ isFirst: -1 }).lean()
    const docId = existingDoc
      ? existingDoc._id.toString()
      : (await WorldDocument.create({
          entryId: sessionEntry._id,
          name: 'Sessieaantekeningen',
          type: 'page',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
          pos: 'a0',
          isFirst: true,
          isHidden: false,
        }))._id.toString()

    res.json({
      entryId: sessionEntry._id.toString(),
      slug: sessionSlug,
      docId,
    })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/codex/sessions/by-ab/:abSessionId ────────────────────────────
// Finds the Codex entry for a given AB session by computing its deterministic
// slug (title + year-month). Returns { entryId, slug, docId } or 404.
codexSessionsRouter.get('/by-ab/:abSessionId', requireAuth, async (req, res, next) => {
  try {
    const abSessionId = Number(req.params.abSessionId)
    if (!Number.isFinite(abSessionId)) {
      res.status(400).json({ message: 'abSessionId must be a number' }); return
    }

    const current = await getAdventure(abSessionId)
    const [yearStr, monthStr] = current.date.split('-')
    const sessionSlug = `adventure-diary-${toSlug(current.title)}-${yearStr}-${monthStr}`

    const entry = await WorldEntry.findOne({ slug: sessionSlug }).lean()
    if (!entry) {
      res.status(404).json({ message: 'No session page yet' }); return
    }

    const doc = await WorldDocument.findOne({ entryId: entry._id, type: 'page' })
      .sort({ isFirst: -1 }).lean()

    res.json({
      entryId: entry._id.toString(),
      slug: entry.slug,
      docId: doc?._id.toString() ?? null,
    })
  } catch (err) {
    next(err)
  }
})
