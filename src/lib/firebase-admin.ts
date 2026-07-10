import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      // Vercel stores the private key with literal \n — convert back to newlines
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
}

export const adminApp       = getAdminApp()
export const adminMessaging = getMessaging(adminApp)
export const adminDb        = getFirestore(adminApp)
