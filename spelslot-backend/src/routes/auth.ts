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

authRouter.post('/sync', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid, email, name, picture } = (req as AuthRequest).user!

    const user = await User.findOneAndUpdate(
      { uid },
      {
        $set: { email, name, avatarUrl: picture || null },
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
