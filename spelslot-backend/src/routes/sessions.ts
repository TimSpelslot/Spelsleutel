import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth } from '../middleware/auth'
import type { AuthRequest } from '../middleware/auth'
import { Session } from '../models/Session'
import { SignUp } from '../models/SignUp'
import { User } from '../models/User'
import type { ISession } from '../models/Session'
import type { ISignUp } from '../models/SignUp'
import type { IUser } from '../models/User'

export const sessionsRouter = Router()

sessionsRouter.use(requireAuth)

// ── Helpers ───────────────────────────────────────────────────────────────

async function loadUser(uid: string) {
  return User.findOne({ uid }).lean<IUser & { _id: unknown }>()
}

function buildDmPayload(u: Pick<IUser, 'uid' | 'displayName' | 'avatarUrl'> & { _id: unknown }) {
  return { id: String(u._id), uid: u.uid, displayName: u.displayName, avatarUrl: u.avatarUrl ?? null }
}

function buildSessionSummary(
  s: ISession & { _id: unknown },
  dm: ReturnType<typeof buildDmPayload> | null,
  signupCount: number,
  assignedCount: number,
  mySignUp?: (ISignUp & { _id: unknown }) | null,
) {
  return {
    id: String(s._id),
    title: s.title,
    shortDescription: s.shortDescription,
    date: s.date,
    dm,
    maxPlayers: s.maxPlayers,
    status: s.status,
    tags: s.tags,
    isStoryAdventure: s.isStoryAdventure,
    excludeFromKarma: s.excludeFromKarma,
    rankCombat: s.rankCombat,
    rankExploration: s.rankExploration,
    rankRoleplaying: s.rankRoleplaying,
    releaseAssignments: s.releaseAssignments,
    signupCount,
    assignedCount,
    mySignUp: mySignUp
      ? { id: String(mySignUp._id), status: mySignUp.status, appeared: mySignUp.appeared }
      : null,
  }
}

function buildSessionDetail(
  s: ISession & { _id: unknown },
  dm: ReturnType<typeof buildDmPayload> | null,
  signups: Array<ISignUp & { _id: unknown }>,
  userMap: Map<string, Pick<IUser, 'uid' | 'displayName' | 'avatarUrl'> & { _id: unknown }>,
  viewer: IUser & { _id: unknown },
) {
  const viewerId = String(viewer._id)
  const isDmOrAdmin = viewer.role === 'DM' || viewer.role === 'ADMIN'
  const isOwnSession = String(s.dmId) === viewerId
  const showFullSignups = isDmOrAdmin || isOwnSession

  const mySignUp = signups.find((su) => String(su.userId) === viewerId) ?? null
  const active = signups.filter((su) => su.status !== 'cancelled')

  const buildPlayer = (su: ISignUp & { _id: unknown }) => {
    const u = userMap.get(String(su.userId))
    return {
      signUpId: String(su._id),
      userId: String(su.userId),
      displayName: u?.displayName ?? 'Unknown',
      avatarUrl: u?.avatarUrl ?? null,
      status: su.status,
      appeared: su.appeared,
      priority: su.priority,
      joinedAt: (su as any).createdAt,
    }
  }

  return {
    id: String(s._id),
    title: s.title,
    shortDescription: s.shortDescription,
    date: s.date,
    dm,
    maxPlayers: s.maxPlayers,
    status: s.status,
    tags: s.tags,
    isStoryAdventure: s.isStoryAdventure,
    excludeFromKarma: s.excludeFromKarma,
    rankCombat: s.rankCombat,
    rankExploration: s.rankExploration,
    rankRoleplaying: s.rankRoleplaying,
    releaseAssignments: s.releaseAssignments,
    codexEntryId: s.codexEntryId ? String(s.codexEntryId) : null,
    mySignUp: mySignUp
      ? { id: String(mySignUp._id), status: mySignUp.status, appeared: mySignUp.appeared }
      : null,
    signups: showFullSignups
      ? active.map(buildPlayer)
      : s.releaseAssignments
        ? active.filter((su) => su.status === 'assigned').map(buildPlayer)
        : [],
  }
}

// ── GET /api/sessions ─────────────────────────────────────────────────────

