import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  increment,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  User,
  Group,
  Expense,
  Settlement,
  CreateGroupInput,
  AddExpenseInput,
  CreateSettlementInput,
} from '@/types'
import { calculateBalances, getOptimalSettlements } from './calculations'

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
    createdAt:    tsToDate(data.createdAt),
    lastActiveAt: tsToDate(data.lastActiveAt),
  }
}

function docToGroup(id: string, data: Record<string, unknown>): Group {
  return {
    id,
    name:        data.name as string,
    description: data.description as string | undefined,
    createdBy:   data.createdBy as string,
    members:     data.members as string[],
    startDate:   data.startDate ? tsToDate(data.startDate) : undefined,
    endDate:     data.endDate   ? tsToDate(data.endDate)   : undefined,
    status:      data.status as Group['status'],
    totalSpend:  data.totalSpend as number,
    createdAt:   tsToDate(data.createdAt),
    coverColor:  data.coverColor as string,
  }
}

function docToExpense(id: string, data: Record<string, unknown>): Expense {
  return {
    id,
    title:     data.title as string,
    amount:    data.amount as number,
    paidBy:    data.paidBy as string,
    splitType: data.splitType as Expense['splitType'],
    splits:    data.splits as Record<string, number>,
    date:      tsToDate(data.date),
    notes:     data.notes as string | undefined,
    category:  data.category as Expense['category'],
    createdBy: data.createdBy as string,
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
    isDeleted: data.isDeleted as boolean,
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

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function createGroup(data: CreateGroupInput & { createdBy: string }): Promise<string> {
  const ref = await addDoc(collection(db, 'groups'), {
    name:        data.name,
    description: data.description ?? '',
    createdBy:   data.createdBy,
    members:     data.members,
    startDate:   data.startDate ?? null,
    endDate:     data.endDate   ?? null,
    status:      'active',
    totalSpend:  0,
    createdAt:   serverTimestamp(),
    coverColor:  data.coverColor,
  })
  return ref.id
}

export async function updateGroup(groupId: string, data: Partial<Group>): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), data as Record<string, unknown>)
}

export async function archiveGroup(groupId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { status: 'archived' })
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, 'groups', groupId))
  if (!snap.exists()) return null
  return docToGroup(snap.id, snap.data() as Record<string, unknown>)
}

export function subscribeToGroup(
  groupId: string,
  cb: (group: Group | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'groups', groupId), (snap) => {
    cb(snap.exists() ? docToGroup(snap.id, snap.data() as Record<string, unknown>) : null)
  })
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

    tx.set(expRef, {
      title:     data.title,
      amount:    data.amount,
      paidBy:    data.paidBy,
      splitType: data.splitType,
      splits:    data.splits,
      date:      Timestamp.fromDate(data.date),
      notes:     data.notes ?? '',
      category:  data.category,
      createdBy: data.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false,
    })
    tx.update(groupRef, { totalSpend: increment(data.amount) })
    ref = expRef
  })

  return ref.id
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  data: Partial<Expense>,
): Promise<void> {
  await updateDoc(doc(db, `groups/${groupId}/expenses`, expenseId), {
    ...data,
    updatedAt: serverTimestamp(),
  } as Record<string, unknown>)
}

export async function softDeleteExpense(groupId: string, expenseId: string): Promise<void> {
  const expRef   = doc(db, `groups/${groupId}/expenses`, expenseId)
  const expSnap  = await getDoc(expRef)
  if (!expSnap.exists()) return

  const amount = (expSnap.data() as { amount: number }).amount

  await runTransaction(db, async (tx) => {
    tx.update(expRef, { isDeleted: true, updatedAt: serverTimestamp() })
    tx.update(doc(db, 'groups', groupId), { totalSpend: increment(-amount) })
  })
}

export function subscribeToExpenses(
  groupId: string,
  cb: (expenses: Expense[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, `groups/${groupId}/expenses`),
    where('isDeleted', '==', false),
    orderBy('date', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => docToExpense(d.id, d.data() as Record<string, unknown>)))
  })
}

// ─── Settlements ─────────────────────────────────────────────────────────────

export async function recordSettlement(
  groupId: string,
  data: CreateSettlementInput,
  allExpenses: Expense[],
  allMembers: string[],
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const settlRef  = doc(collection(db, `groups/${groupId}/settlements`))
    const groupRef  = doc(db, 'groups', groupId)

    tx.set(settlRef, {
      from:      data.from,
      to:        data.to,
      amount:    data.amount,
      settledAt: serverTimestamp(),
      settledBy: data.settledBy,
      note:      data.note ?? '',
    })

    // Check if fully settled after this payment
    const balances      = calculateBalances(allExpenses, allMembers)
    const remaining     = getOptimalSettlements(balances)
    const isLastPayment = remaining.length === 1 &&
      remaining[0].from   === data.from &&
      remaining[0].to     === data.to &&
      remaining[0].amount === data.amount

    if (isLastPayment) {
      tx.update(groupRef, { status: 'settled' })
    }
  })
}

export async function getSettlements(groupId: string): Promise<Settlement[]> {
  const q    = query(collection(db, `groups/${groupId}/settlements`), orderBy('settledAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToSettlement(d.id, d.data() as Record<string, unknown>))
}
