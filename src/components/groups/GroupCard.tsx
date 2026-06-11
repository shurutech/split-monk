'use client'

import Link from 'next/link'
import { Group } from '@/types'
import { formatINR } from '@/lib/calculations'
import { Users, CheckCircle, Archive } from 'lucide-react'

interface Props {
  group: Group
  currentUid: string
}

export function GroupCard({ group, currentUid }: Props) {
  const isSettled  = group.status === 'settled'
  const isArchived = group.status === 'archived'

  return (
    <Link
      href={`/groups/${group.id}`}
      className="block rounded-md border border-[#2A2A32] bg-[#111113] p-5 hover:border-[rgba(124,107,248,0.25)] hover:shadow-[0_0_24px_rgba(124,107,248,0.10)] transition-all duration-150"
    >
      {/* Color bar */}
      <div
        className="w-8 h-1 rounded-full mb-4"
        style={{ backgroundColor: group.coverColor }}
      />

      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-[#F2F2F7] font-semibold text-sm leading-tight line-clamp-2">{group.name}</h3>
        {isSettled && (
          <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(52,211,153,0.12)] text-[#34D399] text-[10px] font-medium">
            <CheckCircle size={10} /> Settled
          </span>
        )}
        {isArchived && (
          <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1A1A1F] text-[#8E8E9A] text-[10px] font-medium">
            <Archive size={10} /> Archived
          </span>
        )}
      </div>

      {group.startDate && (
        <p className="text-[#8E8E9A] text-xs mb-3">
          {new Date(group.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {group.endDate ? ` – ${new Date(group.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[#8E8E9A] text-xs">
          <Users size={12} />
          {group.members.length + (group.pendingInvites?.length ?? 0)} members
        </div>
        <span className="font-mono text-[#8E8E9A] text-xs">
          {formatINR(group.totalSpend)}
        </span>
      </div>
    </Link>
  )
}
