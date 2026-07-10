# Push Notifications — End-to-End Plan

## What We're Building

Real-time push notifications for SplitMonk so members never miss an update.
Currently the only out-of-band channel is email (invites + settlement reminders via Apps Script).
Push gives instant, tappable, deep-linked alerts — even when the app is closed.

---

## Platform Reality Check

| Platform | Support | Condition |
|---|---|---|
| Chrome (desktop + Android) | ✅ Full | Works in browser and as PWA |
| Edge (desktop) | ✅ Full | Works in browser and as PWA |
| Firefox (desktop) | ✅ Full | Works in browser |
| Safari macOS 13+ | ✅ Full | Works in browser |
| Safari iOS 16.4+ | ✅ PWA only | Must be installed to home screen |
| Safari iOS < 16.4 | ❌ None | No support |
| Firefox Android | ✅ Full | Works in browser |

**Bottom line:** The PWA install prompt we already have directly unlocks push on iOS.
Users who install get push. Users who don't (older iOS) silently miss nothing — we gracefully skip them.

---

## Architecture

```
User action in app (add expense, record settlement, etc.)
  │
  ▼
Next.js API route already fires (create expense, etc.)
  │
  ├── existing Firestore write (unchanged)
  │
  └── NEW: enqueue Cloud Task → hits /api/notify endpoint
            │
            ▼
       /api/notify (Next.js API route)
            │
            ├── reads FCM tokens for target uids from Firestore
            ├── calls Firebase Admin SDK → FCM → sends push
            └── handles token cleanup (expired tokens removed)

Service Worker (sw.js) — already needed for PWA
  ├── receives push event → shows notification
  └── handles notificationclick → deep-links to correct URL
```

**Why Cloud Tasks instead of direct FCM call from the action API route?**
- The action API route (e.g. addExpense) must respond fast to the user. FCM calls are external HTTP — slow, can fail.
- Cloud Tasks decouples notification sending from the user action. If FCM is down, the task retries automatically.
- Delayed notifications (trip ending soon) are trivial with Cloud Tasks — just set `scheduleTime`.

**Why not Cloud Functions triggered by Firestore?**
- We'd need a Cloud Function per event type, deployed separately, with its own billing setup.
- Cloud Tasks + existing Next.js API routes means zero new deployment infrastructure.
- The `/api/notify` endpoint is just another Next.js route — same deploy, same env vars.

---

## Data Model

### 1. FCM tokens on user doc (`/users/{uid}`)

Add `fcmTokens: string[]` to the user doc. Each browser/device registers its own token.
A user can have multiple tokens (phone + laptop + work PC).

```typescript
// Addition to User interface in src/types/index.ts
interface User {
  // ... existing fields ...
  fcmTokens?: string[]  // FCM push tokens per device; managed client-side
}
```

**Token lifecycle:**
- Generated client-side when user grants permission
- Written to `/users/{uid}.fcmTokens` via `arrayUnion` (additive, no overwrites)
- Removed when FCM returns `messaging/registration-token-not-registered` (device uninstalled app / revoked permission)
- Max tokens per user: 20 (FCM limit) — rotate oldest if exceeded (rare for this app)

### 2. Notification log (`/users/{uid}/notifications/{notifId}`) — optional

For an in-app notification bell (future). Not in scope for this phase.
Mention here so the token collection schema doesn't conflict with it later.

---

## Notification Types & Triggers

### Type A — Expense added
**Trigger:** `POST /api/expenses` (or wherever addExpense is called server-side)
**Who gets it:** All group members EXCEPT the person who added it
**Payload:**
```
Title: "New expense in [Group Name]"
Body:  "[Adder first name] added [Expense title] · ₹X,XXX"
Data:  { url: "/groups/[groupId]", type: "expense_added", expenseId }
```

### Type B — Settlement recorded
**Trigger:** `recordSettlement` in firestore.ts
**Who gets it:** The person being paid (receiver) — not the payer (they already know)
**Payload:**
```
Title: "[Payer first name] paid you"
Body:  "₹X,XXX · [Group Name]"
Data:  { url: "/groups/[groupId]", type: "settlement_recorded" }
```

