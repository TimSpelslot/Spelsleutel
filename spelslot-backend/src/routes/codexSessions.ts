import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { WorldEntry } from '../models/WorldEntry'
import { WorldDocument } from '../models/WorldDocument'
import { User } from '../models/User'
import { getAdventure, type AbAdventure } from '../services/adventureBoard'
import { uniqueSlug } from '../utils/slug'

export const codexSessionsRouter = Router()

const DUTCH_MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
]

// Walk up predecessor_id chain to find the root adventure (no predecessor).
// Caps at 10 hops to guard against corrupt data.
async function findRootAdventure(id: number, depth = 0): Promise<AbAdventure> {
  if (depth > 10) throw new Error('Predecessor chain too deep')
  const adv = await getAdventure(id)
  if (!adv.predecessor_id) return adv
  return findRootAdventure(adv.predecessor_id, depth + 1)
}

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

    // Walk chain to root
    const root = await findRootAdventure(abSessionId)

    // Already synced?
    const existing = await WorldEntry.findOne({ abSessionId: root.id }).lean()
    if (existing) {
      const doc = await WorldDocument.findOne({ entryId: existing._id, type: 'page' })
        .sort({ isFirst: -1 }).lean()
      res.json({ entryId: existing._id.toString(), slug: existing.slug, docId: doc?._id.toString() ?? null })
      return
    }

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
    // Parse date without timezone conversion: split the YYYY-MM-DD string.
    const [yearStr, monthStr] = root.date.split('-')
    const year = Number(yearStr)
    const monthIdx = Number(monthStr) - 1 // 0-based
    const monthSlug = `adventure-diary-${yearStr}-${monthStr}`
    const monthPos = `${yearStr}-${monthStr}` // ISO year-month sorts chronologically

    const monthEntry = await findOrCreateBySlug(monthSlug, {
      name: `${DUTCH_MONTHS[monthIdx]} ${year}`,
      type: 'lore',
      status: 'PUBLISHED',
      permission: 'PLAYERS',
      parentId: diary._id,
      pos: monthPos,
      aliases: [], tags: [], editors: [], lkProperties: [],
      banner: { enabled: false, url: '', yPosition: 50 },
    })

    // ── Session entry ─────────────────────────────────────────────────────
    const sessionSlug = await uniqueSlug(`${root.title} ${root.date}`)
    const sessionEntry = await WorldEntry.create({
      name: root.title,
      slug: sessionSlug,
      type: 'session',
      status: 'PUBLISHED',
      permission: 'PLAYERS',
      parentId: monthEntry._id,
      pos: root.date, // YYYY-MM-DD sorts chronologically within a month
      abSessionId: root.id,
      summary: root.short_description ?? '',
      aliases: [], tags: ['session'], editors: [], lkProperties: [],
      banner: { enabled: false, url: '', yPosition: 50 },
    })

    // ── Blank page document ───────────────────────────────────────────────
    const doc = await WorldDocument.create({
      entryId: sessionEntry._id,
      name: 'Sessieaantekeningen',
      type: 'page',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      pos: 'a0',
      isFirst: true,
      isHidden: false,
    })

    res.status(201).json({
      entryId: sessionEntry._id.toString(),
      slug: sessionSlug,
      docId: doc._id.toString(),
    })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/codex/sessions/by-ab/:abSessionId ────────────────────────────
// Resolves any session in a predecessor chain to the root Codex entry.
// Returns { entryId, slug, docId } or 404 if no session page exists yet.
codexSessionsRouter.get('/by-ab/:abSessionId', requireAuth, async (req, res, next) => {
  try {
    const abSessionId = Number(req.params.abSessionId)
    if (!Number.isFinite(abSessionId)) {
      res.status(400).json({ message: 'abSessionId must be a number' }); return
    }

    const root = await findRootAdventure(abSessionId)
    const entry = await WorldEntry.findOne({ abSessionId: root.id }).lean()

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
