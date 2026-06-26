import * as Y from 'yjs'
import { Server } from '@hocuspocus/server'
import { getAuth } from 'firebase-admin/auth'
import CollabState from '../models/CollabState'

const COLLAB_PORT = parseInt(process.env.COLLAB_PORT ?? '3001', 10)

export const collabServer = new Server({
  port: COLLAB_PORT,
  quiet: true,
  // Debounce saves — write to MongoDB 2s after last change, not on every keystroke
  debounce: 2000,

  async onAuthenticate({ token }) {
    try {
      const decoded = await getAuth().verifyIdToken(token as string)
      return { uid: decoded.uid, name: decoded.name ?? decoded.email ?? 'Gebruiker' }
    } catch {
      throw new Error('Unauthorized')
    }
  },

  async onLoadDocument({ document, documentName }) {
    const saved = await CollabState.findOne({ docId: documentName })
    if (saved?.state) {
      Y.applyUpdate(document, new Uint8Array(saved.state as unknown as ArrayBuffer))
    }
    // If no saved state, the document stays empty.
    // The first client to connect will initialize it from the REST content.
  },

  async onStoreDocument({ document, documentName }) {
    const state = Buffer.from(Y.encodeStateAsUpdate(document))
    await CollabState.findOneAndUpdate(
      { docId: documentName },
      { state, updatedAt: new Date() },
      { upsert: true, new: true },
    )
  },
})

export function startCollabServer() {
  // Catch EADDRINUSE (e.g. nodemon hot-reload while the old process still holds the port)
  // This must be set before listen() is called, since the error fires on the EventEmitter.
  collabServer.httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[collab] Port ${COLLAB_PORT} already in use — stop the old process and restart`,
      )
    } else {
      console.error('[collab] Server error:', err.message)
    }
  })

  collabServer
    .listen()
    .then(() => {
      console.log(`[collab] Hocuspocus running on port ${COLLAB_PORT}`)
    })
    .catch((err: Error) => {
      console.error('[collab] Failed to start:', err.message)
    })
}
