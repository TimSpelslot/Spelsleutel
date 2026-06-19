import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth'
import { WorldEntry, type IWorldEntry } from '../models/WorldEntry'
import { WorldDocument } from '../models/WorldDocument'
import { WorldEntryRelation } from '../models/WorldEntryRelation'
import { User } from '../models/User'
import { uniqueSlug } from '../utils/slug'
import { posAfter } from '../utils/pos'

export const codexRouter = Router()

// ── Helpers ───────────────────────────────────────────────────────────────

type MongoUser = IWorldEntry extends never ? never : {
  _id: unknown
  role: string
  isWorldbuilder: boolean
}

function permissionFilter(user: { _id: unknown; role: string } | null) {
  if (!user) return { permission: 'PUBLIC' }
  if (user.role === 'DM' || user.role === 'ADMIN') return {}
  return {
    $or: [
      { permission: { $in: ['PUBLIC', 'PLAYERS'] } },
      { permission: 'PRIVATE', authorId: user._id },
      { permission: 'PRIVATE', editors: user._id },
    ],
  }
}

function canWrite(
  user: { _id: unknown; role: string; isWorldbuilder: boolean },
  entry: { isLocked?: boolean; authorId?: unknown; editors?: unknown[] },
): boolean {
  if (user.role === 'DM' || user.role === 'ADMIN') return true
  if (entry.isLocked) return false
  if (!user.isWorldbuilder) return false
  const uid = user._id?.toString()
  const isAuthor = entry.authorId?.toString() === uid
  const isEditor = (entry.editors ?? []).some((e) => e?.toString() === uid)
  return isAuthor || isEditor
}

