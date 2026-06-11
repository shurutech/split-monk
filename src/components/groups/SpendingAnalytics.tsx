'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Expense } from '@/types'
import { formatINR } from '@/lib/calculations'
import { EXPENSE_CATEGORIES } from '@/constants'

const CATEGORY_COLORS: Record<string, string> = {
  food:      '#7C6BF8',
  stay:      '#34D399',
  transport: '#60A5FA',
  activity:  '#FBBF24',
  shopping:  '#FB7185',
  other:     '#8E8E9A',
}

interface Props {
  expenses: Expense[]
}

export function SpendingAnalytics({ expenses }: Props) {
  const data = useMemo(() => {
    const totals: Record<string, number> = {}
    expenses.filter((e) => !e.isDeleted).forEach((e) => {
      totals[e.category] = (totals[e.category] ?? 0) + e.amount
    })
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name:  EXPENSE_CATEGORIES.find((c) => c.value === key)?.label ?? key,
        value,
        key,
      }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])

  if (data.length === 0) {
    return (
      <p className="text-faint text-sm text-center py-8">
        Add more expenses to see spending breakdown.
      </p>
    )
  }

  const total = data.reduce((a, d) => a + d.value, 0)

  return (
    <div className="space-y-4">
      <h3 className="text-[#8E8E9A] text-xs uppercase tracking-wide">Spending by category</h3>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] ?? '#8E8E9A'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [typeof value === 'number' ? formatINR(value) : value, '']}
            contentStyle={{
              background: '#111113',
              border: '1px solid #2A2A32',
              borderRadius: 8,
              color: '#F2F2F7',
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[d.key] ?? '#8E8E9A' }} />
            <span className="text-[#8E8E9A] text-xs flex-1">{d.name}</span>
            <span className="font-mono text-xs text-[#F2F2F7]">{formatINR(d.value)}</span>
            <span className="font-mono text-xs text-faint w-10 text-right">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
