import { Expense, Group, User } from '@/types'
import { toRupees } from './calculations'

export function exportGroupToCSV(group: Group, expenses: Expense[], users: User[]): void {
  const userMap: Record<string, string> = {}
  users.forEach((u) => { userMap[u.uid] = u.displayName })

  function resolveName(key: string): string {
    if (userMap[key]) return userMap[key]
    // pending invite — key is an email address
    if (key.includes('@')) return key
    return key
  }

  const active        = expenses.filter((e) => !e.isDeleted)
  const realExpenses  = active.filter((e) => !e.isContribution)
  const contributions = active.filter((e) => e.isContribution)

  function resolvePaidBy(e: Expense): string {
    if (!e.payments) return resolveName(e.paidBy)
    return Object.entries(e.payments)
      .map(([uid, amt]) => `${resolveName(uid)} (${toRupees(amt).toFixed(2)})`)
      .join('; ')
  }

  // Collect all unique participant keys from real expenses only (exclude contribution pool)
  const allParticipantKeys = Array.from(
    new Set(realExpenses.flatMap((e) => [
      ...(e.payments ? Object.keys(e.payments) : [e.paidBy]),
      ...Object.keys(e.splits),
    ]))
  )

  const headers = [
    'Date',
    'Title',
    'Amount (₹)',
    'Paid By',
    'Category',
    'Type',
    'Notes',
    ...allParticipantKeys.map((k) => `Share: ${resolveName(k)}`),
  ]

  // Real expense rows
  const expenseRows = realExpenses.map((e) => {
    const base = [
      new Date(e.date).toLocaleDateString('en-IN'),
      `"${e.title.replace(/"/g, '""')}"`,
      toRupees(e.amount).toFixed(2),
      `"${resolvePaidBy(e)}"`,
      e.category,
      'expense',
      `"${(e.notes ?? '').replace(/"/g, '""')}"`,
    ]
    const shareColumns = allParticipantKeys.map((k) => {
      const share = e.splits[k]
      return share !== undefined ? toRupees(share).toFixed(2) : ''
    })
    return [...base, ...shareColumns]
  })

  // Contribution rows — simpler: show who contributed and how much
  const contributionRows = contributions.map((e) => {
    const contributors = e.payments
      ? Object.entries(e.payments).map(([uid, amt]) => `${resolveName(uid)} (${toRupees(amt).toFixed(2)})`).join('; ')
      : resolveName(e.paidBy)
    const base = [
      new Date(e.date).toLocaleDateString('en-IN'),
      `"${e.title.replace(/"/g, '""')}"`,
      toRupees(e.amount).toFixed(2),
      `"${contributors}"`,
      'contribution',
      'pool',
      '""',
    ]
    // No per-person share columns for contribution rows
    const shareColumns = allParticipantKeys.map(() => '')
    return [...base, ...shareColumns]
  })

  const rows = [...expenseRows, ...contributionRows]

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `${group.name.replace(/\s+/g, '_')}_expenses.csv`
  link.click()
  URL.revokeObjectURL(url)
}