sessionsRouter.get('/', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const { filter = 'upcoming' } = req.query
    const viewerId = String(viewer._id)

    const query: Record<string, unknown> = {}
    if (filter === 'upcoming') {
      query.date = { $gte: new Date() }
      query.status = { $in: ['open', 'confirmed'] }
    } else if (filter === 'mine') {
      const mySignUps = await SignUp.find({ userId: viewerId, status: { $ne: 'cancelled' } })
        .select('sessionId').lean<Array<{ sessionId: unknown }>>()
      query._id = { $in: mySignUps.map((s) => s.sessionId) }
    } else if (filter === 'dm') {
      query.dmId = viewerId
    }

    const sessions = await Session.find(query).sort({ date: 1 }).lean<Array<ISession & { _id: unknown }>>()
    if (!sessions.length) { res.json({ sessions: [] }); return }

    const dmIds = [...new Set(sessions.map((s) => String(s.dmId)))]
    const dmUsers = await User.find({ _id: { $in: dmIds } })
      .select('uid displayName avatarUrl')
      .lean<Array<Pick<IUser, 'uid' | 'displayName' | 'avatarUrl'> & { _id: unknown }>>()
    const dmMap = new Map(dmUsers.map((u) => [String(u._id), u]))

    const sessionIds = sessions.map((s) => s._id)
    const allSignUps = await SignUp.find({ sessionId: { $in: sessionIds }, status: { $ne: 'cancelled' } })
      .select('sessionId userId status').lean<Array<Pick<ISignUp, 'sessionId' | 'userId' | 'status'> & { _id: unknown }>>()

    const mySignUps = await SignUp.find({ sessionId: { $in: sessionIds }, userId: viewerId })
      .lean<Array<ISignUp & { _id: unknown }>>()
    const mySignUpMap = new Map(mySignUps.map((su) => [String(su.sessionId), su]))

    const result = sessions.map((s) => {
      const sid = String(s._id)
      const signups = allSignUps.filter((su) => String(su.sessionId) === sid)
      const dm = dmMap.get(String(s.dmId))
      return buildSessionSummary(
        s,
        dm ? buildDmPayload(dm) : null,
        signups.filter((su) => su.status === 'pending').length,
        signups.filter((su) => su.status === 'assigned').length,
        mySignUpMap.get(sid),
      )
    })

    res.json({ sessions: result })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/sessions ────────────────────────────────────────────────────

sessionsRouter.post('/', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'DM' && viewer.role !== 'ADMIN') {
      res.status(403).json({ message: 'Only DMs and admins can create sessions' }); return
    }

    const { title, shortDescription = '', date, maxPlayers = 5, tags = [],
      isStoryAdventure = false, excludeFromKarma = false,
      rankCombat = 2, rankExploration = 2, rankRoleplaying = 2 } = req.body

    if (!title || !date) {
      res.status(400).json({ message: 'title and date are required' }); return
    }

    const session = await Session.create({
      title, shortDescription, date: new Date(date),
      dmId: viewer._id, maxPlayers, tags, isStoryAdventure, excludeFromKarma,
      rankCombat, rankExploration, rankRoleplaying, status: 'draft',
    })

    res.status(201).json({ session: buildSessionSummary(session, buildDmPayload(viewer), 0, 0) })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/sessions/karma ───────────────────────────────────────────────

sessionsRouter.get('/karma', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const appearedSignUps = await SignUp.find({ userId: viewer._id, appeared: true })
      .select('sessionId').lean<Array<{ sessionId: unknown }>>()

    const karmaSessions = await Session.countDocuments({
      _id: { $in: appearedSignUps.map((su) => su.sessionId) },
      excludeFromKarma: false,
    })

    res.json({ karma: karmaSessions + (viewer.karmaBonus ?? 0) })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/sessions/:id ─────────────────────────────────────────────────

sessionsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const session = await Session.findById(id).lean<ISession & { _id: unknown }>()
    if (!session) { res.status(404).json({ message: 'Session not found' }); return }

    const signups = await SignUp.find({ sessionId: id }).lean<Array<ISignUp & { _id: unknown }>>()
    const userIds = [...new Set(signups.map((su) => String(su.userId)))]
    const users = await User.find({ _id: { $in: userIds } })
      .select('uid displayName avatarUrl')
      .lean<Array<Pick<IUser, 'uid' | 'displayName' | 'avatarUrl'> & { _id: unknown }>>()
    const userMap = new Map(users.map((u) => [String(u._id), u]))

    const dm = await User.findById(session.dmId)
      .select('uid displayName avatarUrl')
      .lean<Pick<IUser, 'uid' | 'displayName' | 'avatarUrl'> & { _id: unknown }>()

    res.json({ session: buildSessionDetail(session, dm ? buildDmPayload(dm) : null, signups, userMap, viewer) })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/sessions/:id ───────────────────────────────────────────────

sessionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const session = await Session.findById(id).lean<ISession & { _id: unknown }>()
    if (!session) { res.status(404).json({ message: 'Session not found' }); return }
    if (String(session.dmId) !== String(viewer._id) && viewer.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden' }); return
    }

    const allowed = ['title', 'shortDescription', 'date', 'maxPlayers', 'status',
      'tags', 'isStoryAdventure', 'excludeFromKarma',
      'rankCombat', 'rankExploration', 'rankRoleplaying', 'releaseAssignments']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }
    if (updates.date) updates.date = new Date(updates.date as string)

    const updated = await Session.findByIdAndUpdate(id, updates, { new: true }).lean<ISession & { _id: unknown }>()
    res.json({ session: updated })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────

sessionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const session = await Session.findById(id).lean<ISession & { _id: unknown }>()
    if (!session) { res.status(404).json({ message: 'Session not found' }); return }
    if (String(session.dmId) !== String(viewer._id) && viewer.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden' }); return
    }

    await Session.findByIdAndDelete(id)
    await SignUp.deleteMany({ sessionId: id })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/sessions/:id/signup ─────────────────────────────────────────

sessionsRouter.post('/:id/signup', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const session = await Session.findById(id).lean<ISession & { _id: unknown }>()
    if (!session) { res.status(404).json({ message: 'Session not found' }); return }
    if (session.status !== 'open') {
      res.status(400).json({ message: 'Session is not open for sign-ups' }); return
    }

    const existing = await SignUp.findOne({ sessionId: id, userId: viewer._id }).lean<ISignUp & { _id: unknown }>()
    if (existing && existing.status !== 'cancelled') {
      res.status(400).json({ message: 'Already signed up' }); return
    }

    const activeCount = await SignUp.countDocuments({ sessionId: id, status: { $ne: 'cancelled' } })
    const priority = activeCount + 1

    let signUp: ISignUp & { _id: unknown }
    if (existing) {
      signUp = (await SignUp.findByIdAndUpdate(
        existing._id, { status: 'pending', priority, appeared: false }, { new: true },
      ).lean<ISignUp & { _id: unknown }>())!
    } else {
      signUp = (await SignUp.create({ sessionId: id, userId: viewer._id, status: 'pending', priority })) as unknown as ISignUp & { _id: unknown }
    }

    res.status(201).json({ signUp: { id: String(signUp._id), status: signUp.status, priority: signUp.priority } })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/sessions/:id/signup ──────────────────────────────────────

sessionsRouter.delete('/:id/signup', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const updated = await SignUp.findOneAndUpdate(
      { sessionId: id, userId: viewer._id, status: { $ne: 'cancelled' } },
      { status: 'cancelled' },
    )
    if (!updated) { res.status(404).json({ message: 'Sign-up not found' }); return }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/sessions/:id/assign ─────────────────────────────────────────
// Body: { assignments: Array<{ signUpId, status: 'assigned' | 'waitlist' | 'pending' }> }

sessionsRouter.post('/:id/assign', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const session = await Session.findById(id).lean<ISession & { _id: unknown }>()
    if (!session) { res.status(404).json({ message: 'Session not found' }); return }
    if (String(session.dmId) !== String(viewer._id) && viewer.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden' }); return
    }

    const { assignments } = req.body as { assignments: Array<{ signUpId: string; status: string }> }
    if (!Array.isArray(assignments)) {
      res.status(400).json({ message: 'assignments array required' }); return
    }

    await Promise.all(assignments.map(({ signUpId, status }) => SignUp.findByIdAndUpdate(signUpId, { status })))
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/sessions/:id/attendance ────────────────────────────────────
// Body: { attendance: Array<{ signUpId, appeared: boolean }> }

sessionsRouter.post('/:id/attendance', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const session = await Session.findById(id).lean<ISession & { _id: unknown }>()
    if (!session) { res.status(404).json({ message: 'Session not found' }); return }
    if (String(session.dmId) !== String(viewer._id) && viewer.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden' }); return
    }

    const { attendance } = req.body as { attendance: Array<{ signUpId: string; appeared: boolean }> }
    if (!Array.isArray(attendance)) {
      res.status(400).json({ message: 'attendance array required' }); return
    }

    await Promise.all(attendance.map(({ signUpId, appeared }) => SignUp.findByIdAndUpdate(signUpId, { appeared })))
    await Session.findByIdAndUpdate(id, { status: 'completed' })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
