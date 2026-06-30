import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { Room } from '../models/Room'
import { User } from '../models/User'

export const roomsRouter = Router()

roomsRouter.use(requireAuth)

// GET / — all rooms, sorted by name (any authenticated user)
roomsRouter.get('/', async (req, res, next) => {
  try {
    const rooms = await Room.find().sort({ name: 1 }).lean()
    res.json({
      rooms: rooms.map(r => ({ id: r._id, name: r.name, isActive: r.isActive })),
    })
  } catch (err) {
    next(err)
  }
})

// POST / — admin only, create a room
roomsRouter.post('/', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest
    const user = await User.findOne({ uid: authReq.user!.uid }).lean()
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const { name } = req.body as { name?: string }
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const room = await Room.create({ name: name.trim(), isActive: true })
    res.status(201).json({ room: { id: room._id, name: room.name, isActive: room.isActive } })
  } catch (err) {
    next(err)
  }
})

// PATCH /:id — admin only, update a room
roomsRouter.patch('/:id', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest
    const user = await User.findOne({ uid: authReq.user!.uid }).lean()
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid room id' })
      return
    }

    const { name, isActive } = req.body as { name?: string; isActive?: boolean }
    const update: { name?: string; isActive?: boolean } = {}
    if (name !== undefined) update.name = name.trim()
    if (isActive !== undefined) update.isActive = isActive

    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    res.json({ room: { id: room._id, name: room.name, isActive: room.isActive } })
  } catch (err) {
    next(err)
  }
})

// DELETE /:id — admin only
roomsRouter.delete('/:id', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest
    const user = await User.findOne({ uid: authReq.user!.uid }).lean()
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid room id' })
      return
    }

    const room = await Room.findByIdAndDelete(req.params.id).lean()
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
