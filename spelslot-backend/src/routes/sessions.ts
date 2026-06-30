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
import { assignPlayers } from '../lib/assignPlayersLib'
import { assignRooms } from '../lib/assignRoomsLib'
import { InstantModeRange, matchesRange } from '../models/InstantModeRange'

export const sessionsRouter = Router()

sessionsRouter.use(requireAuth)

// ── Helpers ───────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Returns Mon-Sun of the "upcoming" week:
// Mon–Wed → this week; Thu–Sun → next week
function getUpcomingWeek(today: Date = new Date()): [Date, Date] {
  const dayOfWeek = today.getDay()
  const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisMon = new Date(today)
  thisMon.setDate(today.getDate() - daysFromMon)
  thisMon.setHours(0, 0, 0, 0)

  const offset = dayOfWeek >= 1 && dayOfWeek <= 3 ? 0 : 7
  const weekStart = new Date(thisMon)
  weekStart.setDate(thisMon.getDate() + offset)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return [weekStart, weekEnd]
}

function weekFromMonday(mondayIso: string): [Date, Date] {
  const weekStart = new Date(mondayIso)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return [weekStart, weekEnd]
}

async function loadUser(uid: string) {
  return User.findOne({ uid }).lean<IUser & { _id: unknown }>()
}

async function isInstantMode(date: Date = new Date()): Promise<boolean> {
  const ranges = await InstantModeRange.find().lean()
  return ranges.some((r) => matchesRange(r, date))
}

function buildDmPayload(u: Pick<IUser, 'uid' | 'displayName' | 'avatarUrl'> & { _id: unknown }) {
  return { id: String(u._id), uid: u.uid, displayName: u.displayName, avatarUrl: u.avatarUrl ?? null }
}

interface AssignedPlayer {
  userId: string
  displayName: string
  avatarUrl: string | null
}

function buildSessionSummary(
  s: ISession & { _id: unknown },
  dm: ReturnType<typeof buildDmPayload> | null,
  signupCount: number,
  assignedCount: number,
  mySignUp?: (ISignUp & { _id: unknown }) | null,
  assignedPlayers?: AssignedPlayer[] | null,
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
    requestedRoom: s.requestedRoom,
    assignedRoom: s.assignedRoom,
    predecessorId: s.predecessorId ? String(s.predecessorId) : null,
    numSessions: s.numSessions,
    sessionNumber: s.sessionNumber,
    requestedPlayerIds: (s.requestedPlayerIds ?? []).map(String),
    isWaitingList: s.isWaitingList,
    signupCount,
    assignedCount,
    mySignUp: mySignUp
      ? { id: String(mySignUp._id), status: mySignUp.status, priority: mySignUp.priority, appeared: mySignUp.appeared }
      : null,
    assignedPlayers: assignedPlayers ?? null,
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
  const showFullSignups = viewer.role === 'ADMIN'

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
    requestedRoom: s.requestedRoom,
    assignedRoom: s.assignedRoom,
    predecessorId: s.predecessorId ? String(s.predecessorId) : null,
    numSessions: s.numSessions,
    sessionNumber: s.sessionNumber,
    requestedPlayerIds: (s.requestedPlayerIds ?? []).map(String),
    isWaitingList: s.isWaitingList,
    codexEntryId: s.codexEntryId ? String(s.codexEntryId) : null,
    mySignUp: mySignUp
      ? { id: String(mySignUp._id), status: mySignUp.status, priority: mySignUp.priority, appeared: mySignUp.appeared }
      : null,
    signups: showFullSignups
      ? active.map(buildPlayer)
      : s.releaseAssignments
        ? active.map(buildPlayer)
        : [],
  }
}

// ── GET /api/sessions ─────────────────────────────────────────────────────