### Type C — Contribution recorded (pool)
**Trigger:** `addExpense` with `isContribution: true`
**Who gets it:** Each member whose uid appears in `payments` map
**Payload:**
```
Title: "Pool contribution recorded"
Body:  "[Organiser] recorded your ₹X,XXX contribution to [Group Name]"
Data:  { url: "/groups/[groupId]", type: "contribution_recorded" }
```

### Type D — Trip ending soon (delayed)
**Trigger:** When group is created or end date is set — schedule a Cloud Task for 24h before end date
**Who gets it:** All members
**Payload:**
```
Title: "[Group Name] ends tomorrow"
Body:  "Time to settle up — ₹X,XXX in unsettled balances"
Data:  { url: "/groups/[groupId]/balances", type: "trip_ending" }
```

### Type E — Added to group (existing user)
**Trigger:** Already handled by email via MemberList.tsx + GroupForm.tsx
**Who gets it:** The user being added
**Payload:**
```
Title: "You've been added to [Group Name]"
Body:  "[Adder] added you to this trip"
Data:  { url: "/groups/[groupId]", type: "group_added" }
```

---

## Notification Priority & Suppression Rules

Not every event needs a push. Rules to avoid spam:

1. **Never notify yourself** — the actor never gets a push for their own action
2. **Deduplicate rapid adds** — if same user adds 3 expenses in 60s, batch into one push (use Cloud Tasks delay of 30s + dedupe key)
3. **Respect quiet hours** — don't send between 11pm–7am IST (set `scheduleTime` on Cloud Task)
4. **Skip if app is in foreground** — the SW checks `clients.matchAll()` and suppresses the notification if the user already has the tab open; show an in-app toast instead (Sonner already handles this)
5. **Skip settled groups** — no pushes for archived/settled trips

---

## Implementation Phases

### Phase 1 — Infrastructure (no notifications yet, just plumbing)

**1a. FCM client setup**
- Add `firebase/messaging` to `src/lib/firebase.ts`
- Create `src/lib/notifications.ts`:
  - `requestPermission()` — asks user, returns token or null
  - `saveToken(uid, token)` — writes to `/users/{uid}.fcmTokens` via arrayUnion
  - `removeToken(uid, token)` — removes stale token

**1b. Service Worker (`public/sw.js`)**
- Currently doesn't exist — need to create it
- Handles: `push` event (show notification), `notificationclick` event (deep link)
- Must import Firebase SW compat scripts for FCM to work
- Registers via `navigator.serviceWorker.register('/sw.js')` in the app

**1c. Permission prompt**
- Add `NotificationPermissionPrompt` component
- Shown contextually: after user joins their first trip, not on first login
- Stores `notification_permission_asked` in localStorage so we only ask once
- On grant: calls `requestPermission()` → saves token to Firestore

**1d. Firebase Admin SDK**
- Install `firebase-admin` as a server-side dep
- Create `src/lib/firebase-admin.ts` — initializes Admin SDK with service account (env var)
- Used only in API routes (server-side), never in client bundle

**1e. Cloud Tasks setup**
- Enable Cloud Tasks API in GCP console
- Create a queue: `splitmonk-notifications` in region `asia-south1`
- Add `GOOGLE_CLOUD_PROJECT`, `CLOUD_TASKS_QUEUE`, `CLOUD_TASKS_LOCATION`, `NOTIFY_INTERNAL_SECRET` to env vars
- Create `src/lib/tasks.ts`:
  - `enqueueNotification(payload, delaySecs?)` — creates a Cloud Task that POSTs to `/api/notify`

**1f. `/api/notify` route**
- Validates `NOTIFY_INTERNAL_SECRET` header (so only Cloud Tasks can call it)
- Receives `{ type, groupId, actorUid, targetUids, data }`
- Fetches FCM tokens for all `targetUids` from Firestore
- Calls FCM `sendEachForMulticast` with notification payload
- Cleans up expired tokens (removes from user docs)

### Phase 2 — Wire up notification triggers

For each event type (A–E above), add one line after the Firestore write:
```typescript
enqueueNotification({ type: 'expense_added', groupId, actorUid, targetUids, data })
```

