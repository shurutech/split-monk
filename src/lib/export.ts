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

  const active = expenses.filter((e) => !e.isDeleted)

  // Collect all unique participant keys across all expenses (payers + split members)
  const allParticipantKeys = Array.from(
    new Set(active.flatMap((e) => [e.paidBy, ...Object.keys(e.splits)]))
  )

  const headers = [
    'Date',
    'Title',
    'Amount (₹)',
    'Paid By',
    'Category',
    'Split Type',
    'Notes',
    ...allParticipantKeys.map((k) => `Share: ${resolveName(k)}`),
  ]

  const rows = active.map((e) => {
    const base = [
      new Date(e.date).toLocaleDateString('en-IN'),
      `"${e.title.replace(/"/g, '""')}"`,
      toRupees(e.amount).toFixed(2),
      resolveName(e.paidBy),
      e.category,
      e.splitType,
      `"${(e.notes ?? '').replace(/"/g, '""')}"`,
    ]
    // One column per participant — blank if they're not in this expense's split
    const shareColumns = allParticipantKeys.map((k) => {
      const share = e.splits[k]
      return share !== undefined ? toRupees(share).toFixed(2) : ''
    })
    return [...base, ...shareColumns]
  })

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `${group.name.replace(/\s+/g, '_')}_expenses.csv`
  link.click()
  URL.revokeObjectURL(url)
}
