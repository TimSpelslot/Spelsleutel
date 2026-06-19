import { Request, Response, NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'

export interface AuthRequest extends Request {
  user?: {
    uid: string
    email: string
    name: string
    picture: string
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = await getAuth().verifyIdToken(header.slice(7))
      ;(req as AuthRequest).user = {
        uid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? '',
        picture: decoded.picture ?? '',
      }
    } catch { /* no-op — unauthenticated request continues */ }
  }
  next()
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const token = header.slice(7)
  try {
    const decoded = await getAuth().verifyIdToken(token)
    const authReq = req as AuthRequest
    authReq.user = {
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: decoded.name ?? '',
      picture: decoded.picture ?? '',
    }
    next()
  } catch {
    res.status(401).json({ message: 'Unauthorized' })
  }
}
