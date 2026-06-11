'use client'

import Link from 'next/link'
import { Expense } from '@/types'
import { formatINR } from '@/lib/calculations'
import { EXPENSE_CATEGORIES } from '@/constants'
import { Utensils, Hotel, Car, Target, ShoppingBag, MoreHorizontal } from 'lucide-react'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  food:      <Utensils size={14} />,
  stay:      <Hotel size={14} />,
  transport: <Car size={14} />,
  activity:  <Target size={14} />,
  shopping:  <ShoppingBag size={14} />,
  other:     <MoreHorizontal size={14} />,
}

function relativeDate(date: Date): string {
  const now   = new Date()
  const d     = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0)  return 'Today'
  if (diffDays === 1)  return 'Yesterday'
  if (diffDays < 7)   return `${diffDays} days ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface Props {
  expense: Expense
  groupId: string
  paidByName: string
}

export function ExpenseCard({ expense, groupId, paidByName }: Props) {
  const splitCount = Object.keys(expense.splits).length
  const catLabel   = EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label ?? 'Other'

  return (
    <Link
      href={`/groups/${groupId}/expenses/${expense.id}`}
      className="flex items-center gap-3 py-3.5 px-1 border-b border-[#2A2A32] hover:bg-[#1A1A1F] -mx-1 px-1 rounded transition-colors group"
    >
      {/* Category icon */}
      <div className="w-9 h-9 rounded-full bg-[#1A1A1F] border border-[#2A2A32] flex items-center justify-center text-[#8E8E9A] flex-shrink-0 group-hover:border-[rgba(124,107,248,0.25)] transition-colors">
        {CATEGORY_ICONS[expense.category] ?? CATEGORY_ICONS.other}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-[#F2F2F7] text-sm font-medium truncate">{expense.title}</p>
        <p className="text-[#4A4A56] text-xs mt-0.5 truncate">
          {paidByName} · {splitCount} people · {relativeDate(expense.date)}
        </p>
      </div>

      {/* Amount */}
      <span className="font-mono text-[#F2F2F7] text-sm font-medium flex-shrink-0">
        {formatINR(expense.amount)}
      </span>
    </Link>
  )
}
