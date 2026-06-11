import { Expense, Group, User } from '@/types'
import { toRupees } from './calculations'

export function exportGroupToCSV(group: Group, expenses: Expense[], users: User[]): void {
  const userMap: Record<string, string> = {}
  users.forEach((u) => { userMap[u.uid] = u.displayName })

  const headers = ['Date', 'Title', 'Amount (₹)', 'Paid By', 'Category', 'Split Type', 'Notes']

  const rows = expenses
    .filter((e) => !e.isDeleted)
    .map((e) => [
      new Date(e.date).toLocaleDateString('en-IN'),
      `"${e.title.replace(/"/g, '""')}"`,
      toRupees(e.amount).toFixed(2),
      userMap[e.paidBy] ?? e.paidBy,
      e.category,
      e.splitType,
      `"${(e.notes ?? '').replace(/"/g, '""')}"`,
    ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `${group.name.replace(/\s+/g, '_')}_expenses.csv`
  link.click()
  URL.revokeObjectURL(url)
}
