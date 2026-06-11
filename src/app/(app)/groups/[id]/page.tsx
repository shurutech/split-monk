'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGroup } from '@/hooks/useGroup'
import { useExpenses } from '@/hooks/useExpenses'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { calculateBalances, getOptimalSettlements, formatINR } from '@/lib/calculations'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { BalancesTab } from '@/components/balances/BalancesTab'
import { MemberList } from '@/components/groups/MemberList'
import { GroupCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { ArrowLeft, Plus, Users, ReceiptText, Scale } from 'lucide-react'
import Link from 'next/link'

const TABS = ['expenses', 'balances', 'members'] as const
type Tab = typeof TABS[number]

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }                    = use(params)
  const { user }                  = useAuthContext()
  const { group, loading }        = useGroup(id)
  const { expenses, loading: expLoading } = useExpenses(id)
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const router                    = useRouter()

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-32 bg-[#1A1A1F] rounded animate-pulse" />
        <GroupCardSkeleton />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="text-center py-20 text-[#8E8E9A]">
        Group not found.{' '}
        <Link href="/dashboard" className="text-[#7C6BF8] underline">Go home</Link>
      </div>
    )
  }

  const balances    = expLoading ? [] : calculateBalances(expenses, group.members)
  const settlements = balances.length ? getOptimalSettlements(balances) : []
  const myBalance   = balances.find((b) => b.uid === user?.uid)

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-xl text-[#F2F2F7] truncate" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
            {group.name}
          </h1>
          {group.startDate && (
            <p className="text-[#4A4A56] text-xs mt-0.5">
              {new Date(group.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {group.endDate ? ` – ${new Date(group.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </p>
          )}
        </div>
        {group.status === 'active' && (
          <Link
            href={`/groups/${id}/add`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-[#7C6BF8] text-white text-sm font-medium hover:bg-[#6B5CE7] transition-colors"
          >
            <Plus size={15} /> Add
          </Link>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total spent" value={formatINR(group.totalSpend)} />
        <StatCard
          label="Your balance"
          value={myBalance ? (myBalance.net >= 0 ? `+${formatINR(myBalance.net)}` : formatINR(myBalance.net)) : '—'}
          valueClass={myBalance && myBalance.net !== 0 ? (myBalance.net > 0 ? 'text-[#34D399]' : 'text-[#F87171]') : 'text-[#8E8E9A]'}
        />
        <StatCard label="Expenses" value={String(expenses.length)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111113] border border-[#2A2A32] rounded-sm p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium capitalize transition-all duration-150 ${
              activeTab === tab
                ? 'bg-[#7C6BF8] text-white'
                : 'text-[#8E8E9A] hover:text-[#F2F2F7]'
            }`}
          >
            {tab === 'expenses' && <ReceiptText size={13} />}
            {tab === 'balances' && <Scale size={13} />}
            {tab === 'members'  && <Users size={13} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'expenses' && (
        <ExpenseList
          expenses={expenses}
          loading={expLoading}
          groupId={id}
          currentUid={user?.uid ?? ''}
        />
      )}
      {activeTab === 'balances' && (
        <BalancesTab
          group={group}
          balances={balances}
          settlements={settlements}
          expenses={expenses}
          currentUid={user?.uid ?? ''}
        />
      )}
      {activeTab === 'members' && (
        <MemberList memberUids={group.members} createdBy={group.createdBy} />
      )}
    </div>
  )
}

function StatCard({ label, value, valueClass = 'text-[#F2F2F7]' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-sm border border-[#2A2A32] bg-[#111113] px-3 py-3">
      <p className="text-[#4A4A56] text-[10px] uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-mono text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  )
}
