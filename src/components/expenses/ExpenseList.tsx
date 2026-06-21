'use client'

import { useEffect, useState, useMemo } from 'react'
import { Expense, User } from '@/types'
import { getUserById } from '@/lib/firestore'
import { formatINR } from '@/lib/calculations'
import { ExpenseCard } from './ExpenseCard'
import { ExpenseCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReceiptText } from 'lucide-react'
import Link from 'next/link'

type Filter = 'all' | 'mine'

interface Props {
  expenses: Expense[]
  loading: boolean
  groupId: string
  currentUid: string
}

export function ExpenseList({ expenses, loading, groupId, currentUid }: Props) {
  const [userCache, setUserCache] = useState<Record<string, User>>({})
  const [filter,    setFilter]    = useState<Filter>('all')

  // Fetch display names for all payers (single + multi-payer uid sets)
  useEffect(() => {
    const keys = new Set<string>()
    expenses.forEach((e) => {
      if (e.payments) {
        Object.keys(e.payments).forEach((uid) => keys.add(uid))
      } else if (!e.paidBy.includes('@')) {
        keys.add(e.paidBy)
      }
    })
    keys.forEach(async (uid) => {
      if (userCache[uid]) return
      const u = await getUserById(uid)
      if (u) setUserCache((prev) => ({ ...prev, [uid]: u }))
    })
  }, [expenses])

  function paidByName(key: string) {
    if (key === currentUid) return 'You'
    if (key.includes('@'))  return key.split('@')[0]
    return userCache[key]?.displayName?.split(' ')[0] ?? '…'
  }

  function payerNames(e: Expense): string[] | undefined {
    if (!e.payments) return undefined
    return Object.keys(e.payments).map(paidByName)
  }

  function iMyExpense(e: Expense): boolean {
    if (e.payments) return (e.payments[currentUid] ?? 0) > 0 || (e.splits[currentUid] ?? 0) > 0
    return e.paidBy === currentUid || (e.splits[currentUid] ?? 0) > 0
  }

  // "Mine" = expenses where I paid (single or multi) OR I have a split share
  const filtered = useMemo(() => {
    if (filter === 'all') return expenses
    return expenses.filter(iMyExpense)
  }, [expenses, filter, currentUid])

  // My total spend (what I actually paid out) and net share (what I'm responsible for)
  const myStats = useMemo(() => {
    if (filter !== 'mine') return null
    const iPaid = filtered.reduce((s, e) => {
      if (e.payments) return s + (e.payments[currentUid] ?? 0)
      return e.paidBy === currentUid ? s + e.amount : s
    }, 0)
    const myShare = filtered.reduce((s, e) => s + (e.splits[currentUid] ?? 0), 0)
    return { iPaid, myShare }
  }, [filtered, filter, currentUid])

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
  function groupByDate(list: Expense[]) {
    const groups: { label: string; items: Expense[] }[] = []
    let lastLabel = ''
    list.forEach((exp) => {
      const d     = new Date(exp.date)
      const today = new Date()
      const yest  = new Date(); yest.setDate(today.getDate() - 1)
      let label: string
      if (d.toDateString() === today.toDateString())     label = 'Today'
      else if (d.toDateString() === yest.toDateString()) label = 'Yesterday'
      else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })

      if (label !== lastLabel) {
        groups.push({ label, items: [] })
        lastLabel = label
      }
      groups[groups.length - 1].items.push(exp)
    })
    return groups
  }

  const grouped = groupByDate(filtered)

  return (
    <div className="space-y-4">
      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-[#111113] border border-[#2A2A32] rounded-sm p-0.5">
          {(['all', 'mine'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 ${
                filter === f
                  ? 'bg-[#7C6BF8] text-white'
                  : 'text-[#8E8E9A] hover:text-[#F2F2F7]'
              }`}
            >
              {f === 'all' ? 'All expenses' : 'My expenses'}
            </button>
          ))}
        </div>
        {filter === 'all' && (
          <span className="text-faint text-xs">{expenses.length} total</span>
        )}
      </div>

      {/* My stats strip */}
      {myStats && (
        <div className="flex gap-2">
          <div className="flex-1 rounded-sm border border-[#2A2A32] bg-[#111113] px-3 py-2.5">
            <p className="text-faint text-[10px] uppercase tracking-wide mb-0.5">I paid</p>
            <p className="font-mono text-sm font-medium text-[#F2F2F7]">{formatINR(myStats.iPaid)}</p>
          </div>
          <div className="flex-1 rounded-sm border border-[#2A2A32] bg-[#111113] px-3 py-2.5">
            <p className="text-faint text-[10px] uppercase tracking-wide mb-0.5">My share</p>
            <p className="font-mono text-sm font-medium text-[#F2F2F7]">{formatINR(myStats.myShare)}</p>
          </div>
          <div className="flex-1 rounded-sm border border-[#2A2A32] bg-[#111113] px-3 py-2.5">
            <p className="text-faint text-[10px] uppercase tracking-wide mb-0.5">Expenses</p>
            <p className="font-mono text-sm font-medium text-[#F2F2F7]">{filtered.length}</p>
          </div>
        </div>
      )}

      {/* Empty mine state */}
      {filtered.length === 0 && filter === 'mine' && (
        <EmptyState
          icon={<ReceiptText size={22} />}
          title="Not in any expenses"
          description="You haven't been added to any expenses yet."
        />
      )}

      {grouped.map(({ label, items }) => (
        <div key={label}>
          <p className="text-faint text-xs uppercase tracking-wide mb-1 px-1">{label}</p>
          {items.map((exp) => (
            <ExpenseCard
              key={exp.id}
              expense={exp}
              groupId={groupId}
              paidByName={paidByName(exp.paidBy)}
              payerNames={payerNames(exp)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
