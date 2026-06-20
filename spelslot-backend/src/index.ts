import 'dotenv/config'
import { initFirebase } from './config/firebase'
import { connectDB } from './config/db'
import { startCollabServer } from './collab/hocuspocus'
import app from './app'

const PORT = process.env.PORT ?? 3000

async function start() {
  initFirebase()
  await connectDB()
  app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`)
  })
  startCollabServer()
}

start()
