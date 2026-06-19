import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health'
import { authRouter } from './routes/auth'
import { adventureBoardRouter } from './routes/adventureBoard'
import { codexRouter } from './routes/codex'
import { errorHandler } from './middleware/errorHandler'

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/adventure-board', adventureBoardRouter)
app.use('/api/codex', codexRouter)

app.use(errorHandler)

export default app
