/**
 * Assignment algorithm — shared between the CLI script and the admin API action.
 * Port of the AdventureBoard Python 6-round algorithm.
 */

import mongoose from 'mongoose'
import { Session } from '../models/Session'
import { SignUp } from '../models/SignUp'
import { User } from '../models/User'
import type { ISession } from '../models/Session'
import type { ISignUp } from '../models/SignUp'
import type { IUser } from '../models/User'

// ── Week / month helpers ──────────────────────────────────────────────────

export function getUpcomingWeekLib(today: Date): [Date, Date] {
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

function getThisMonth(today: Date): [Date, Date] {
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
  return [start, end]
}

// ── Waiting list ──────────────────────────────────────────────────────────

async function getOrCreateWaitingList(weekStart: Date): Promise<ISession & { _id: mongoose.Types.ObjectId }> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  const existing = await Session.findOne({
    isWaitingList: true,
    date: { $gte: weekStart, $lt: weekEnd },
  }).lean<ISession & { _id: mongoose.Types.ObjectId }>()
  if (existing) return existing

  const created = await Session.create({
    title: 'Wachtlijst',
    shortDescription: 'Automatisch aangemaakt door het toewijzingsscript.',
    date: new Date(weekStart.getTime() + 5 * 24 * 60 * 60 * 1000),
    dmId: new mongoose.Types.ObjectId(),
    maxPlayers: 9999,
    status: 'open',
    isWaitingList: true,
    tags: [],
  })
  return created as unknown as ISession & { _id: mongoose.Types.ObjectId }
}

// ── Main assignment logic ─────────────────────────────────────────────────

