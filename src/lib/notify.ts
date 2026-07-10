'use client'

import { getAuth } from 'firebase/auth'
import app from '@/lib/firebase'

export interface NotifyPayload {
  type:       string
  groupId:    string
  groupName:  string
  actorUid:   string
  targetUids: string[]
  title:      string
  body:       string
  url:        string
}

// Fire-and-forget push notification from client.
// Gets a fresh ID token and POSTs to /api/notify — never throws.
export async function notifyGroup(payload: NotifyPayload): Promise<void> {
  if (payload.targetUids.length === 0) return
  try {
    const user    = getAuth(app).currentUser
    if (!user) return
    const idToken = await user.getIdToken()

    fetch('/api/notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken, ...payload }),
    }).catch(() => {})
  } catch {
    // Never surface notification errors to the user
  }
}
