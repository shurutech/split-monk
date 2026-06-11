'use client'

import { useAuthContext } from '@/components/auth/AuthProvider'
import { useUserGroups } from '@/hooks/useGroup'
import { useNetBalance } from '@/hooks/useExpenses'
import { EmptyState } from '@/components/ui/EmptyState'
import { GroupCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { GroupCard } from '@/components/groups/GroupCard'
import { formatINR } from '@/lib/calculations'
import { Plus, Layers, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user }            = useAuthContext()
  const { groups, loading } = useUserGroups(user?.uid)

  const activeGroups  = groups.filter((g) => g.status === 'active')
  const settledGroups = groups.filter((g) => g.status !== 'active')
  const firstName     = user?.displayName?.split(' ')[0] ?? 'there'

  const { net, loading: netLoading } = useNetBalance(user?.uid, activeGroups)

  const showBanner = !loading && !netLoading && activeGroups.length > 0 && net !== 0

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
            Hey {firstName} 👋
          </h1>
          <p className="text-[#8E8E9A] text-sm mt-1">
            {activeGroups.length > 0
              ? `${activeGroups.length} active trip${activeGroups.length !== 1 ? 's' : ''}`
              : 'No active trips'}
          </p>
        </div>
        <Link
          href="/groups/new"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#7C6BF8] text-white text-sm font-medium hover:bg-[#6B5CE7] transition-colors duration-150"
        >
          <Plus size={16} />
          New Trip
        </Link>
      </div>

      {/* Cross-trip net balance banner */}
      {showBanner && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-md border ${
          net > 0
            ? 'border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.06)]'
            : 'border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)]'
        }`}>
          {net > 0
            ? <TrendingUp size={16} className="text-success shrink-0" />
            : <TrendingDown size={16} className="text-[#F87171] shrink-0" />
          }
          <p className="text-sm">
            <span className={`font-mono font-semibold ${net > 0 ? 'text-success' : 'text-[#F87171]'}`}>
              {net > 0 ? '+' : ''}{formatINR(net)}
            </span>
            <span className="text-[#8E8E9A] ml-1.5">
              {net > 0 ? 'owed to you' : 'you owe'} across {activeGroups.length} trip{activeGroups.length !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
      )}

      {/* Active groups */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <GroupCardSkeleton key={i} />)}
        </div>
      ) : activeGroups.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} />}
          title="No active trips"
          description="Create a trip group and start splitting expenses with your team."
          action={
            <Link
              href="/groups/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[#7C6BF8] text-white text-sm font-medium hover:bg-[#6B5CE7] transition-colors"
            >
              <Plus size={16} /> Create your first trip
            </Link>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeGroups.map((group) => (
            <GroupCard key={group.id} group={group} currentUid={user!.uid} />
          ))}
        </div>
      )}

      {/* Settled/archived groups */}
      {!loading && settledGroups.length > 0 && (
        <div>
          <h2 className="text-[#8E8E9A] text-sm font-medium mb-3">Past trips</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {settledGroups.map((group) => (
              <GroupCard key={group.id} group={group} currentUid={user!.uid} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