function buildEntrySummary(e: Record<string, unknown>) {
  return {
    id: (e._id as object).toString(),
    name: e.name,
    slug: e.slug,
    type: e.type,
    status: e.status,
    permission: e.permission,
    isLocked: e.isLocked,
    parentId: e.parentId ? (e.parentId as object).toString() : null,
    pos: e.pos,
    aliases: e.aliases,
    tags: e.tags,
    iconColor: e.iconColor,
    iconGlyph: e.iconGlyph,
    iconShape: e.iconShape,
    banner: e.banner,
    summary: e.summary,
    authorId: e.authorId ? (e.authorId as object).toString() : null,
    editors: Array.isArray(e.editors) ? e.editors.map((id) => (id as object).toString()) : [],
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

function buildDocPayload(d: Record<string, unknown>) {
  return {
    id: (d._id as object).toString(),
    entryId: (d.entryId as object).toString(),
    lkDocId: d.lkDocId,
    name: d.name,
    type: d.type,
    content: d.content,
    pos: d.pos,
    isHidden: d.isHidden,
    isFirst: d.isFirst,
    calendarId: d.calendarId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

async function loadUser(uid: string) {
  return User.findOne({ uid }).lean()
}

async function entryWithRelations(entry: Record<string, unknown>) {
  const id = entry._id as object

  const [documents, outgoing, incoming] = await Promise.all([
    WorldDocument.find({ entryId: id }).sort({ isFirst: -1, pos: 1 }).lean(),
    WorldEntryRelation.find({ sourceId: id }).lean(),
    WorldEntryRelation.find({ targetId: id }).lean(),
  ])

  const relatedIds = [
    ...outgoing.map((r) => r.targetId),
    ...incoming.map((r) => r.sourceId),
  ]
  const relatedEntries = await WorldEntry.find({ _id: { $in: relatedIds } })
    .select('name slug type')
    .lean()
  const relatedMap = new Map(relatedEntries.map((e) => [e._id.toString(), e]))

  const relations = [
    ...outgoing.map((r) => ({
      id: r._id.toString(),
      direction: 'outgoing' as const,
      type: r.type,
      relatedEntry: relatedMap.get(r.targetId.toString()),
    })),
    ...incoming.map((r) => ({
      id: r._id.toString(),
      direction: 'incoming' as const,
      type: r.type,
      relatedEntry: relatedMap.get(r.sourceId.toString()),
    })),
  ]

  return {
    entry: buildEntrySummary(entry),
    documents: documents.map((d) => buildDocPayload(d as Record<string, unknown>)),
    relations,
  }
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/codex — list all accessible entries (optional ?name= filter for mention search)
codexRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const mongoUser = authReq.user ? await loadUser(authReq.user.uid) : null
    const nameFilter = req.query.name
      ? { name: { $regex: req.query.name as string, $options: 'i' } }
      : {}
    const entries = await WorldEntry.find({ ...permissionFilter(mongoUser), ...nameFilter })
      .select('-lkProperties')
      .limit(req.query.name ? 20 : 2000)
      .lean()
    res.json({ entries: entries.map((e) => buildEntrySummary(e as Record<string, unknown>)) })
  } catch {
    res.status(500).json({ message: 'Failed to load entries' })
  }
})

// POST /api/codex — create entry
codexRouter.post('/', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const mongoUser = await loadUser(authReq.user!.uid)
    if (!mongoUser) { res.status(401).json({ message: 'User not found' }); return }

    const isDmAdmin = mongoUser.role === 'DM' || mongoUser.role === 'ADMIN'
    if (!isDmAdmin && !mongoUser.isWorldbuilder) {
      res.status(403).json({ message: 'Insufficient permissions' }); return
    }

    const { name, type, permission, status, parentId, tags, summary } = req.body
    if (!name || !type) { res.status(400).json({ message: 'name and type are required' }); return }

    const slug = await uniqueSlug(name)

    // Place new entry after the last sibling under the same parent
    const lastSibling = await WorldEntry.findOne(
      parentId ? { parentId } : { parentId: { $exists: false } },
    ).sort({ pos: -1 }).select('pos').lean()
    const pos = posAfter(lastSibling?.pos)

    const entry = await WorldEntry.create({
      name,
      slug,
      type,
      permission: permission ?? 'PLAYERS',
      status: status ?? 'DRAFT',
      parentId: parentId ?? undefined,
      pos,
      tags: tags ?? [],
      summary: summary ?? '',
      authorId: mongoUser._id,
    })

    res.status(201).json({ entry: buildEntrySummary(entry.toObject() as unknown as Record<string, unknown>) })
  } catch {
    res.status(500).json({ message: 'Failed to create entry' })
  }
})

// GET /api/codex/slug/:slug — get entry by slug (MUST be before /:id)
codexRouter.get('/slug/:slug', optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const mongoUser = authReq.user ? await loadUser(authReq.user.uid) : null
    const entry = await WorldEntry.findOne({
      slug: req.params.slug,
      ...permissionFilter(mongoUser),
    }).lean()

    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return }

    res.json(await entryWithRelations(entry as Record<string, unknown>))
  } catch {
    res.status(500).json({ message: 'Failed to load entry' })
  }
})

// GET /api/codex/:id — get entry by ID
codexRouter.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }

    const authReq = req as AuthRequest
    const mongoUser = authReq.user ? await loadUser(authReq.user.uid) : null
    const entry = await WorldEntry.findOne({
      _id: req.params.id,
      ...permissionFilter(mongoUser),
    }).lean()

    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return }

    res.json(await entryWithRelations(entry as Record<string, unknown>))
  } catch {
    res.status(500).json({ message: 'Failed to load entry' })
  }
})

// PATCH /api/codex/:id — update entry
codexRouter.patch('/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }

    const authReq = req as AuthRequest
    const mongoUser = await loadUser(authReq.user!.uid)
    if (!mongoUser) { res.status(401).json({ message: 'User not found' }); return }

    const entry = await WorldEntry.findById(req.params.id).lean()
    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return }

    if (!canWrite(mongoUser as MongoUser, entry)) {
      res.status(403).json({ message: 'Insufficient permissions' }); return
    }

    const allowed = ['name', 'type', 'status', 'permission', 'isLocked', 'parentId', 'pos',
      'aliases', 'tags', 'iconColor', 'iconGlyph', 'iconShape', 'banner', 'summary']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    const updated = await WorldEntry.findByIdAndUpdate(
      req.params.id, { $set: updates }, { new: true },
    ).lean()

    res.json({ entry: buildEntrySummary(updated as Record<string, unknown>) })
  } catch {
    res.status(500).json({ message: 'Failed to update entry' })
  }
})

