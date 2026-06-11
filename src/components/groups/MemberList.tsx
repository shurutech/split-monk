'use client'

import { useEffect, useState } from 'react'
import { User } from '@/types'
import { getUserById } from '@/lib/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Crown, Mail, Clock } from 'lucide-react'

interface Props {
  memberUids:     string[]
  pendingInvites: string[]
  createdBy:      string
}

export function MemberList({ memberUids, pendingInvites, createdBy }: Props) {
  const [users, setUsers] = useState<Record<string, User>>({})

  useEffect(() => {
    memberUids.forEach(async (uid) => {
      const u = await getUserById(uid)
      if (u) setUsers((prev) => ({ ...prev, [uid]: u }))
    })
  }, [memberUids])

  return (
    <div className="space-y-1">
      {/* Resolved members */}
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
              <p className="text-faint text-xs truncate">{u?.email ?? uid}</p>
            </div>
            {uid === createdBy && (
              <span className="flex items-center gap-1 text-warning text-[10px] font-medium shrink-0">
                <Crown size={11} /> Organiser
              </span>
            )}
          </div>
        )
      })}

      {/* Pending invites */}
      {pendingInvites.map((email) => (
        <div key={email} className="flex items-center gap-3 py-3 px-3 rounded-sm border border-[rgba(251,191,36,0.15)] bg-[rgba(251,191,36,0.04)]">
          <div className="w-10 h-10 rounded-full bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] flex items-center justify-center shrink-0">
            <Mail size={16} className="text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#F2F2F7] text-sm font-medium truncate">
              {email.split('@')[0]}
            </p>
            <p className="text-faint text-xs truncate">{email}</p>
          </div>
          <span className="flex items-center gap-1 text-warning text-[10px] font-medium shrink-0">
            <Clock size={10} /> Invited
          </span>
        </div>
      ))}
    </div>
  )
}
