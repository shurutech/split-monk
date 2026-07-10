import { NextRequest, NextResponse } from 'next/server'
import { getAdminApp, getAdminMessaging, getAdminDb } from '@/lib/firebase-admin'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'

interface NotifyRequest {
  secret?:    string  // Cloud Tasks internal secret (server-to-server)
  idToken?:   string  // Firebase ID token (client-to-server)
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
    // Try Firebase ID token auth
    if (!payload.idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const decoded = await getAuth(getAdminApp()).verifyIdToken(payload.idToken)
      // Verify the actorUid matches the token — prevents spoofing
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

  // Fetch FCM tokens for all target users in parallel
  const userDocs = await Promise.all(
    targetUids.map((uid) => adminDb.collection('users').doc(uid).get())
  )

  // Collect all tokens with their owner uid for cleanup
  const tokenToUid: Record<string, string> = {}
  for (const snap of userDocs) {
    if (!snap.exists) continue
    const tokens: string[] = snap.data()?.fcmTokens ?? []
    for (const token of tokens) {
      tokenToUid[token] = snap.id
    }
  }

  const tokens = Object.keys(tokenToUid)
  if (tokens.length === 0) {
    return NextResponse.json({ sent: 0, reason: 'no_tokens' })
  }

  // Send multicast push
  const result = await getAdminMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        icon:  '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag:   payload.type, // replaces previous notification of same type
      },
      fcmOptions: { link: `${process.env.NEXT_PUBLIC_APP_URL}${url}` },
    },
  })

  // Clean up expired/invalid tokens
  const staleTokens: Record<string, string[]> = {} // uid → tokens to remove
  result.responses.forEach((resp, i) => {
    if (!resp.success) {
      const code = resp.error?.code
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token') {
        const token = tokens[i]
        const uid   = tokenToUid[token]
        if (uid) {
          staleTokens[uid] = [...(staleTokens[uid] ?? []), token]
        }
      }
    }
  })

  // Remove stale tokens from Firestore
  await Promise.all(
    Object.entries(staleTokens).map(([uid, stale]) =>
      adminDb.collection('users').doc(uid).update({
        fcmTokens: FieldValue.arrayRemove(...stale),
      })
    )
  )

  return NextResponse.json({
    sent:    result.successCount,
    failed:  result.failureCount,
    cleaned: Object.values(staleTokens).flat().length,
  })
}
