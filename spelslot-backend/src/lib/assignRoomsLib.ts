import { Session } from '../models/Session'
import { Room } from '../models/Room'
import { User } from '../models/User'
import { getUpcomingWeekLib } from './assignPlayersLib'

export async function assignRooms(today: Date = new Date()): Promise<void> {
  const [weekStart, weekEnd] = getUpcomingWeekLib(today)

  const sessions = await Session.find({
    date: { $gte: weekStart, $lte: weekEnd },
    status: { $nin: ['cancelled'] },
    isWaitingList: false,
  }).lean()

  if (!sessions.length) return

  const rooms = await Room.find({ isActive: true }).sort({ name: 1 }).lean()
  if (!rooms.length) return

  // Reset all assigned rooms for this week (fresh run)
  await Session.updateMany(
    { date: { $gte: weekStart, $lte: weekEnd }, isWaitingList: false },
    { assignedRoom: null },
  )

  // Load DM data for all sessions
  const dmIds = [...new Set(sessions.map(s => String(s.dmId)))]
  const dms = await User.find({ _id: { $in: dmIds } }).select('defaultRoom').lean()
  const dmMap = new Map(dms.map(u => [String(u._id), (u as any).defaultRoom as string | null]))

  const roomNames = new Set(rooms.map(r => r.name))
  const takenRooms = new Set<string>()
  const sessionUpdates = new Map<string, string>() // sessionId → roomName

  // Round A: DM preferred room (defaultRoom on User)
  // defaultRoom DMs always win conflicts — process them first
  for (const session of sessions) {
    const defaultRoom = dmMap.get(String(session.dmId))
    if (!defaultRoom || !roomNames.has(defaultRoom) || takenRooms.has(defaultRoom)) continue
    sessionUpdates.set(String(session._id), defaultRoom)
    takenRooms.add(defaultRoom)
  }

  // Round B: Requested room for remaining sessions
  for (const session of sessions) {
    if (sessionUpdates.has(String(session._id))) continue
    const req = session.requestedRoom
    if (!req || !roomNames.has(req) || takenRooms.has(req)) continue
    sessionUpdates.set(String(session._id), req)
    takenRooms.add(req)
  }

  // Round C: Any available room for remaining sessions
  const availableRooms = rooms.filter(r => !takenRooms.has(r.name))
  for (const session of sessions) {
    if (sessionUpdates.has(String(session._id))) continue
    if (!availableRooms.length) break
    const room = availableRooms.shift()!
    sessionUpdates.set(String(session._id), room.name)
    takenRooms.add(room.name)
  }

  // Apply all room assignments
  await Promise.all([...sessionUpdates.entries()].map(([sessionId, roomName]) =>
    Session.findByIdAndUpdate(sessionId, { assignedRoom: roomName })
  ))

  console.log(`Room assignment: ${sessionUpdates.size}/${sessions.length} sessions assigned`)
}
