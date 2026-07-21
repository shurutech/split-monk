import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteField,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  User,
  Group,
  Invite,
  Expense,
  Settlement,
  CreateGroupInput,
  AddExpenseInput,
  CreateSettlementInput,
} from '@/types'
import { calculateBalances, getOptimalSettlements, formatINR } from './calculations'

// Firestore doc IDs cannot contain '/' but can contain ','.
// We encode email dots as commas so "sahil@shurutech.com" → "sahil@shurutech,com".
function encodeEmail(email: string) { return email.replace(/\./g, ',') }
function decodeEmail(key: string)   { return key.replace(/,/g, '.')   }

// ─── Converters ──────────────────────────────────────────────────────────────

function tsToDate(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate()
  if (ts instanceof Date)      return ts
  return new Date()
}

function docToUser(id: string, data: Record<string, unknown>): User {
  return {
    uid:          id,
    email:        data.email as string,
    displayName:  data.displayName as string,
    photoURL:     data.photoURL as string,
    upiId:        data.upiId as string | undefined,
    createdAt:    tsToDate(data.createdAt),
    lastActiveAt: tsToDate(data.lastActiveAt),
  }
}

function docToGroup(id: string, data: Record<string, unknown>): Group {
  return {
    id,
    name:               data.name as string,
    description:        data.description as string | undefined,
    createdBy:          data.createdBy as string,
    members:            data.members as string[],
    pendingInvites:     (data.pendingInvites as string[] | undefined) ?? [],
    startDate:          data.startDate ? tsToDate(data.startDate) : undefined,
    endDate:            data.endDate   ? tsToDate(data.endDate)   : undefined,
    status:             data.status as Group['status'],
    totalSpend:         data.totalSpend as number,
    createdAt:          tsToDate(data.createdAt),
    coverColor:         data.coverColor as string,
    contributionAmount: data.contributionAmount as number | undefined,
  }
}

function docToExpense(id: string, data: Record<string, unknown>): Expense {
  return {
    id,
    title:          data.title as string,
    amount:         data.amount as number,
    paidBy:         data.paidBy as string,
    payments:       data.payments as Record<string, number> | undefined,
    splitType:      data.splitType as Expense['splitType'],
    splits:         data.splits as Record<string, number>,
    date:           tsToDate(data.date),
    notes:          data.notes as string | undefined,
    category:       data.category as Expense['category'],
    createdBy:      data.createdBy as string,
    createdAt:      tsToDate(data.createdAt),
    updatedAt:      tsToDate(data.updatedAt),
    isDeleted:      data.isDeleted as boolean,
    isContribution: (data.isContribution as boolean | undefined) ?? false,
  }
}

function docToSettlement(id: string, data: Record<string, unknown>): Settlement {
  return {
    id,
    from:      data.from as string,
    to:        data.to as string,
    amount:    data.amount as number,
    settledAt: tsToDate(data.settledAt),
    settledBy: data.settledBy as string,
    note:      data.note as string | undefined,
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => docToUser(d.id, d.data() as Record<string, unknown>))
}

export async function getUserById(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return docToUser(snap.id, snap.data() as Record<string, unknown>)
}

export async function updateUserUPI(uid: string, upiId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { upiId: upiId.trim() || deleteField() })
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const q    = query(collection(db, 'users'), where('email', '==', email))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return docToUser(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>)
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function createGroup(data: CreateGroupInput & { createdBy: string }): Promise<string> {
  const groupRef = doc(collection(db, 'groups'))
  const batch    = writeBatch(db)

  batch.set(groupRef, {
    name:           data.name,
    description:    data.description ?? '',
    createdBy:      data.createdBy,
    members:        data.members,
    pendingInvites: data.pendingInvites,
    startDate:      data.startDate ?? null,
    endDate:        data.endDate   ?? null,
    status:         'active',
    totalSpend:     0,
    createdAt:      serverTimestamp(),
    coverColor:     data.coverColor,
  })

  // Upsert an invite doc for each pending email so sign-in can resolve them
  for (const email of data.pendingInvites) {
    const inviteRef = doc(db, 'invites', encodeEmail(email))
    batch.set(inviteRef, { email, groupIds: arrayUnion(groupRef.id) }, { merge: true })
  }

  await batch.commit()
  return groupRef.id
}