// GET /api/codex/:id/documents
codexRouter.get('/:id/documents', optionalAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }

    const authReq = req as AuthRequest
    const mongoUser = authReq.user ? await loadUser(authReq.user.uid) : null
    const entry = await WorldEntry.findOne({
      _id: req.params.id,
      ...permissionFilter(mongoUser),
    }).lean()
    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return }

    const docs = await WorldDocument.find({ entryId: entry._id }).sort({ isFirst: -1, pos: 1 }).lean()
    res.json({ documents: docs.map((d) => buildDocPayload(d as Record<string, unknown>)) })
  } catch {
    res.status(500).json({ message: 'Failed to load documents' })
  }
})

// POST /api/codex/:id/documents
codexRouter.post('/:id/documents', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }

    const authReq = req as AuthRequest
    const mongoUser = await loadUser(authReq.user!.uid)
    if (!mongoUser) { res.status(401).json({ message: 'User not found' }); return }

    const entry = await WorldEntry.findById(req.params.id).lean()
    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return }

    if (!canWrite(mongoUser as MongoUser, entry)) {
      res.status(403).json({ message: 'Insufficient permissions' }); return
    }

    const { name, type, content, pos } = req.body
    const doc = await WorldDocument.create({
      entryId: entry._id,
      name: name ?? 'Page',
      type: type ?? 'page',
      content: content ?? { type: 'doc', content: [] },
      pos: pos ?? '',
    })

    res.status(201).json({ document: buildDocPayload(doc.toObject() as unknown as Record<string, unknown>) })
  } catch {
    res.status(500).json({ message: 'Failed to create document' })
  }
})

// PATCH /api/codex/:id/documents/:docId
codexRouter.patch('/:id/documents/:docId', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.docId)) {
      res.status(400).json({ message: 'Invalid ID' }); return
    }

    const authReq = req as AuthRequest
    const mongoUser = await loadUser(authReq.user!.uid)
    if (!mongoUser) { res.status(401).json({ message: 'User not found' }); return }

    const entry = await WorldEntry.findById(req.params.id).lean()
    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return }

    if (!canWrite(mongoUser as MongoUser, entry)) {
      res.status(403).json({ message: 'Insufficient permissions' }); return
    }

    const allowed = ['content', 'name', 'isHidden']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    const doc = await WorldDocument.findOneAndUpdate(
      { _id: req.params.docId, entryId: req.params.id },
      { $set: updates },
      { new: true },
    ).lean()

    if (!doc) { res.status(404).json({ message: 'Document not found' }); return }
    res.json({ document: buildDocPayload(doc as Record<string, unknown>) })
  } catch {
    res.status(500).json({ message: 'Failed to update document' })
  }
})

// DELETE /api/codex/:id/documents/:docId — DM/Admin only
codexRouter.delete('/:id/documents/:docId', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.docId)) {
      res.status(400).json({ message: 'Invalid ID' }); return
    }

    const authReq = req as AuthRequest
    const mongoUser = await loadUser(authReq.user!.uid)
    if (!mongoUser) { res.status(401).json({ message: 'User not found' }); return }

    if (mongoUser.role !== 'DM' && mongoUser.role !== 'ADMIN') {
      res.status(403).json({ message: 'Insufficient permissions' }); return
    }

    const deleted = await WorldDocument.findOneAndDelete({
      _id: req.params.docId,
      entryId: req.params.id,
    })

    if (!deleted) { res.status(404).json({ message: 'Document not found' }); return }
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: 'Failed to delete document' })
  }
})