Locations:
- **Type A** (expense added): `src/lib/firestore.ts → addExpense()`
- **Type B** (settlement): `src/lib/firestore.ts → recordSettlement()`
- **Type C** (contribution): same `addExpense()`, guarded by `isContribution: true`
- **Type D** (trip ending): `src/lib/firestore.ts → createGroup()` and `updateGroup()` when endDate changes
- **Type E** (added to group): `src/components/groups/MemberList.tsx` and `GroupForm.tsx` — already calls `/api/invite`; add enqueue alongside

### Phase 3 — Permission UX

- `NotificationPermissionPrompt` wired into `(app)/layout.tsx` alongside `PWAInstallPrompt`
- Only shown if: user has been in the app > 30s AND has at least one group AND hasn't been asked before

---

## Files Touched

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `fcmTokens?: string[]` to `User` |
| `src/lib/firebase.ts` | Init FCM messaging (client-side) |
| `src/lib/firebase-admin.ts` | New — Admin SDK init for server-side |
| `src/lib/notifications.ts` | New — `requestPermission`, `saveToken`, `removeToken` |
| `src/lib/tasks.ts` | New — `enqueueNotification` Cloud Tasks helper |
| `src/lib/firestore.ts` | `addExpense`, `recordSettlement`, `createGroup`, `updateGroup` — each calls `enqueueNotification` |
| `src/app/api/notify/route.ts` | New — receives Cloud Task, sends FCM push, cleans tokens |
| `public/sw.js` | New — handles `push` + `notificationclick` events |
| `src/components/ui/NotificationPermissionPrompt.tsx` | New — contextual permission ask |
| `src/app/(app)/layout.tsx` | Mount `NotificationPermissionPrompt` |
| `src/components/groups/MemberList.tsx` | Enqueue Type E notification alongside existing invite email |
| `src/components/groups/GroupForm.tsx` | Enqueue Type E notification alongside existing invite email |
| `firestore.rules` | Allow users to write their own `fcmTokens` (already covered by `allow write: if uid == auth.uid`) |

**Files NOT touched:**
- `src/lib/calculations.ts` — no balance logic changes
- `src/lib/export.ts` — no CSV changes
- Any existing component other than layout + MemberList + GroupForm

---

## Firestore Rules — No Changes Needed

`/users/{uid}` already has `allow write: if request.auth.uid == uid` — covers writing FCM tokens to own doc.
`/api/notify` uses Firebase Admin SDK which bypasses Firestore rules entirely (runs with service account).

---

## Environment Variables

```bash
# Firebase Admin (server-side only — never NEXT_PUBLIC_)
FIREBASE_ADMIN_PROJECT_ID=splitmonk-007
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@splitmonk-007.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Cloud Tasks
GOOGLE_CLOUD_PROJECT=splitmonk-007
CLOUD_TASKS_QUEUE=splitmonk-notifications
CLOUD_TASKS_LOCATION=asia-south1

# Internal auth between Cloud Tasks and /api/notify
NOTIFY_INTERNAL_SECRET=<random-32-char-string>

# Where Cloud Tasks should POST to (must be publicly reachable)
NEXT_PUBLIC_APP_URL=https://splitmonk.in  # already exists
```

---

## Service Worker Design

```javascript
// public/sw.js

importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js')

firebase.initializeApp({ /* config from env — inlined at build time */ })
const messaging = firebase.messaging()

// Background push handler — fires when app is closed or tab not focused
messaging.onBackgroundMessage((payload) => {
  const { title, body, data } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,                          // carries { url } for click handler
    tag: data?.type ?? 'splitmonk', // dedupes: same tag replaces previous notification
  })
})

// Notification click — open/focus the app at the correct URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // If app already open in a tab, focus it and navigate
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url })
          return
        }
      }
      // Otherwise open a new tab
      clients.openWindow(url)
    })
  )
})
```

**Note:** FCM requires the SW to be at `/sw.js` (root scope). The existing PWA install prompt already assumes a SW will exist here. When we create it, the PWA install prompt continues to work unchanged.

---

## `/api/notify` Route Design

