'use client'

import { useAuthContext } from '@/components/auth/AuthProvider'
import { useUserGroups } from '@/hooks/useGroup'
import { GroupCard } from '@/components/groups/GroupCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { GroupCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { Archive, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ArchivedGroupsPage() {
  const { user }          = useAuthContext()
  const { groups, loading } = useUserGroups(user?.uid)
  const router            = useRouter()

  const archived = groups.filter((g) => g.status === 'archived' || g.status === 'settled')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
          Past Trips
        </h1>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => <GroupCardSkeleton key={i} />)}
        </div>
      ) : archived.length === 0 ? (
        <EmptyState icon={<Archive size={22} />} title="No past trips" description="Settled and archived trips appear here." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {archived.map((g) => <GroupCard key={g.id} group={g} currentUid={user!.uid} />)}
        </div>
      )}
    </div>
  )
}
