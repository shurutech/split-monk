import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin'

function getWebPush() {
  webpush.setVapidDetails(
    process.env.WEB_PUSH_CONTACT!,
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  )
  return webpush
}

interface NotifyRequest {
  secret?:    string
  idToken?:   string
  type:       string
  groupId:    string
  groupName:  string
  actorUid:   string
  targetUids: string[]
  title:      string
  body:       string
  url:        string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: NotifyRequest
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Accept either: internal secret (Cloud Tasks) or a valid Firebase ID token (client)
  const internalSecret = process.env.NOTIFY_INTERNAL_SECRET
  const validSecret    = internalSecret && payload.secret === internalSecret

  if (!validSecret) {
    if (!payload.idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const decoded = await getAuth(getAdminApp()).verifyIdToken(payload.idToken)
      if (decoded.uid !== payload.actorUid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
  }

  const { targetUids, title, body, url } = payload
  if (!targetUids?.length || !title || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const adminDb = getAdminDb()

  // Fetch push subscriptions for all target users in parallel
  const userDocs = await Promise.all(
    targetUids.map((uid) => adminDb.collection('users').doc(uid).get())
  )

  const notificationPayload = JSON.stringify({
    title,
    body,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   payload.type,
    data:  { url: `${process.env.NEXT_PUBLIC_APP_URL}${url}` },
  })

  const staleByUid: Record<string, string[]> = {}
  let sent = 0, failed = 0

  await Promise.all(
    userDocs.map(async (snap) => {
      if (!snap.exists) return
      const subs: string[] = snap.data()?.pushSubscriptions ?? []
      for (const raw of subs) {
        try {
          const sub = JSON.parse(raw) as webpush.PushSubscription
          await getWebPush().sendNotification(sub, notificationPayload)
          sent++
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode
          if (status === 404 || status === 410) {
            // Subscription expired — clean up
            staleByUid[snap.id] = [...(staleByUid[snap.id] ?? []), raw]
          }
          failed++
        }
      }
    })
  )

  // Remove stale subscriptions
  await Promise.all(
    Object.entries(staleByUid).map(([uid, stale]) =>
      adminDb.collection('users').doc(uid).update({
        pushSubscriptions: FieldValue.arrayRemove(...stale),
      })
    )
  )

  return NextResponse.json({ sent, failed, cleaned: Object.values(staleByUid).flat().length })
}