```typescript
// src/app/api/notify/route.ts

POST body: {
  secret:     string           // must match NOTIFY_INTERNAL_SECRET
  type:       NotificationType
  groupId:    string
  actorUid:   string           // who triggered the event (excluded from recipients)
  targetUids: string[]         // who should receive the push
  title:      string           // notification title (built by caller)
  body:       string           // notification body (built by caller)
  url:        string           // deep link path e.g. "/groups/abc123"
}
```

Steps:
1. Validate `secret` header — return 401 if wrong
2. Fetch FCM tokens: `targetUids.map(uid => getDoc(/users/uid))` → collect all `fcmTokens[]`
3. Call `messaging.sendEachForMulticast({ tokens, notification: { title, body }, data: { url } })`
4. For each failed token where error is `messaging/registration-token-not-registered`:
   - Remove that token from the user's `fcmTokens` array via `arrayRemove`
5. Return 200

---

## `src/lib/tasks.ts` Design

```typescript
export interface NotifyPayload {
  type:       string
  groupId:    string
  actorUid:   string
  targetUids: string[]
  title:      string
  body:       string
  url:        string
}

export async function enqueueNotification(payload: NotifyPayload, delaySecs = 5) {
  // Skip if no Cloud Tasks configured (local dev)
  if (!process.env.CLOUD_TASKS_QUEUE) return

  const { CloudTasksClient } = await import('@google-cloud/tasks')
  const client = new CloudTasksClient()
  const parent = client.queuePath(
    process.env.GOOGLE_CLOUD_PROJECT!,
    process.env.CLOUD_TASKS_LOCATION!,
    process.env.CLOUD_TASKS_QUEUE!,
  )

  const body = Buffer.from(JSON.stringify({
    secret: process.env.NOTIFY_INTERNAL_SECRET,
    ...payload,
  })).toString('base64')

  await client.createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/notify`,
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      scheduleTime: delaySecs > 0
        ? { seconds: Math.floor(Date.now() / 1000) + delaySecs }
        : undefined,
    },
  })
}
```

**Local dev:** `CLOUD_TASKS_QUEUE` is unset → `enqueueNotification` is a no-op. No mock needed.

---

## Dry Run — End-to-End Example

**Scenario:** Sahil (organiser) adds "Hotel — ₹12,000" to Mysore trip (7 members).

1. Sahil taps "+ Add", fills form, hits submit
2. `addExpense()` in `firestore.ts` writes the expense doc ✅
3. Immediately after write, `enqueueNotification()` is called:
   ```
   type: 'expense_added'
   groupId: 'OKdx63...'
   actorUid: 'sahil-uid'
   targetUids: ['akhil-uid', 'shubham-uid', 'rishabh-uid', 'purvi-uid', 'vinamra-uid', 'agastya-uid']
   title: 'New expense in Mysore July 2026'
   body: 'Sahil added Hotel · ₹12,000'
   url: '/groups/OKdx63...'
   ```
4. Cloud Task created — scheduled 5 seconds later (tiny delay to batch rapid adds)
5. 5s later: Cloud Task POSTs to `https://splitmonk.in/api/notify`
6. `/api/notify` fetches FCM tokens for all 6 target uids (2-3 Firestore reads, batched)
7. FCM `sendEachForMulticast` sends 6 pushes
8. Akhil's phone (installed PWA): SW receives push → shows notification: "New expense in Mysore July 2026 · Sahil added Hotel · ₹12,000"
9. Akhil taps notification → app opens at `/groups/OKdx63...`
10. Agastya is on desktop Chrome with tab open → SW suppresses notification, app shows Sonner toast instead

---

## Edge Cases

### 1. User hasn't granted permission
- `requestPermission()` returns null → no token stored → `/api/notify` finds empty `fcmTokens` → no push sent → silent skip
- No error, no retry

### 2. User has multiple devices
- All tokens stored in `fcmTokens[]` → `sendEachForMulticast` sends to all
- If same user has app open on one device, SW suppresses there; other devices still get the push

### 3. FCM token expires / user revokes permission
- FCM returns `messaging/registration-token-not-registered`
- `/api/notify` removes that token from Firestore via `arrayRemove`
- Next push attempt skips the dead token

### 4. Group has 0 members with FCM tokens
- `/api/notify` gets empty token list → `sendEachForMulticast` not called → 200 returned
- Cloud Task doesn't retry (200 = success)