export async function assignPlayers(today: Date = new Date()): Promise<void> {
  const [weekStart, weekEnd] = getUpcomingWeekLib(today)
  const [monthStart, monthEnd] = getThisMonth(today)

  console.log(`\n>--- Assigning players for week ${weekStart.toDateString()} → ${weekEnd.toDateString()} ---<\n`)

  const sessions = await Session.find({
    date: { $gte: weekStart, $lte: weekEnd },
    status: { $nin: ['cancelled'] },
  }).lean<Array<ISession & { _id: mongoose.Types.ObjectId }>>()

  if (!sessions.length) {
    console.log('No sessions found for this week.')
    return
  }

  const sessionMap = new Map(sessions.map((s) => [String(s._id), s]))
  const sessionIds = sessions.map((s) => s._id)

  const takenPlaces = new Map<string, number>()
  const alreadyAssigned = await SignUp.aggregate([
    { $match: { sessionId: { $in: sessionIds }, status: 'assigned' } },
    { $group: { _id: '$sessionId', count: { $sum: 1 } } },
  ])
  for (const { _id, count } of alreadyAssigned) {
    takenPlaces.set(String(_id), count)
  }

  const pendingSignups = await SignUp.find({
    sessionId: { $in: sessionIds },
    status: 'pending',
  }).lean<Array<ISignUp & { _id: mongoose.Types.ObjectId }>>()

  const userIds = [...new Set(pendingSignups.map((s) => String(s.userId)))]
  const users = await User.find({ _id: { $in: userIds } }).lean<Array<IUser & { _id: mongoose.Types.ObjectId }>>()
  const userMap = new Map(users.map((u) => [String(u._id), u]))

  const monthlyAgg = await SignUp.aggregate([
    {
      $match: {
        userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
        status: 'assigned',
        createdAt: { $gte: monthStart, $lte: monthEnd },
      },
    },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ])
  const monthlyMap = new Map(monthlyAgg.map((m) => [String(m._id), m.count as number]))

  const signupsByUser = new Map<string, Array<ISignUp & { _id: mongoose.Types.ObjectId }>>()
  for (const signup of pendingSignups) {
    const uid = String(signup.userId)
    if (!signupsByUser.has(uid)) signupsByUser.set(uid, [])
    signupsByUser.get(uid)!.push(signup)
  }

  const sortedPlayers = [...signupsByUser.keys()]
    .filter((uid) => userMap.has(uid))
    .map((uid) => {
      const user = userMap.get(uid)!
      const karma = (user as any).karma ?? 1000
      const monthly = monthlyMap.get(uid) ?? 0
      return { uid, user, karma, monthly, rand: Math.random() }
    })
    .sort((a, b) => b.karma - a.karma || b.monthly - a.monthly || b.rand - a.rand)

  const unassigned = new Set(sortedPlayers.map((p) => p.uid))
  const finalAssignments = new Map<string, { signUpId: string | null; sessionId: string; isWaitlist: boolean }>()

  function tryAssign(sessionId: string, uid: string, signUpId: string | null): boolean {
    const session = sessionMap.get(sessionId)
    if (!session) return false
    const taken = takenPlaces.get(sessionId) ?? 0
    if (!session.isWaitingList && taken >= session.maxPlayers) return false
    takenPlaces.set(sessionId, taken + 1)
    unassigned.delete(uid)
    finalAssignments.set(uid, { signUpId, sessionId, isWaitlist: session.isWaitingList })
    return true
  }

  const MAX_PRIORITY = 3

  // Round 0: DM-requested players
  let round0 = 0
  for (const session of sessions) {
    if (session.isWaitingList) continue
    const requestedIds = (session.requestedPlayerIds ?? []).map(String)
    for (const uid of [...unassigned]) {
      if (!requestedIds.includes(uid)) continue
      const signup = signupsByUser.get(uid)?.find((s) => String(s.sessionId) === String(session._id))
      if (!signup) continue
      if (tryAssign(String(session._id), uid, String(signup._id))) round0++
    }
  }
  console.log(`Round 0 (DM-requested): ${round0} assigned`)

  // Round 1: Continuation players
  let round1 = 0
  for (let prio = 1; prio <= MAX_PRIORITY; prio++) {
    for (const uid of [...unassigned]) {
      const playerSignups = signupsByUser.get(uid) ?? []
      for (const signup of playerSignups.filter((s) => s.priority === prio)) {
        const session = sessionMap.get(String(signup.sessionId))
        if (!session?.predecessorId) continue
        const wasAssigned = await SignUp.exists({
          sessionId: session.predecessorId,
          userId: new mongoose.Types.ObjectId(uid),
          status: 'assigned',
        })
        if (!wasAssigned) continue
        if (tryAssign(String(session._id), uid, String(signup._id))) { round1++; break }
      }
    }
  }
  console.log(`Round 1 (continuations): ${round1} assigned`)

  // Round 2: Story players on story adventures
  let round2 = 0
  for (let prio = 1; prio <= MAX_PRIORITY; prio++) {
    for (const uid of [...unassigned]) {
      if (!(userMap.get(uid) as any)?.storyPlayer) continue
      const playerSignups = signupsByUser.get(uid) ?? []
      for (const signup of playerSignups.filter((s) => s.priority === prio)) {
        const session = sessionMap.get(String(signup.sessionId))
        if (!session?.isStoryAdventure) continue
        if (tryAssign(String(session._id), uid, String(signup._id))) { round2++; break }
      }
    }
  }
  console.log(`Round 2 (story players): ${round2} assigned`)

  // Round 3: All players to first available signed-up choice
  let round3 = 0
  for (let prio = 1; prio <= MAX_PRIORITY; prio++) {
    for (const uid of [...unassigned]) {
      const playerSignups = signupsByUser.get(uid) ?? []
      for (const signup of playerSignups.filter((s) => s.priority === prio)) {
        if (tryAssign(String(signup.sessionId), uid, String(signup._id))) { round3++; break }
      }
    }
  }
  console.log(`Round 3 (normal signups): ${round3} assigned`)

  // Round 4: Any available session
  let round4 = 0
  const shuffledSessions = sessions.filter((s) => !s.isWaitingList).sort(() => Math.random() - 0.5)
  for (const uid of [...unassigned]) {
    for (const session of shuffledSessions) {
      if (tryAssign(String(session._id), uid, null)) { round4++; break }
    }
  }
  console.log(`Round 4 (any slot): ${round4} assigned`)

  // Round 5: Waiting list
  const waitingList = await getOrCreateWaitingList(weekStart)
  let round5 = 0
  for (const uid of [...unassigned]) {
    finalAssignments.set(uid, { signUpId: null, sessionId: String(waitingList._id), isWaitlist: true })
    unassigned.delete(uid)
    round5++
  }
  console.log(`Round 5 (waitlist): ${round5} assigned`)

  // Apply assignments
  const ops: Promise<unknown>[] = []
  for (const [uid, { signUpId, sessionId, isWaitlist }] of finalAssignments.entries()) {
    const newStatus = isWaitlist ? 'waitlist' : 'assigned'
    if (signUpId) {
      ops.push(SignUp.findByIdAndUpdate(signUpId, { status: newStatus }))
    } else {
      ops.push(
        SignUp.findOneAndUpdate(
          { sessionId: new mongoose.Types.ObjectId(sessionId), userId: new mongoose.Types.ObjectId(uid) },
          { $setOnInsert: { sessionId: new mongoose.Types.ObjectId(sessionId), userId: new mongoose.Types.ObjectId(uid), priority: 4, appeared: false }, status: newStatus },
          { upsert: true },
        ),
      )
    }
  }
  await Promise.all(ops)

  const total = round0 + round1 + round2 + round3 + round4 + round5
  console.log(`\nDone. ${total} players processed.`)
}
