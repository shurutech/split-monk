import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'

// Lazy-initialised so Next.js build-time static analysis doesn't execute this
// before env vars are available. Call getAdminApp() only inside request handlers.
export function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      // Stored as base64 on Vercel to avoid newline mangling
      privateKey:  Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY_B64 ?? '', 'base64').toString('utf8'),
    }),
  })
}

export function getAdminMessaging() { return getMessaging(getAdminApp()) }
export function getAdminDb()        { return getFirestore(getAdminApp()) }