// Called on every sign-in. Two phases:
// 1. Transaction: move email from pendingInvites → members on all groups, delete invite doc.
// 2. Batch rewrite: for every expense in those groups that has the email as a split key,
//    rename that key to the real uid so balances resolve correctly.
export async function resolvePendingInvites(uid: string, email: string): Promise<void> {
  const inviteRef  = doc(db, 'invites', encodeEmail(email))
  const inviteSnap = await getDoc(inviteRef)

  // Collect group IDs to scan for stale email split keys (Phase 2)
  let groupIdsToScan: string[] = []

  if (inviteSnap.exists()) {
    const invite = inviteSnap.data() as Invite

    if (!invite.groupIds?.length) {
      await runTransaction(db, async (tx) => { tx.delete(inviteRef) })
    } else {
      groupIdsToScan = invite.groupIds

      // Phase 1: membership transaction — move email → uid in group docs, delete invite
      await runTransaction(db, async (tx) => {
        const freshInvite = await tx.get(inviteRef)
        if (!freshInvite.exists()) return

        const groupIds = (freshInvite.data() as Invite).groupIds ?? []

        for (const groupId of groupIds) {
          const groupRef  = doc(db, 'groups', groupId)
          const groupSnap = await tx.get(groupRef)
          if (!groupSnap.exists()) continue

          const groupData = groupSnap.data() as Record<string, unknown>
          const members   = (groupData.members       as string[]) ?? []
          const pending   = (groupData.pendingInvites as string[]) ?? []

          if (!pending.includes(email)) continue

          tx.update(groupRef, {
            members:        [...members, uid],
            pendingInvites: pending.filter((e) => e !== email),
          })
        }

        tx.delete(inviteRef)
      })
    }
  }

  // Phase 2: scan ALL groups this user is a member of for stale email split keys.
  // This covers: (a) groups from the invite doc, and (b) groups where the user was
  // added to a split by email without a formal invite (orphan key scenario).
  const memberGroupsSnap = await getDocs(
    query(collection(db, 'groups'), where('members', 'array-contains', uid))
  )
  const allGroupIds = [...new Set([
    ...groupIdsToScan,
    ...memberGroupsSnap.docs.map((d) => d.id),
  ])]

  for (const groupId of allGroupIds) {
    const expSnap = await getDocs(
      collection(db, `groups/${groupId}/expenses`)
    )

    const toRewrite = expSnap.docs.filter((d) => {
      const splits = (d.data() as Record<string, unknown>).splits as Record<string, number> | undefined
      return splits && email in splits
    })

    if (toRewrite.length === 0) continue

    // Chunk into batches of 499 (leave 1 slot headroom)
    for (let i = 0; i < toRewrite.length; i += 499) {
      const chunk = toRewrite.slice(i, i + 499)
      const batch = writeBatch(db)

      for (const expDoc of chunk) {
        const data   = expDoc.data() as Record<string, unknown>
        const splits = { ...(data.splits as Record<string, number>) }

        // Move email key to uid key, preserving the paise value
        splits[uid] = (splits[uid] ?? 0) + splits[email]
        delete splits[email]

        batch.update(expDoc.ref, { splits, updatedAt: serverTimestamp() })
      }

      await batch.commit()
    }
  }
}

export async function removePendingInvite(groupId: string, email: string): Promise<void> {
  const groupRef   = doc(db, 'groups', groupId)
  const inviteRef  = doc(db, 'invites', encodeEmail(email))
  const inviteSnap = await getDoc(inviteRef)

  const batch = writeBatch(db)
  batch.update(groupRef, { pendingInvites: arrayRemove(email) })
  if (inviteSnap.exists()) {
    const invite    = inviteSnap.data() as Invite
    const remaining = (invite.groupIds ?? []).filter((id) => id !== groupId)
    if (remaining.length === 0) {
      batch.delete(inviteRef)
    } else {
      batch.update(inviteRef, { groupIds: remaining })
    }
  }
  await batch.commit()
}

export async function updateGroup(
  groupId: string,
  data: Partial<Omit<Group, 'startDate' | 'endDate'>> & { startDate?: Date | null; endDate?: Date | null },
): Promise<void> {
  const payload: Record<string, unknown> = { ...data }
  // null/undefined means clear the field — use Firestore's deleteField() sentinel
  if (data.startDate          === null)      payload.startDate          = deleteField()
  if (data.endDate            === null)      payload.endDate            = deleteField()
  if (data.contributionAmount === undefined) payload.contributionAmount = deleteField()
  await updateDoc(doc(db, 'groups', groupId), payload)
}

export async function archiveGroup(groupId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { status: 'archived' })
}

export async function closeGroup(groupId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { status: 'closed' })
}

export async function reopenGroup(groupId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { status: 'active' })
}

