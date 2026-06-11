'use client'

import { useEffect, useState } from 'react'
import { Expense, User } from '@/types'
import { getUserById } from '@/lib/firestore'
import { ExpenseCard } from './ExpenseCard'
import { ExpenseCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReceiptText } from 'lucide-react'
import Link from 'next/link'

interface Props {
  expenses: Expense[]
  loading: boolean
  groupId: string
  currentUid: string
}

export function ExpenseList({ expenses, loading, groupId, currentUid }: Props) {
  const [userCache, setUserCache] = useState<Record<string, User>>({})

  // Fetch display names for all unique payers
  useEffect(() => {
    const uids = [...new Set(expenses.map((e) => e.paidBy))]
    uids.forEach(async (uid) => {
      if (userCache[uid]) return
      const u = await getUserById(uid)
      if (u) setUserCache((prev) => ({ ...prev, [uid]: u }))
    })
  }, [expenses])

  function paidByName(uid: string) {
    if (uid === currentUid) return 'You'
    return userCache[uid]?.displayName?.split(' ')[0] ?? '…'
  }

  if (loading) {
    return (
      <div className="space-y-0">
        {[0, 1, 2, 3].map((i) => <ExpenseCardSkeleton key={i} />)}
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText size={22} />}
        title="No expenses yet"
        description="Tap + Add to log your first expense."
        action={
          <Link
            href={`/groups/${groupId}/add`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#7C6BF8] text-white text-sm font-medium hover:bg-[#6B5CE7] transition-colors"
          >
            Add first expense
          </Link>
        }
      />
    )
  }

  // Group by date header
  const grouped: { label: string; items: Expense[] }[] = []
  let lastLabel = ''
  expenses.forEach((exp) => {
    const d     = new Date(exp.date)
    const today = new Date()
    const yest  = new Date(); yest.setDate(today.getDate() - 1)
    let label: string
    if (d.toDateString() === today.toDateString())     label = 'Today'
    else if (d.toDateString() === yest.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })

    if (label !== lastLabel) {
      grouped.push({ label, items: [] })
      lastLabel = label
    }
    grouped[grouped.length - 1].items.push(exp)
  })

  return (
    <div className="space-y-4">
      {grouped.map(({ label, items }) => (
        <div key={label}>
          <p className="text-[#4A4A56] text-xs uppercase tracking-wide mb-1 px-1">{label}</p>
          {items.map((exp) => (
            <ExpenseCard
              key={exp.id}
              expense={exp}
              groupId={groupId}
              paidByName={paidByName(exp.paidBy)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
