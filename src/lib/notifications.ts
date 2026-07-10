'use client'

import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw      = atob(base64)
  const arr      = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration> {
  const regs  = await navigator.serviceWorker.getRegistrations()
  const fmSw  = regs.find((r) => r.active?.scriptURL.includes('firebase-messaging-sw'))
  if (fmSw) return fmSw
  return navigator.serviceWorker.register('/firebase-messaging-sw.js')
}

async function getOrCreateSubscription(): Promise<PushSubscription> {
  const sw  = await getSwRegistration()
  const sub = await sw.pushManager.getSubscription()
  if (sub) return sub
  return sw.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
  })
}

// Request notification permission and subscribe to Web Push
export async function requestPermission(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window)) return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    return await getOrCreateSubscription()
  } catch (err) {
    console.warn('[notifications] requestPermission failed:', err)
    return null
  }
}

export async function saveSubscription(uid: string, sub: PushSubscription) {
  // Store the serialised PushSubscription object — endpoint + keys
  const serialised = JSON.stringify(sub.toJSON())
  await updateDoc(doc(db, 'users', uid), {
    pushSubscriptions: arrayUnion(serialised),
  })
}

export async function removeSubscription(uid: string) {
  try {
    const sw  = await getSwRegistration()
    const sub = await sw.pushManager.getSubscription()
    if (sub) {
      const serialised = JSON.stringify(sub.toJSON())
      await updateDoc(doc(db, 'users', uid), {
        pushSubscriptions: arrayRemove(serialised),
      })
      await sub.unsubscribe()
    }
  } catch { /* ignore */ }
}

// Call this on app load when permission is already granted — ensures subscription is saved
export async function ensureSubscription(uid: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    const sub = await getOrCreateSubscription()
    // Only save if not already stored for this uid
    const snap = await getDoc(doc(db, 'users', uid))
    const existing: string[] = snap.data()?.pushSubscriptions ?? []
    const serialised = JSON.stringify(sub.toJSON())
    if (!existing.includes(serialised)) {
      await saveSubscription(uid, sub)
    }
  } catch (err) {
    console.warn('[notifications] ensureSubscription failed:', err)
  }
}