// Hard delete — cleans up subcollections and invite docs.
// Firestore does not cascade-delete subcollections automatically.
export async function deleteGroup(groupId: string): Promise<void> {
  const groupRef = doc(db, 'groups', groupId)
  const groupSnap = await getDoc(groupRef)
  if (!groupSnap.exists()) return

  const groupData    = groupSnap.data() as Record<string, unknown>
  const pendingInvites = (groupData.pendingInvites as string[]) ?? []

  // Fetch all subcollection docs to delete
  const [expSnap, settlSnap] = await Promise.all([
    getDocs(collection(db, `groups/${groupId}/expenses`)),
    getDocs(collection(db, `groups/${groupId}/settlements`)),
  ])

  // Batch delete in chunks of 499
  const allDocs = [
    ...expSnap.docs,
    ...settlSnap.docs,
  ]

  // Add invite doc cleanup for each pending email
  const inviteRefs = await Promise.all(
    pendingInvites.map(async (email) => {
      const inviteRef  = doc(db, 'invites', encodeEmail(email))
      const inviteSnap = await getDoc(inviteRef)
      if (!inviteSnap.exists()) return null
      const invite    = inviteSnap.data() as Invite
      const remaining = (invite.groupIds ?? []).filter((id) => id !== groupId)
      return { ref: inviteRef, remaining }
    })
  )

  // Execute in batches of 499
  const chunks: (() => Promise<void>)[] = []

  for (let i = 0; i < allDocs.length; i += 499) {
    const chunk = allDocs.slice(i, i + 499)
    chunks.push(async () => {
      const batch = writeBatch(db)
      chunk.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    })
  }

  // Final batch: invite cleanup + group doc itself
  chunks.push(async () => {
    const batch = writeBatch(db)
    for (const item of inviteRefs) {
      if (!item) continue
      if (item.remaining.length === 0) {
        batch.delete(item.ref)
      } else {
        batch.update(item.ref, { groupIds: item.remaining })
      }
    }
    batch.delete(groupRef)
    await batch.commit()
  })

  // Run chunks sequentially
  for (const chunk of chunks) {
    await chunk()
  }
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, 'groups', groupId))
  if (!snap.exists()) return null
  return docToGroup(snap.id, snap.data() as Record<string, unknown>)
}

// Remove a confirmed member from a group.
// Caller must verify the member has no unsettled balance before calling.
export async function removeGroupMember(groupId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(uid) })
}

export function subscribeToGroup(
  groupId: string,
  cb:    (group: Group | null) => void,
  onErr: (err: Error) => void = () => {},
): Unsubscribe {
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snap) => cb(snap.exists() ? docToGroup(snap.id, snap.data() as Record<string, unknown>) : null),
    (err)  => onErr(err),
  )
}

export function subscribeToUserGroups(
  uid: string,
  cb: (groups: Group[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'groups'),
    where('members', 'array-contains', uid),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => docToGroup(d.id, d.data() as Record<string, unknown>)))
  })
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function addExpense(groupId: string, data: AddExpenseInput): Promise<string> {
  let ref!: { id: string }

  await runTransaction(db, async (tx) => {
    const expRef   = doc(collection(db, `groups/${groupId}/expenses`))
    const groupRef = doc(db, 'groups', groupId)

    // All reads must come before any writes in a Firestore transaction
    const groupSnap = await tx.get(groupRef)

    tx.set(expRef, {
      title:          data.title,
      amount:         data.amount,
      paidBy:         data.payments ? 'multiple' : data.paidBy,
      ...(data.payments ? { payments: data.payments } : {}),
      splitType:      data.splitType,
      splits:         data.splits,
      date:           Timestamp.fromDate(data.date),
      notes:          data.notes ?? '',
      category:       data.category,
      createdBy:      data.createdBy,
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
      isDeleted:      false,
      ...(data.isContribution ? { isContribution: true } : {}),
    })
    const updates: Record<string, unknown> = {}
    // Contribution pool expenses are not real spending — don't increment totalSpend counter
    if (!data.isContribution) updates.totalSpend = increment(data.amount)
    if (groupSnap.exists() && groupSnap.data().status === 'settled') {
      updates.status = 'active'
    }
    tx.update(groupRef, updates)
    ref = expRef
  })

  return ref.id
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  data: Omit<AddExpenseInput, 'createdBy'>,
): Promise<void> {
  const expRef   = doc(db, `groups/${groupId}/expenses`, expenseId)
  const groupRef = doc(db, 'groups', groupId)

  await runTransaction(db, async (tx) => {
    const expSnap = await tx.get(expRef)
    if (!expSnap.exists()) throw new Error('Expense not found')
    const expData        = expSnap.data() as { amount: number; isContribution?: boolean }
    const oldAmount      = expData.amount
    const isContribution = expData.isContribution ?? false
    const amountDiff     = data.amount - oldAmount

    tx.update(expRef, {
      title:     data.title,
      amount:    data.amount,
      paidBy:    data.payments ? 'multiple' : data.paidBy,
      // explicitly null out payments if switching back to single payer
      payments:  data.payments ?? null,
      splitType: data.splitType,
      splits:    data.splits,
      date:      Timestamp.fromDate(data.date),
      notes:     data.notes ?? '',
      category:  data.category,
      updatedAt: serverTimestamp(),
    })

    // Contribution expenses never touched totalSpend, so don't adjust it on edit either
    if (amountDiff !== 0 && !isContribution) {
      tx.update(groupRef, { totalSpend: increment(amountDiff) })
    }
  })
}

