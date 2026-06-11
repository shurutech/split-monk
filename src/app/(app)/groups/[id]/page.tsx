'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGroup } from '@/hooks/useGroup'
import { useExpenses, useSettlements } from '@/hooks/useExpenses'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { calculateBalances, getOptimalSettlements, formatINR } from '@/lib/calculations'
import { getAllUsers } from '@/lib/firestore'
import { exportGroupToCSV } from '@/lib/export'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { BalancesTab } from '@/components/balances/BalancesTab'
import { MemberList } from '@/components/groups/MemberList'
import { SpendingAnalytics } from '@/components/groups/SpendingAnalytics'
import { GroupSettingsSheet } from '@/components/groups/GroupSettingsSheet'
import { GroupCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { ArrowLeft, Plus, Users, ReceiptText, Scale, BarChart2, Download, Settings } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const TABS = ['expenses', 'balances', 'stats', 'members'] as const
type Tab = typeof TABS[number]

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }                    = use(params)
  const { user }                  = useAuthContext()
  const { group, loading, error } = useGroup(id)
  // Only subscribe to subcollections once we know the user is a confirmed member.
  // If we subscribe while they're still a pendingInvitee (before resolvePendingInvites
  // completes), the isMemberOrPending() rule fires a get() that may still see the old
  // state and return permission-denied.
  const isMember = !!(user && group?.members.includes(user.uid))
  const { expenses, loading: expLoading }    = useExpenses(id, isMember)
  const { settlements: recordedSettlements } = useSettlements(id, isMember)
  const [activeTab,     setActiveTab]     = useState<Tab>('expenses')
  const [exporting,     setExporting]     = useState(false)
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const router                            = useRouter()

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-32 bg-[#1A1A1F] rounded animate-pulse" />
        <GroupCardSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20 text-[#8E8E9A]">
        Failed to load trip.{' '}
        <Link href="/dashboard" className="text-[#7C6BF8] underline">Go home</Link>
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

  const balances              = expLoading ? [] : calculateBalances(expenses, group.members, group.pendingInvites ?? [], recordedSettlements)
  const settlementSuggestions = balances.length ? getOptimalSettlements(balances) : []
  const myBalance             = balances.find((b) => b.uid === user?.uid)
  // Compute totalSpend from live expenses to avoid counter drift
  const totalSpend            = expLoading ? group.totalSpend : expenses.reduce((sum, e) => sum + e.amount, 0)

  async function handleExport() {
    setExporting(true)
    try {
      const users = await getAllUsers()
      if (group) exportGroupToCSV(group, expenses, users)
      toast.success('CSV downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

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
            <p className="text-faint text-xs mt-0.5">
              {new Date(group.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {group.endDate ? ` – ${new Date(group.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {expenses.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="p-2 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint transition-colors disabled:opacity-50"
              title="Export CSV"
            >
              <Download size={15} />
            </button>
          )}
          {group.createdBy === user?.uid && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint transition-colors"
              title="Trip settings"
            >
              <Settings size={15} />
            </button>
          )}
          {group.status !== 'archived' && (
            <Link
              href={`/groups/${id}/add`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-[#7C6BF8] text-white text-sm font-medium hover:bg-[#6B5CE7] transition-colors whitespace-nowrap"
            >
              <Plus size={15} /> Add
            </Link>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total spent" value={formatINR(totalSpend)} />
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
            {tab === 'stats'    && <BarChart2 size={13} />}
            {tab === 'members'  && <Users size={13} />}
            <span className="hidden sm:inline">{tab}</span>
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
          settlements={settlementSuggestions}
          recordedSettlements={recordedSettlements}
          expenses={expenses}
          currentUid={user?.uid ?? ''}
        />
      )}
      {activeTab === 'stats' && (
        <SpendingAnalytics expenses={expenses} />
      )}
      {activeTab === 'members' && (
        <MemberList
          groupId={id}
          memberUids={group.members}
          pendingInvites={group.pendingInvites ?? []}
          createdBy={group.createdBy}
          currentUid={user?.uid ?? ''}
          groupName={group.name}
          coverColor={group.coverColor}
          balances={balances}
          onLeft={() => router.replace('/dashboard')}
        />
      )}

      <GroupSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        group={group}
        expenses={expenses}
        balances={balances}
      />
    </div>
  )
}

function StatCard({ label, value, valueClass = 'text-[#F2F2F7]' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-sm border border-[#2A2A32] bg-[#111113] px-2 py-2.5 sm:px-3 sm:py-3">
      <p className="text-faint text-[9px] sm:text-[10px] uppercase tracking-wide mb-1 truncate">{label}</p>
      <p className={`font-mono text-xs sm:text-sm font-medium truncate ${valueClass}`}>{value}</p>
    </div>
  )
}