sessionsRouter.get('/', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const { filter = 'upcoming', week } = req.query
    const viewerId = String(viewer._id)
    const isDmOrAdmin = viewer.role === 'ADMIN'

    const query: Record<string, unknown> = {}
    if (filter === 'week') {
      const [weekStart, weekEnd] = week ? weekFromMonday(week as string) : getUpcomingWeek()
      query.date = { $gte: weekStart, $lte: weekEnd }
      query.status = { $in: ['open', 'confirmed', 'draft'] }
    } else if (filter === 'upcoming') {
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
      .select('sessionId userId status priority appeared').lean<Array<Pick<ISignUp, 'sessionId' | 'userId' | 'status' | 'priority' | 'appeared'> & { _id: unknown }>>()

    const mySignUps = await SignUp.find({ sessionId: { $in: sessionIds }, userId: viewerId })
      .lean<Array<ISignUp & { _id: unknown }>>()
    const mySignUpMap = new Map(mySignUps.map((su) => [String(su.sessionId), su]))

    // Load user data for player list on cards (admins see all; players see assigned after release)
    const relevantUserIds = isDmOrAdmin
      ? [...new Set(allSignUps.map((su) => String(su.userId)))]
      : [...new Set(allSignUps.filter((su) => su.status === 'assigned').map((su) => String(su.userId)))]

    const signupUsers = relevantUserIds.length
      ? await User.find({ _id: { $in: relevantUserIds } })
          .select('displayName avatarUrl')
          .lean<Array<Pick<IUser, 'displayName' | 'avatarUrl'> & { _id: unknown }>>()
      : []
    const signupUserMap = new Map(signupUsers.map((u) => [String(u._id), u]))

    const result = sessions.map((s) => {
      const sid = String(s._id)
      const signups = allSignUps.filter((su) => String(su.sessionId) === sid)
      const dm = dmMap.get(String(s.dmId))

      let assignedPlayers: AssignedPlayer[] | null = null
      if (isDmOrAdmin) {
        assignedPlayers = signups.map((su) => {
          const u = signupUserMap.get(String(su.userId))
          return { userId: String(su.userId), displayName: u?.displayName ?? '?', avatarUrl: u?.avatarUrl ?? null }
        })
      } else if (s.releaseAssignments) {
        assignedPlayers = signups
          .filter((su) => su.status === 'assigned')
          .map((su) => {
            const u = signupUserMap.get(String(su.userId))
            return { userId: String(su.userId), displayName: u?.displayName ?? '?', avatarUrl: u?.avatarUrl ?? null }
          })
      }

      return buildSessionSummary(
        s,
        dm ? buildDmPayload(dm) : null,
        signups.filter((su) => su.status === 'pending').length,
        signups.filter((su) => su.status === 'assigned').length,
        mySignUpMap.get(sid),
        assignedPlayers,
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

    const {
      title, shortDescription = '', date, maxPlayers = 5, tags = [],
      isStoryAdventure = false,
      rankCombat = 2, rankExploration = 2, rankRoleplaying = 2,
      requestedRoom = null, numSessions = 1,
    } = req.body
    const instantMode = await isInstantMode()
    const excludeFromKarma: boolean = instantMode ? true : Boolean(req.body.excludeFromKarma)

    if (!title || !date) {
      res.status(400).json({ message: 'title and date are required' }); return
    }

    const numSessionsVal = Math.min(Math.max(1, Number(numSessions) || 1), 4)
    const assignedRoom = (viewer as any).defaultRoom ?? null
    const baseDate = new Date(date)

    const created: Array<ISession & { _id: unknown }> = []
    let predecessorObjId: unknown = null
    for (let i = 0; i < numSessionsVal; i++) {
      const sessionDate = new Date(baseDate)
      sessionDate.setDate(baseDate.getDate() + 7 * i)
      const sess = await Session.create({
        title, shortDescription, date: sessionDate,
        dmId: viewer._id, maxPlayers, tags, isStoryAdventure, excludeFromKarma,
        rankCombat, rankExploration, rankRoleplaying, status: 'open',
        requestedRoom, assignedRoom,
        predecessorId: predecessorObjId,
        numSessions: numSessionsVal,
        sessionNumber: i + 1,
      })
      created.push(sess as unknown as ISession & { _id: unknown })
      predecessorObjId = (sess as any)._id
    }

    const firstSession = created[0]
    res.status(201).json({ session: buildSessionSummary(firstSession, buildDmPayload(viewer), 0, 0) })
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
    res.json({ karma: viewer.karma ?? 1000 })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/sessions/signups ─────────────────────────────────────────────

sessionsRouter.get('/signups', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const [weekStart, weekEnd] = getUpcomingWeek()
    const weekSessions = await Session.find({ date: { $gte: weekStart, $lte: weekEnd } })
      .select('_id').lean<Array<{ _id: unknown }>>()
    const sessionIds = weekSessions.map((s) => s._id)

    const signups = await SignUp.find({
      sessionId: { $in: sessionIds },
      userId: viewer._id,
      status: { $ne: 'cancelled' },
    }).select('sessionId priority').lean<Array<{ sessionId: unknown; priority: number }>>()

    res.json({
      signups: signups.map((s) => ({ adventure_id: String(s.sessionId), priority: s.priority })),
    })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/sessions/admin/rooms/week ───────────────────────────────────

sessionsRouter.get('/admin/rooms/week', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const sessions = await Session.find({
      date: { $gte: now, $lte: weekLater },
      status: { $nin: ['cancelled'] },
    }).sort({ date: 1 }).lean<Array<ISession & { _id: unknown }>>()

    const dmIds = [...new Set(sessions.map((s) => String(s.dmId)))]
    const dmUsers = await User.find({ _id: { $in: dmIds } })
      .select('uid displayName avatarUrl defaultRoom')
      .lean<Array<Pick<IUser, 'uid' | 'displayName' | 'avatarUrl' | 'defaultRoom'> & { _id: unknown }>>()
    const dmMap = new Map(dmUsers.map((u) => [String(u._id), u]))

    const result = sessions.map((s) => {
      const dm = dmMap.get(String(s.dmId))
      return {
        id: String(s._id),
        title: s.title,
        date: s.date,
        status: s.status,
        dm: dm ? {
          id: String(dm._id),
          displayName: dm.displayName,
          defaultRoom: (dm as any).defaultRoom ?? null,
        } : null,
        requestedRoom: s.requestedRoom,
        assignedRoom: s.assignedRoom,
      }
    })

    res.json({ sessions: result })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/sessions/admin/signups ──────────────────────────────────────
// Returns all players and their week sign-up choices (for admin overview)

sessionsRouter.get('/admin/signups', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    const { week } = req.query
    const [weekStart, weekEnd] = week ? weekFromMonday(week as string) : getUpcomingWeek()

    const weekSessions = await Session.find({
      date: { $gte: weekStart, $lte: weekEnd },
      isWaitingList: false,
    }).select('_id title').lean<Array<{ _id: unknown; title: string }>>()

    const sessionIds = weekSessions.map((s) => s._id)
    const sessionTitleMap = new Map(weekSessions.map((s) => [String(s._id), s.title]))

    const signups = await SignUp.find({
      sessionId: { $in: sessionIds },
      status: { $ne: 'cancelled' },
    }).lean<Array<ISignUp & { _id: unknown }>>()

    const userIds = [...new Set(signups.map((s) => String(s.userId)))]
    const users = await User.find({ _id: { $in: userIds } })
      .select('displayName avatarUrl karma')
      .lean<Array<Pick<IUser, 'displayName' | 'avatarUrl' | 'karma'> & { _id: unknown }>>()
    const userMap = new Map(users.map((u) => [String(u._id), u]))

    const byUser = new Map<string, { displayName: string; avatarUrl: string | null; karma: number; signups: Array<{ sessionId: string; sessionTitle: string; priority: number; status: string }> }>()

    for (const su of signups) {
      const userId = String(su.userId)
      const u = userMap.get(userId)
      if (!byUser.has(userId)) {
        byUser.set(userId, {
          displayName: u?.displayName ?? 'Unknown',
          avatarUrl: u?.avatarUrl ?? null,
          karma: (u as any)?.karma ?? 1000,
          signups: [],
        })
      }
      byUser.get(userId)!.signups.push({
        sessionId: String(su.sessionId),
        sessionTitle: sessionTitleMap.get(String(su.sessionId)) ?? '?',
        priority: su.priority,
        status: su.status,
      })
    }

    const result = [...byUser.entries()].map(([userId, data]) => ({
      userId,
      ...data,
      signups: data.signups.sort((a, b) => a.priority - b.priority),
    }))

    res.json({
      weekStart: weekStart.toISOString(),
      sessions: weekSessions.map((s) => ({ id: String(s._id), title: s.title })),
      users: result,
    })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/sessions/admin/rooms/week ──────────────────────────────────
// Admin: assign a room to a session

sessionsRouter.patch('/:id/room', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid session id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    const { assignedRoom } = req.body
    await Session.findByIdAndUpdate(id, { assignedRoom: assignedRoom ?? null })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Admin action helpers ──────────────────────────────────────────────────

async function releaseAssignments(today: Date) {
  const [weekStart, weekEnd] = getUpcomingWeek(today)
  await Session.updateMany(
    { date: { $gte: weekStart, $lte: weekEnd } },
    { releaseAssignments: true },
  )
}

async function resetRelease(today: Date) {
  const [weekStart, weekEnd] = getUpcomingWeek(today)
  await Session.updateMany(
    { date: { $gte: weekStart, $lte: weekEnd } },
    { releaseAssignments: false },
  )
}

async function reassignKarma(today: Date) {
  const [weekStart, weekEnd] = getUpcomingWeek(today)

  const dmSessions = await Session.find({
    date: { $gte: weekStart, $lte: weekEnd },
    isWaitingList: false,
    excludeFromKarma: false,
  }).select('dmId').lean<Array<{ dmId: unknown }>>()
  const dmIds = [...new Set(dmSessions.map((s) => String(s.dmId)))]
  if (dmIds.length) await User.updateMany({ _id: { $in: dmIds } }, { $inc: { karma: 500 } })

  const weekSessions = await Session.find({ date: { $gte: weekStart, $lte: weekEnd } })
    .select('_id isWaitingList excludeFromKarma').lean<Array<{ _id: unknown; isWaitingList: boolean; excludeFromKarma: boolean }>>()
  const regularIds = weekSessions.filter((s) => !s.isWaitingList && !s.excludeFromKarma).map((s) => s._id)
  const waitlistIds = weekSessions.filter((s) => s.isWaitingList).map((s) => s._id)

  const noShows = await SignUp.find({ sessionId: { $in: regularIds }, status: 'assigned', appeared: false })
    .select('userId').lean<Array<{ userId: unknown }>>()
  if (noShows.length) await User.updateMany({ _id: { $in: noShows.map((s) => s.userId) } }, { $inc: { karma: -500 } })

  const wlAttended = await SignUp.find({ sessionId: { $in: waitlistIds }, status: 'waitlist', appeared: true })
    .select('userId').lean<Array<{ userId: unknown }>>()
  if (wlAttended.length) await User.updateMany({ _id: { $in: wlAttended.map((s) => s.userId) } }, { $inc: { karma: 200 } })

  const wlMissed = await SignUp.find({ sessionId: { $in: waitlistIds }, status: 'waitlist', appeared: false })
    .select('userId').lean<Array<{ userId: unknown }>>()
  if (wlMissed.length) await User.updateMany({ _id: { $in: wlMissed.map((s) => s.userId) } }, { $inc: { karma: 180 } })

  const choicePoints: Record<number, number> = { 1: 100, 2: 120, 3: 140, 4: 150 }
  for (const [prio, pts] of Object.entries(choicePoints)) {
    const attended = await SignUp.find({
      sessionId: { $in: regularIds }, status: 'assigned', appeared: true, priority: Number(prio),
    }).select('userId').lean<Array<{ userId: unknown }>>()
    if (attended.length) await User.updateMany({ _id: { $in: attended.map((s) => s.userId) } }, { $inc: { karma: pts } })
  }
}

async function reassignFromWaitingList(today: Date) {
  const [weekStart, weekEnd] = getUpcomingWeek(today)

  const waitlistSession = await Session.findOne({
    date: { $gte: weekStart, $lte: weekEnd },
    isWaitingList: true,
  }).lean<ISession & { _id: unknown }>()
  if (!waitlistSession) return

  const waitlistSignups = await SignUp.find({
    sessionId: waitlistSession._id,
    status: 'waitlist',
  }).sort({ priority: 1 }).lean<Array<ISignUp & { _id: unknown }>>()
  if (!waitlistSignups.length) return

  const regularSessionIds = (await Session.find({ date: { $gte: weekStart, $lte: weekEnd }, isWaitingList: false })
    .select('_id').lean()).map((s) => s._id)

  const takenAgg = await SignUp.aggregate([
    { $match: { sessionId: { $in: regularSessionIds }, status: 'assigned' } },
    { $group: { _id: '$sessionId', count: { $sum: 1 } } },
  ])
  const takenMap = new Map(takenAgg.map((r: any) => [String(r._id), r.count as number]))

  const regularSessions = await Session.find({
    date: { $gte: weekStart, $lte: weekEnd },
    isWaitingList: false,
  }).lean<Array<ISession & { _id: unknown }>>()
  const sessionMap = new Map(regularSessions.map((s) => [String(s._id), s]))

  for (const su of waitlistSignups) {
    const userId = su.userId
    const playerSignups = await SignUp.find({
      userId,
      sessionId: { $in: regularSessions.map((s) => s._id) },
      status: 'pending',
    }).sort({ priority: 1 }).lean<Array<ISignUp & { _id: unknown }>>()

    let assigned = false
    for (const ps of playerSignups) {
      const sess = sessionMap.get(String(ps.sessionId))
      if (!sess) continue
      const taken = takenMap.get(String(ps.sessionId)) ?? 0
      if (taken < sess.maxPlayers) {
        await SignUp.findByIdAndUpdate(ps._id, { status: 'assigned' })
        await SignUp.findByIdAndDelete(su._id)
        takenMap.set(String(ps.sessionId), taken + 1)
        assigned = true
        break
      }
    }

    if (!assigned) {
      for (const sess of regularSessions) {
        const taken = takenMap.get(String(sess._id)) ?? 0
        if (taken < sess.maxPlayers) {
          await SignUp.create({ sessionId: sess._id, userId, status: 'assigned', priority: 4, appeared: false })
          await SignUp.findByIdAndDelete(su._id)
          takenMap.set(String(sess._id), taken + 1)
          break
        }
      }
    }
  }
}

// ── POST /api/sessions/admin/action ──────────────────────────────────────

sessionsRouter.post('/admin/action', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    const { action, date: dateStr } = req.body
    const today = dateStr ? new Date(dateStr) : new Date()

    if (action === 'assign') {
      await assignRooms(today)
      await assignPlayers(today)
    } else if (action === 'release') {
      await releaseAssignments(today)
    } else if (action === 'reset') {
      await resetRelease(today)
    } else if (action === 'karma') {
      await reassignKarma(today)
    } else if (action === 'reassign') {
      await reassignFromWaitingList(today)
    } else {
      res.status(400).json({ message: `Unknown action: ${action}` }); return
    }

    res.json({ message: `${action} executed successfully` })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/sessions/move-player ──────────────────────────────────────
// Admin: move a player's signup from one session to another

sessionsRouter.patch('/move-player', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    const { signUpId, toSessionId } = req.body
    if (!isValidObjectId(signUpId) || !isValidObjectId(toSessionId)) {
      res.status(400).json({ message: 'signUpId and toSessionId are required valid ObjectIds' }); return
    }

    const toSession = await Session.findById(toSessionId).lean()
    if (!toSession) { res.status(404).json({ message: 'Target session not found' }); return }

    await SignUp.findByIdAndUpdate(signUpId, { sessionId: toSessionId })
    res.json({ success: true })
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
      'rankCombat', 'rankExploration', 'rankRoleplaying', 'releaseAssignments',
      'requestedRoom', 'predecessorId', 'numSessions', 'sessionNumber']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }
    if ('releaseAssignments' in updates && viewer.role !== 'ADMIN') {
      delete updates.releaseAssignments
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
    // Clear predecessor references in other sessions that pointed at this one
    await Session.updateMany({ predecessorId: id }, { $unset: { predecessorId: '' } })
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

    const instantMode = await isInstantMode()

    if (instantMode) {
      // Instant mode: toggle direct assignment, no priority queue
      const existing = await SignUp.findOne({
        sessionId: id, userId: viewer._id, status: { $ne: 'cancelled' },
      }).lean<ISignUp & { _id: unknown }>()
      if (existing) {
        await SignUp.deleteOne({ _id: existing._id })
        res.json({ message: 'Signup removed', removed: true })
        return
      }
      const assignedCount = await SignUp.countDocuments({ sessionId: id, status: 'assigned' })
      if (assignedCount >= session.maxPlayers) {
        res.status(409).json({ message: 'Session is full' }); return
      }
      const signUp = await SignUp.create({
        sessionId: id, userId: viewer._id, status: 'assigned', priority: 0, appeared: false,
      })
      res.status(201).json({
        signUp: { id: String((signUp as any)._id), status: signUp.status, priority: signUp.priority },
        message: 'Signup registered',
        instant: true,
      })
      return
    }

    const priority: number = Number(req.body.priority)
    if (![1, 2, 3].includes(priority)) {
      res.status(400).json({ message: 'priority must be 1, 2, or 3' }); return
    }

    const sessionDate = new Date(session.date)
    const weekStart = getWeekStart(sessionDate)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Toggle: same session + same priority → remove
    const exactMatch = await SignUp.findOne({
      sessionId: id, userId: viewer._id, priority, status: { $ne: 'cancelled' },
    }).lean<ISignUp & { _id: unknown }>()
    if (exactMatch) {
      await SignUp.deleteOne({ _id: exactMatch._id })
      res.json({ message: 'Signup removed', removed: true })
      return
    }

    // Remove conflicting same-priority signup this week
    const sessionsThisWeek = await Session.find({ date: { $gte: weekStart, $lt: weekEnd } })
      .select('_id').lean<Array<{ _id: unknown }>>()
    const sessionIdsThisWeek = sessionsThisWeek.map((s) => s._id)
    await SignUp.deleteMany({
      sessionId: { $in: sessionIdsThisWeek },
      userId: viewer._id,
      priority,
      status: { $ne: 'cancelled' },
    })

    // Remove any existing signup for this same session, including cancelled ones.
    // Cancelled records still occupy the unique (sessionId, userId) index slot and
    // would cause E11000 if we tried to create a fresh signup without removing them first.
    await SignUp.deleteMany({ sessionId: id, userId: viewer._id })

    const signUp = await SignUp.create({
      sessionId: id, userId: viewer._id, status: 'pending', priority, appeared: false,
    })

    res.status(201).json({
      signUp: { id: String((signUp as any)._id), status: signUp.status, priority: signUp.priority },
      message: 'Signup registered',
    })
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

    // Admin can cancel on behalf of another user (for admin move/cancel operations)
    const targetUserId = req.query.userId && isValidObjectId(req.query.userId as string) && viewer.role === 'ADMIN'
      ? req.query.userId as string
      : String(viewer._id)

    const existing = await SignUp.findOne({ sessionId: id, userId: targetUserId, status: { $ne: 'cancelled' } })
      .lean<ISignUp & { _id: unknown }>()
    if (!existing) { res.status(404).json({ message: 'Sign-up not found' }); return }

    // Karma penalty when a player cancels an already-assigned slot
    const PUNISH_KARMA_CANCEL = 25
    if (existing.status === 'assigned' && String(viewer._id) === targetUserId) {
      await User.findByIdAndUpdate(viewer._id, { $inc: { karma: -PUNISH_KARMA_CANCEL } })
    }

    await SignUp.findByIdAndUpdate(existing._id, { status: 'cancelled' })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/sessions/:id/assign ─────────────────────────────────────────

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

// ── POST /api/sessions/:id/request-player ────────────────────────────────

sessionsRouter.post('/:id/request-player', async (req, res, next) => {
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

    const { userId } = req.body
    if (!isValidObjectId(userId)) { res.status(400).json({ message: 'Invalid userId' }); return }

    await Session.findByIdAndUpdate(id, { $addToSet: { requestedPlayerIds: userId } })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/sessions/:id/request-player/:userId ───────────────────────

sessionsRouter.delete('/:id/request-player/:userId', async (req, res, next) => {
  try {
    const { id, userId } = req.params
    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      res.status(400).json({ message: 'Invalid id' }); return
    }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }

    const session = await Session.findById(id).lean<ISession & { _id: unknown }>()
    if (!session) { res.status(404).json({ message: 'Session not found' }); return }
    if (String(session.dmId) !== String(viewer._id) && viewer.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden' }); return
    }

    await Session.findByIdAndUpdate(id, { $pull: { requestedPlayerIds: userId } })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
