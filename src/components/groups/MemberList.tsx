'use client'

import { useEffect, useState } from 'react'
import { User } from '@/types'
import { getUserById } from '@/lib/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Crown } from 'lucide-react'

export function MemberList({ memberUids, createdBy }: { memberUids: string[]; createdBy: string }) {
  const [users, setUsers] = useState<Record<string, User>>({})

  useEffect(() => {
    memberUids.forEach(async (uid) => {
      const u = await getUserById(uid)
      if (u) setUsers((prev) => ({ ...prev, [uid]: u }))
    })
  }, [memberUids])

  return (
    <div className="space-y-1">
      {memberUids.map((uid) => {
        const u = users[uid]
        return (
          <div key={uid} className="flex items-center gap-3 py-3 px-3 rounded-sm border border-[#2A2A32] bg-[#111113]">
            {u ? (
              <UserAvatar user={u} size={40} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1A1A1F] animate-pulse" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[#F2F2F7] text-sm font-medium truncate">
                {u?.displayName ?? '…'}
              </p>
              <p className="text-[#4A4A56] text-xs truncate">{u?.email ?? uid}</p>
            </div>
            {uid === createdBy && (
              <span className="flex items-center gap-1 text-[#FBBF24] text-[10px] font-medium">
                <Crown size={11} /> Organiser
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