### 5. Actor is also in targetUids
- `enqueueNotification` always filters `actorUid` out of `targetUids` before enqueuing
- Enforced in `tasks.ts`: `targetUids: uids.filter(uid => uid !== actorUid)`

### 6. Trip ending notification — end date changes
- When `updateGroup()` is called with a new `endDate`:
  - Cancel any existing trip-ending Cloud Task (not easily possible with Cloud Tasks)
  - Simpler: always enqueue new task; in `/api/notify`, check if group still has `endDate` matching the task's scheduled date before sending. If date changed, skip.

### 7. Contribution notification — multiple members in one record
- Type C sends one push per member in `payments` map
- `targetUids` = `Object.keys(payments)` filtered by `!== actorUid`
- Each gets personalised body: "Your ₹X,XXX contribution was recorded"

### 8. Pending invitees (no uid yet)
- Only uids can have FCM tokens → pending emails are skipped automatically
- They already get the email invite — no push needed until they join

### 9. Cloud Tasks quota
- Free tier: 1M operations/month
- At 10 members, 10 expenses/day = 100 pushes/day = 3,000/month → well within free tier

### 10. `/api/notify` is slow or times out
- Cloud Tasks default timeout: 10 minutes. Our route should respond in < 2s.
- If it fails (5xx), Cloud Tasks retries with exponential backoff (max 3 retries)
- Duplicate pushes possible on retry — mitigated by SW `tag` field which replaces previous notification with same tag

### 11. Safari iOS < 16.4 (no push support)
- `requestPermission()` fails gracefully — `Notification` API not available → returns null → no token stored → no push ever attempted
- No error surfaced to user

### 12. App is archived / settled
- `enqueueNotification` checks `group.status` before enqueuing in each call site
- If `status === 'archived'`, skip enqueue entirely

### 13. Service worker update
- New SW deployed → browser detects change on next visit → prompts user to refresh
- FCM tokens remain valid across SW updates (they're tied to the origin, not the SW version)

---

## What We Explicitly Don't Do

- No in-app notification bell / inbox (Phase 2 idea — needs `/users/{uid}/notifications` collection)
- No notification preferences per user (all or nothing for now)
- No unsubscribe link in push (not possible — user manages via browser settings)
- No Android-specific notification channels (FCM default channel is fine)
- No rich notifications with images (title + body is enough)
- No push for expense edits or soft-deletes (too noisy)
- No push for group settings changes (too noisy)

---

## Deployment Checklist

Before going live:

- [ ] Enable Cloud Tasks API in GCP console (project: splitmonk-007)
- [ ] Create queue `splitmonk-notifications` in `asia-south1`
- [ ] Create service account with roles: `Cloud Tasks Enqueuer` + `Firebase Admin`
- [ ] Download service account JSON → extract fields → add to Vercel env vars
- [ ] Add `NOTIFY_INTERNAL_SECRET`, `CLOUD_TASKS_QUEUE`, `CLOUD_TASKS_LOCATION`, `GOOGLE_CLOUD_PROJECT` to Vercel
- [ ] Add Cloud Tasks IP ranges to allowed callers (or rely on secret header — simpler)
- [ ] Deploy updated `public/sw.js` — verify FCM compat scripts load correctly
- [ ] Test on real device (Android Chrome + iOS 16.4+ PWA)
- [ ] Verify token cleanup works by revoking permission and triggering a push

---

## Implementation Sequence (exact order)

1. Add `fcmTokens?: string[]` to `User` type + update `docToUser` in `firestore.ts`
2. Create `src/lib/firebase-admin.ts`
3. Create `public/sw.js` (SW with FCM background handler + click handler)
4. Create `src/lib/notifications.ts` (client-side token management)
5. Create `src/app/api/notify/route.ts`
6. Create `src/lib/tasks.ts`
7. Create `src/components/ui/NotificationPermissionPrompt.tsx`
8. Wire `NotificationPermissionPrompt` into `(app)/layout.tsx`
9. Add `enqueueNotification` calls to `addExpense`, `recordSettlement`, `createGroup`, `updateGroup`
10. Add `enqueueNotification` calls to `MemberList` + `GroupForm` (Type E)
11. Deploy + test
