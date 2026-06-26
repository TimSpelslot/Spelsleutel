import { Router, Request, Response, NextFunction } from 'express'
import { HydratedDocument } from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { User, type IUser } from '../models/User'

export const authRouter = Router()

function buildUserPayload(user: HydratedDocument<IUser>) {
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
    notifySignup: user.notifySignup,
    notifyAssignment: user.notifyAssignment,
    notifyMarketplace: user.notifyMarketplace,
    notifySession: user.notifySession,
  }
}

// PATCH /api/auth/me — update editable profile fields (displayName)
authRouter.patch('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = (req as AuthRequest).user!
    const { displayName } = req.body as { displayName?: string }
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      res.status(400).json({ message: 'displayName is required' })
      return
    }
    const user = await User.findOneAndUpdate(
      { uid },
      { $set: { displayName: displayName.trim() } },
      { new: true },
    )
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    res.json(buildUserPayload(user))
  } catch (err) {
    next(err)
  }
})

// PATCH /api/auth/me/preferences — update notification preferences
authRouter.patch(
  '/me/preferences',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { uid } = (req as AuthRequest).user!
      const allowed = [
        'notifySignup',
        'notifyAssignment',
        'notifyMarketplace',
        'notifySession',
      ] as const
      const updates: Partial<Record<(typeof allowed)[number], boolean>> = {}
      for (const key of allowed) {
        if (typeof req.body[key] === 'boolean') updates[key] = req.body[key]
      }
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: 'No preference fields provided' })
        return
      }
      const user = await User.findOneAndUpdate({ uid }, { $set: updates }, { new: true })
      if (!user) {
        res.status(404).json({ message: 'User not found' })
        return
      }
      res.json(buildUserPayload(user))
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/auth/me/request-worldbuilder — player requests worldbuilder flag
authRouter.post(
  '/me/request-worldbuilder',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { uid } = (req as AuthRequest).user!
      const user = await User.findOne({ uid })
      if (!user) {
        res.status(404).json({ message: 'User not found' })
        return
      }
      if (user.role !== 'PLAYER') {
        res.status(403).json({ message: 'Only players can request worldbuilder access' })
        return
      }
      if (user.isWorldbuilder) {
        res.status(400).json({ message: 'Already a worldbuilder' })
        return
      }
      if (user.worldbuilderRequestPending) {
        res.status(400).json({ message: 'Request already pending' })
        return
      }
      user.worldbuilderRequestPending = true
      await user.save()
      res.json(buildUserPayload(user))
    } catch (err) {
      next(err)
    }
  },
)

authRouter.post('/sync', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid, email, name, picture } = (req as AuthRequest).user!

    // In dev mode (SPELSLOT_DEV_ADMIN=true) every user is upgraded to ADMIN
    // so the team can test the full UI without manual role assignment.
    const devAdmin = process.env.SPELSLOT_DEV_ADMIN === 'true'
    const setFields: Record<string, unknown> = {
      email,
      name,
      avatarUrl: picture || null,
      ...(devAdmin ? { role: 'ADMIN', isWorldbuilder: true } : {}),
    }

    const user = await User.findOneAndUpdate(
      { uid },
      {
        $set: setFields,
        $setOnInsert: { displayName: name },
      },
      { upsert: true, new: true },
    )

    if (!user) throw new Error('User upsert returned null unexpectedly')
    res.json(buildUserPayload(user))
  } catch (err) {
    next(err)
  }
})
