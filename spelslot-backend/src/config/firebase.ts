import { initializeApp, cert, getApps } from 'firebase-admin/app'

export function initFirebase() {
  if (getApps().length > 0) return

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not defined')

  initializeApp({ credential: cert(JSON.parse(json)) })
  console.log('[firebase] Admin SDK initialized')
}
