import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getMessaging, isSupported } from 'firebase/messaging'
import type { Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)

// Messaging is not supported in all environments (Safari, SSR, etc.)
// Callers must use getFirebaseMessaging() rather than importing directly.
let _messaging: Messaging | null = null
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (_messaging) return _messaging
  try {
    if (!(await isSupported())) return null
    _messaging = getMessaging(firebaseApp)
    return _messaging
  } catch {
    return null
  }
}
