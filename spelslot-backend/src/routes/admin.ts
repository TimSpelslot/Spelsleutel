import { Router, Request, Response, NextFunction } from 'express'
import { HydratedDocument } from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { User, type IUser } from '../models/User'

export const adminRouter = Router()

// All admin endpoints require authentication + ADMIN role.
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest
  const mongoUser = await User.findOne({ uid: authReq.user!.uid }).lean()
  if (!mongoUser || mongoUser.role !== 'ADMIN') {
    res.status(403).json({ message: 'Admin access required' }); return
  }
  next()
}

adminRouter.use(requireAuth, requireAdmin)

function serializeUser(user: HydratedDocument<IUser>) {
  return {
    id: user._id.toString(),
    uid: user.uid,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    isWorldbuilder: user.isWorldbuilder,
    worldbuilderRequestPending: user.worldbuilderRequestPending,
    dndbeyondCharacterId: user.dndbeyondCharacterId ?? null,
    createdAt: user.createdAt,
  }
}

// ── GET /api/admin/users ─────────────────────────────────────────────────
adminRouter.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().sort({ displayName: 1 })
    res.json({ users: users.map(serializeUser) })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/admin/users/:id ───────────────────────────────────────────
// Updatable fields: role, isWorldbuilder, worldbuilderRequestPending, dndbeyondCharacterId
adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const allowed = ['role', 'isWorldbuilder', 'worldbuilderRequestPending', 'dndbeyondCharacterId'] as const
    type AllowedKey = (typeof allowed)[number]
    const updates: Partial<Record<AllowedKey, unknown>> = {}

    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No updatable fields provided' }); return
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true },
    )

    if (!user) { res.status(404).json({ message: 'User not found' }); return }

    res.json({ user: serializeUser(user) })
  } catch (err) {
    next(err)
  }
})