export async function softDeleteExpense(groupId: string, expenseId: string): Promise<void> {
  const expRef   = doc(db, `groups/${groupId}/expenses`, expenseId)
  const expSnap  = await getDoc(expRef)
  if (!expSnap.exists()) return

  const data           = expSnap.data() as { amount: number; isContribution?: boolean }
  const amount         = data.amount
  const isContribution = data.isContribution ?? false

  await runTransaction(db, async (tx) => {
    tx.update(expRef, { isDeleted: true, updatedAt: serverTimestamp() })
    // Only decrement totalSpend for real expenses (contributions never incremented it)
    if (!isContribution) tx.update(doc(db, 'groups', groupId), { totalSpend: increment(-amount) })
  })
}

export function subscribeToExpenses(
  groupId: string,
  cb:    (expenses: Expense[]) => void,
  onErr: (err: Error) => void = () => {},
): Unsubscribe {
  const q = query(
    collection(db, `groups/${groupId}/expenses`),
    where('isDeleted', '==', false),
    orderBy('date', 'desc'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => docToExpense(d.id, d.data() as Record<string, unknown>))),
    (err)  => onErr(err),
  )
}

// ─── Settlements ─────────────────────────────────────────────────────────────

export async function recordSettlement(
  groupId: string,
  data: CreateSettlementInput,
  allExpenses: Expense[],
  allSettlements: Settlement[],
  allMembers: string[],
  pendingInvites: string[] = [],
): Promise<void> {
  // Cap: settlement amount must not exceed the outstanding balance between from→to
  const currentBalances = calculateBalances(allExpenses, allMembers, pendingInvites, allSettlements)
  const fromBalance     = currentBalances.find((b) => b.uid === data.from)?.net ?? 0
  // from's net should be negative (they owe); the max they can pay is |fromBalance|
  if (data.amount > Math.abs(fromBalance) + 1) {
    throw new Error(`Amount exceeds outstanding balance of ${formatINR(Math.abs(fromBalance))}`)
  }

  // Build the new settlement to include in balance check
  const newSettlement: Settlement = {
    id:        '__pending__',
    from:      data.from,
    to:        data.to,
    amount:    data.amount,
    settledAt: new Date(),
    settledBy: data.settledBy,
    note:      data.note,
  }
  const settlementsAfter = [...allSettlements, newSettlement]

  // After recording this payment, are all balances zero?
  const balancesAfter = calculateBalances(allExpenses, allMembers, pendingInvites, settlementsAfter)
  const fullySettled  = balancesAfter.every((b) => b.net === 0)

  await runTransaction(db, async (tx) => {
    const settlRef = doc(collection(db, `groups/${groupId}/settlements`))
    const groupRef = doc(db, 'groups', groupId)

    tx.set(settlRef, {
      from:      data.from,
      to:        data.to,
      amount:    data.amount,
      settledAt: serverTimestamp(),
      settledBy: data.settledBy,
      note:      data.note ?? '',
    })

    if (fullySettled) {
      tx.update(groupRef, { status: 'settled' })
    }
  })
}

export function subscribeToSettlements(
  groupId: string,
  cb:    (settlements: Settlement[]) => void,
  onErr: (err: Error) => void = () => {},
): Unsubscribe {
  const q = query(
    collection(db, `groups/${groupId}/settlements`),
    orderBy('settledAt', 'desc'),
  )
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => docToSettlement(d.id, d.data() as Record<string, unknown>))),
    (err)  => onErr(err),
  )
}

export async function getSettlements(groupId: string): Promise<Settlement[]> {
  const q    = query(collection(db, `groups/${groupId}/settlements`), orderBy('settledAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToSettlement(d.id, d.data() as Record<string, unknown>))
}
