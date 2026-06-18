import { Router, Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/auth'
import { getUpcomingSessions, getUserAssignments } from '../services/adventureBoard'

export const adventureBoardRouter = Router()

// GET /api/adventure-board/sessions
// Returns upcoming adventures (today + 90 days).
// When AB user ID linkage is available, pass abUserId to filter to the user's sessions.
adventureBoardRouter.get(
  '/sessions',
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await getUpcomingSessions()
      res.json(sessions)
    } catch (err) {
      next(err)
    }
  },
)

// GET /api/adventure-board/assignments?abUserId=N
// Returns upcoming adventures where the given AB user is assigned.
// Returns [] when abUserId is not provided (linkage not yet stored).
adventureBoardRouter.get(
  '/assignments',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawId = req.query.abUserId
      if (!rawId) {
        res.json([])
        return
      }
      const abUserId = Number(rawId)
      if (!Number.isFinite(abUserId)) {
        res.status(400).json({ message: 'abUserId must be a number' })
        return
      }
      const assignments = await getUserAssignments(abUserId)
      res.json(assignments)
    } catch (err) {
      next(err)
    }
  },
)
