'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useGroup } from '@/hooks/useGroup'
import { getUserById, softDeleteExpense } from '@/lib/firestore'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { Expense, User } from '@/types'
import { formatINR } from '@/lib/calculations'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { EXPENSE_CATEGORIES } from '@/constants'
import { ArrowLeft, Trash2, Loader2, Mail, Pencil } from 'lucide-react'

function isPendingKey(key: string) { return key.includes('@') }
import { toast } from 'sonner'

function tsToDate(ts: unknown): Date {
  if (ts && typeof ts === 'object' && 'toDate' in ts) return (ts as { toDate: () => Date }).toDate()
  return new Date(ts as string)
}

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const { id, eid }      = use(params)
  const { user }         = useAuthContext()
  const { group }        = useGroup(id)
  const router           = useRouter()

  const [expense,   setExpense]   = useState<Expense | null>(null)
  const [userCache, setUserCache] = useState<Record<string, User>>({})
  const [deleting,  setDeleting]  = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  // Subscribe to this single expense doc
  useEffect(() => {
    const ref = doc(db, `groups/${id}/expenses`, eid)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setExpense(null); return }
      const d = snap.data()
      setExpense({
        id:        snap.id,
        title:     d.title,
        amount:    d.amount,
        paidBy:    d.paidBy,
        splitType: d.splitType,
        splits:    d.splits,
        date:      tsToDate(d.date),
        notes:     d.notes,
        category:  d.category,
        createdBy: d.createdBy,
        createdAt: tsToDate(d.createdAt),
        updatedAt: tsToDate(d.updatedAt),
        isDeleted: d.isDeleted,
      })
    })
  }, [id, eid])

  // Fetch all split participants (skip email keys — they're pending invites, not UIDs)
  useEffect(() => {
    if (!expense) return
    const keys = [expense.paidBy, ...Object.keys(expense.splits)]
    const unique = [...new Set(keys)].filter((k) => !isPendingKey(k))
    unique.forEach(async (uid) => {
      if (userCache[uid]) return
      const u = await getUserById(uid)
      if (u) setUserCache((prev) => ({ ...prev, [uid]: u }))
    })
  }, [expense])

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    try {
      await softDeleteExpense(id, eid)
      toast.success('Expense deleted')
      router.push(`/groups/${id}`)
    } catch {
      toast.error('Failed to delete expense')
      setDeleting(false)
    }
  }

  function name(key: string) {
    if (key === user?.uid)    return 'You'
    if (isPendingKey(key))    return key.split('@')[0]
    return userCache[key]?.displayName?.split(' ')[0] ?? '…'
  }

  if (!expense) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-6 w-32 bg-[#1A1A1F] rounded animate-pulse" />
        <div className="h-40 bg-[#1A1A1F] rounded animate-pulse" />
      </div>
    )
  }

  const catLabel = EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label ?? 'Other'
  const canDelete = user && (user.uid === expense.createdBy || user.uid === group?.createdBy)

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl text-[#F2F2F7] flex-1 truncate" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
          {expense.title}
        </h1>
        {canDelete && (
          <button
            onClick={() => router.push(`/groups/${id}/expenses/${eid}/edit`)}
            className="p-2 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint transition-colors shrink-0"
            title="Edit expense"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      {/* Main card */}
      <div className="rounded-md border border-[#2A2A32] bg-[#111113] p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-3xl font-bold text-[#F2F2F7]">{formatINR(expense.amount)}</p>
            <p className="text-[#8E8E9A] text-sm mt-1">
              Paid by{' '}
              <span className="text-[#F2F2F7] font-medium">{name(expense.paidBy)}</span>
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#1A1A1F] border border-[#2A2A32] text-[#8E8E9A] text-xs">
            {catLabel}
          </span>
        </div>

        <div className="flex gap-4 text-xs text-[#8E8E9A]">
          <span>{new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="capitalize">{expense.splitType} split</span>
        </div>

        {expense.notes && (
          <p className="text-[#8E8E9A] text-sm border-t border-[#2A2A32] pt-3">{expense.notes}</p>
        )}
      </div>

      {/* Split breakdown */}
      <div>
        <p className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-3">Split breakdown</p>
        <div className="space-y-2">
          {Object.entries(expense.splits).map(([key, share]) => (
            <div key={key} className="flex items-center gap-3 py-2.5 px-3 rounded-sm border border-[#2A2A32] bg-[#111113]">
              {isPendingKey(key) ? (
                <div className="w-8 h-8 rounded-full bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-warning" />
                </div>
              ) : userCache[key] ? (
                <UserAvatar user={userCache[key]} size={32} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1A1A1F] animate-pulse shrink-0" />
              )}
              <span className="flex-1 text-[#F2F2F7] text-sm">{name(key)}</span>
              {isPendingKey(key) && (
                <span className="text-warning text-[10px] font-medium mr-1">invited</span>
              )}
              <span className="font-mono text-sm text-[#F2F2F7]">{formatINR(share)}</span>
              {expense.splitType === 'percentage' && (
                <span className="font-mono text-xs text-faint">
                  {((share / expense.amount) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete */}
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-sm text-sm font-medium border transition-colors ${
            confirmDel
              ? 'bg-[rgba(248,113,113,0.15)] border-[rgba(248,113,113,0.4)] text-[#F87171] hover:bg-[rgba(248,113,113,0.25)]'
              : 'bg-transparent border-[#2A2A32] text-[#4A4A56] hover:border-[rgba(248,113,113,0.3)] hover:text-[#F87171]'
          }`}
        >
          {deleting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={15} />
          )}
          {deleting ? 'Deleting…' : confirmDel ? 'Tap again to confirm delete' : 'Delete expense'}
        </button>
      )}
    </div>
  )
}
