import path from 'path'
import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health'
import { authRouter } from './routes/auth'
import { adventureBoardRouter } from './routes/adventureBoard'
import { codexRouter } from './routes/codex'
import { codexSessionsRouter } from './routes/codexSessions'
import { adminRouter } from './routes/admin'
import { notificationsRouter } from './routes/notifications'
import { marketplaceRouter } from './routes/marketplace'
import { sessionNotesRouter } from './routes/sessionNotes'
import { uploadRouter } from './routes/upload'
import { ddbRouter } from './routes/ddb'
import { calendarsRouter } from './routes/calendars'
import { monstersRouter } from './routes/monsters'
import { sessionsRouter } from './routes/sessions'
import { roomsRouter } from './routes/rooms'
import { instantModeRouter } from './routes/instantMode'
import { errorHandler } from './middleware/errorHandler'

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/adventure-board', adventureBoardRouter)
app.use('/api/codex', codexRouter)
app.use('/api/codex/sessions', codexSessionsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/marketplace', marketplaceRouter)
app.use('/api/session-notes', sessionNotesRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/ddb', ddbRouter)
app.use('/api/calendars', calendarsRouter)
app.use('/api/monsters', monstersRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/rooms', roomsRouter)
app.use('/api/instant-mode', instantModeRouter)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use(errorHandler)

export default app
