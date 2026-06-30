import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth } from '../middleware/auth'
import type { AuthRequest } from '../middleware/auth'
import { User } from '../models/User'
import type { IUser } from '../models/User'
import { InstantModeRange, matchesRange } from '../models/InstantModeRange'

export const instantModeRouter = Router()
instantModeRouter.use(requireAuth)

async function loadUser(uid: string) {
  return User.findOne({ uid }).lean<IUser & { _id: unknown }>()
}

function serializeRange(r: any) {
  return {
    id: String(r._id),
    label: r.label ?? null,
    startDate: r.startDate ?? null,
    endDate: r.endDate ?? null,
    isRecurring: r.isRecurring,
    recurrenceWeekday: r.recurrenceWeekday ?? null,
    recurrenceWeekOfMonth: r.recurrenceWeekOfMonth ?? null,
  }
}

// GET /api/instant-mode — list all ranges (admin only)
instantModeRouter.get('/', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    const ranges = await InstantModeRange.find().sort({ createdAt: -1 }).lean()
    res.json({ ranges: ranges.map(serializeRange) })
  } catch (err) { next(err) }
})

// GET /api/instant-mode/check — is the given date (default: now) in instant mode?
instantModeRouter.get('/check', async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date()
    const ranges = await InstantModeRange.find().lean()
    const isActive = ranges.some((r) => matchesRange(r, date))
    res.json({ isActive })
  } catch (err) { next(err) }
})

// POST /api/instant-mode — create range (admin only)
instantModeRouter.post('/', async (req, res, next) => {
  try {
    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    const { label, startDate, endDate, isRecurring, recurrenceWeekday, recurrenceWeekOfMonth } = req.body
    if (!isRecurring && !startDate) {
      res.status(400).json({ message: 'startDate is required for non-recurring ranges' }); return
    }

    const range = await InstantModeRange.create({
      label: label ?? null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isRecurring: Boolean(isRecurring),
      recurrenceWeekday: recurrenceWeekday ?? null,
      recurrenceWeekOfMonth: recurrenceWeekOfMonth ?? null,
    })
    res.status(201).json({ range: serializeRange(range.toObject()) })
  } catch (err) { next(err) }
})

// DELETE /api/instant-mode/:id — delete range (admin only)
instantModeRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) { res.status(400).json({ message: 'Invalid id' }); return }

    const uid = (req as AuthRequest).user!.uid
    const viewer = await loadUser(uid)
    if (!viewer) { res.status(401).json({ message: 'User not found' }); return }
    if (viewer.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }

    await InstantModeRange.findByIdAndDelete(id)
    res.json({ success: true })
  } catch (err) { next(err) }
})
