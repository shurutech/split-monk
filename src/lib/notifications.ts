'use client'

import { getMessaging, getToken, deleteToken } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import app, { db } from '@/lib/firebase'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!
const SW_PATH   = '/firebase-messaging-sw.js'

async function getSwRegistration(): Promise<ServiceWorkerRegistration> {
  // Prefer the firebase-messaging-sw.js registration; fall back to whatever is ready
  const regs = await navigator.serviceWorker.getRegistrations()
  const fmSw = regs.find((r) => r.active?.scriptURL.includes('firebase-messaging-sw'))
  if (fmSw) return fmSw
  return navigator.serviceWorker.register(SW_PATH)
}

async function getFcmToken(): Promise<string | null> {
  const sw  = await getSwRegistration()
  const msg = getMessaging(app)
  try {
    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw })
    return token ?? null
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'messaging/token-subscribe-failed' || code === 'messaging/token-unsubscribe-failed') {
      // Clear stale push subscription and retry once
      try { await deleteToken(msg) } catch { /* ignore */ }
      const sub = await sw.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw })
      return token ?? null
    }
    throw err
  }
}

// Request notification permission and return the FCM token, or null if denied/unsupported
export async function requestPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window)) return null
  if (!('serviceWorker' in navigator)) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    return await getFcmToken()
  } catch (err) {
    console.warn('[notifications] requestPermission failed:', err)
    return null
  }
}

// Call this on app load when permission is already granted — ensures the token is saved
export async function ensureToken(uid: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (!('serviceWorker' in navigator)) return
  if (Notification.permission !== 'granted') return

  try {
    const token = await getFcmToken()
    if (token) await saveToken(uid, token)
  } catch (err) {
    console.warn('[notifications] ensureToken failed:', err)
  }
}

export async function saveToken(uid: string, token: string) {
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) })
}

export async function removeToken(uid: string, token: string) {
  try {
    const msg = getMessaging(app)
    await deleteToken(msg)
  } catch { /* ignore */ }
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) })
}
