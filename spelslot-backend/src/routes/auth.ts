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
    worldBuilderName: user.worldBuilderName ?? null,
    dndBeyondName: user.dndBeyondName ?? null,
    dndBeyondCampaign: user.dndBeyondCampaign ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    isStoryDm: user.isStoryDm,
    isWorldbuilder: user.isWorldbuilder,
    worldbuilderRequestPending: user.worldbuilderRequestPending,
    dndbeyondCharacterId: user.dndbeyondCharacterId ?? null,
    karma: user.karma ?? 1000,
    notifySignup: user.notifySignup,
    notifyAssignment: user.notifyAssignment,
    notifyMarketplace: user.notifyMarketplace,
    notifySession: user.notifySession,
    notifyCreateAdventureReminder: user.notifyCreateAdventureReminder ?? false,
  }
}

async function assignCampaign(): Promise<number> {
  const MAX_PER_CAMPAIGN = 6
  const NUM_CAMPAIGNS = 5
  for (let campaign = 1; campaign <= NUM_CAMPAIGNS; campaign++) {
    const count = await User.countDocuments({ dndBeyondCampaign: campaign })
    if (count < MAX_PER_CAMPAIGN) return campaign
  }
  return NUM_CAMPAIGNS + 1
}

// PATCH /api/auth/me — update editable profile fields
authRouter.patch('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = (req as AuthRequest).user!
    const { displayName, worldBuilderName, dndBeyondName } = req.body as {
      displayName?: string
      worldBuilderName?: string
      dndBeyondName?: string
    }
    const updates: Partial<IUser> = {}
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || !displayName.trim()) {
        res.status(400).json({ message: 'displayName must be a non-empty string' })
        return
      }
      updates.displayName = displayName.trim()
    }
    if (worldBuilderName !== undefined) updates.worldBuilderName = worldBuilderName?.trim() || null
    if (dndBeyondName !== undefined) updates.dndBeyondName = dndBeyondName?.trim() || null

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No updatable fields provided' })
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
        'notifyCreateAdventureReminder',
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
      if (user.isWorldbuilder) {
        res.status(400).json({ message: 'Already a worldbuilder' })
        return
      }
      if (user.worldbuilderRequestPending) {
        res.status(400).json({ message: 'Request already pending' })
        return
      }
      const { reason } = req.body as { reason?: string }
      user.worldbuilderRequestPending = true
      if (reason && typeof reason === 'string') user.worldbuilderRequestReason = reason.trim()
      await user.save()
      res.json(buildUserPayload(user))
    } catch (err) {
      next(err)
    }
  },
)

// PATCH /api/auth/me/flags — dev toggle: any user can flip isStoryDm / isWorldbuilder (remove before go-live)
authRouter.patch('/me/flags', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = (req as AuthRequest).user!
    const { isStoryDm, isWorldbuilder } = req.body as { isStoryDm?: boolean; isWorldbuilder?: boolean }
    const updates: Partial<IUser> = {}
    if (typeof isStoryDm === 'boolean') updates.isStoryDm = isStoryDm
    if (typeof isWorldbuilder === 'boolean') updates.isWorldbuilder = isWorldbuilder
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No flag fields provided' })
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
})

// PATCH /api/auth/me/role — dev toggle: any user can switch their own role (remove before go-live)
authRouter.patch('/me/role', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = (req as AuthRequest).user!
    const { role } = req.body as { role?: string }
    if (role !== 'ADMIN' && role !== 'PLAYER') {
      res.status(400).json({ message: 'role must be ADMIN or PLAYER' })
      return
    }
    const user = await User.findOneAndUpdate({ uid }, { $set: { role } }, { new: true })
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    res.json(buildUserPayload(user))
  } catch (err) {
    next(err)
  }
})

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
      ...(devAdmin ? { role: 'ADMIN', isStoryDm: true, isWorldbuilder: true } : {}),
    }

    // Auto-assign campaign on first create
    const existingUser = await User.findOne({ uid }).select('dndBeyondCampaign').lean()
    if (!existingUser) {
      setFields.dndBeyondCampaign = await assignCampaign()
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
