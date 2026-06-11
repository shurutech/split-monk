'use client'

import { useEffect, useState, KeyboardEvent } from 'react'
import { User } from '@/types'
import { getUserById, getUserByEmail } from '@/lib/firestore'
import { db } from '@/lib/firebase'
import { doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Crown, Mail, Clock, UserPlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { InvitePayload } from '@/app/api/invite/route'

interface Props {
  groupId:        string
  memberUids:     string[]
  pendingInvites: string[]
  createdBy:      string
  currentUid:     string
  groupName:      string
  coverColor:     string
}

// Firestore doc IDs can't contain '.' — encode as ','
function encodeEmail(email: string) { return email.replace(/\./g, ',') }

export function MemberList({ groupId, memberUids, pendingInvites, createdBy, currentUid, groupName, coverColor }: Props) {
  const [users,      setUsers]      = useState<Record<string, User>>({})
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')
  const [adding,     setAdding]     = useState(false)

  useEffect(() => {
    memberUids.forEach(async (uid) => {
      const u = await getUserById(uid)
      if (u) setUsers((prev) => ({ ...prev, [uid]: u }))
    })
  }, [memberUids])

  const isMember = memberUids.includes(currentUid)

  async function handleAdd() {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    if (!email.includes('@') || !email.includes('.')) {
      setEmailError('Enter a valid email address')
      return
    }
    if (Object.values(users).some((u) => u.email === email)) {
      setEmailError('Already a member')
      return
    }
    if (pendingInvites.includes(email)) {
      setEmailError('Already invited')
      return
    }

    setEmailError('')
    setAdding(true)

    try {
      const existing = await getUserByEmail(email)
      const groupRef = doc(db, 'groups', groupId)

      if (existing) {
        // User already has an account — add directly to members
        await updateDoc(groupRef, { members: arrayUnion(existing.uid) })
        toast.success(`${existing.displayName.split(' ')[0]} added to the trip`)
      } else {
        // Not signed up yet — add to pendingInvites + upsert invite doc
        const batch     = writeBatch(db)
        const inviteRef = doc(db, 'invites', encodeEmail(email))
        batch.update(groupRef, { pendingInvites: arrayUnion(email) })
        batch.set(inviteRef, { email, groupIds: arrayUnion(groupId) }, { merge: true })
        await batch.commit()

        // Fire-and-forget invite email
        const payload: InvitePayload = {
          groupId,
          groupName,
          coverColor,
          invitedBy:     users[currentUid]?.displayName ?? 'Someone',
          pendingEmails: [email],
          memberNames:   memberUids
            .filter((uid) => uid !== currentUid)
            .map((uid) => users[uid]?.displayName?.split(' ')[0] ?? '')
            .filter(Boolean),
        }
        fetch('/api/invite', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }).catch(() => {})

        toast.success(`Invite sent to ${email.split('@')[0]}`)
      }

      setEmailInput('')
    } catch {
      toast.error('Failed to add member')
    } finally {
      setAdding(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  { e.preventDefault(); handleAdd() }
    if (e.key === 'Escape') { setEmailInput(''); setEmailError('') }
  }

  return (
    <div className="space-y-1">
      {/* Resolved members */}
      {memberUids.map((uid) => {
        const u = users[uid]
        return (
          <div key={uid} className="flex items-center gap-3 py-3 px-3 rounded-sm border border-[#2A2A32] bg-[#111113]">
            {u
              ? <UserAvatar user={u} size={40} />
              : <div className="w-10 h-10 rounded-full bg-[#1A1A1F] animate-pulse shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-[#F2F2F7] text-sm font-medium truncate">{u?.displayName ?? '…'}</p>
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
            <p className="text-[#F2F2F7] text-sm font-medium truncate">{email.split('@')[0]}</p>
            <p className="text-faint text-xs truncate">{email}</p>
          </div>
          <span className="flex items-center gap-1 text-warning text-[10px] font-medium shrink-0">
            <Clock size={10} /> Invited
          </span>
        </div>
      ))}

      {/* Add member — organiser only */}
      {isMember && (
        <div className="pt-4 border-t border-[#2A2A32] mt-3">
          <p className="text-faint text-[10px] uppercase tracking-wider mb-2.5">Add member</p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
                onKeyDown={handleKeyDown}
                placeholder="name@email.com"
                disabled={adding}
                className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all disabled:opacity-50 pr-8"
              />
              {emailInput && !adding && (
                <button
                  onClick={() => { setEmailInput(''); setEmailError('') }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-[#F2F2F7] transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !emailInput.trim()}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-sm bg-[#7C6BF8] text-white text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {adding
                ? <Loader2 size={14} className="animate-spin" />
                : <UserPlus size={14} />
              }
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {emailError && (
            <p className="text-[#F87171] text-xs mt-1.5 flex items-center gap-1">
              <X size={11} /> {emailError}
            </p>
          )}
          <p className="text-faint text-[10px] mt-1.5">
            Not signed up yet? They&apos;ll get an invite email and join when they sign in.
          </p>
        </div>
      )}
    </div>
  )
}
