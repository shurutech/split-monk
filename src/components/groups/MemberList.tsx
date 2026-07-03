'use client'

import { useEffect, useState, KeyboardEvent } from 'react'
import { User } from '@/types'
import type { Balance } from '@/types'
import { getUserById, getUserByEmail, removeGroupMember, removePendingInvite } from '@/lib/firestore'
import { db } from '@/lib/firebase'
import { doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Crown, Mail, Clock, UserPlus, Loader2, X, LogOut, UserMinus, Copy, Check } from 'lucide-react'
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
  balances:       Balance[]
  onLeft?:        () => void  // called after current user leaves
}

// Firestore doc IDs can't contain '.' — encode as ','
function encodeEmail(email: string) { return email.replace(/\./g, ',') }

export function MemberList({
  groupId, memberUids, pendingInvites, createdBy,
  currentUid, groupName, coverColor, balances, onLeft,
}: Props) {
  const [users,         setUsers]         = useState<Record<string, User>>({})
  const [emailInput,    setEmailInput]    = useState('')
  const [emailError,    setEmailError]    = useState('')
  const [adding,        setAdding]        = useState(false)
  // uid or email string being removed; null = none in progress
  const [removing,      setRemoving]      = useState<string | null>(null)
  const [copiedUpi,     setCopiedUpi]     = useState<string | null>(null)
  // pending confirm: uid (member) or email (pending invite)
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null)

  useEffect(() => {
    memberUids.forEach(async (uid) => {
      const u = await getUserById(uid)
      if (u) setUsers((prev) => ({ ...prev, [uid]: u }))
    })
  }, [memberUids])

  const isMember    = memberUids.includes(currentUid)
  const isOrganiser = currentUid === createdBy
  const totalCount  = memberUids.length + pendingInvites.length

  function netBalance(uid: string): number {
    return balances.find((b) => b.uid === uid)?.net ?? 0
  }

  async function handleRemoveMember(uid: string) {
    const net = netBalance(uid)
    if (net !== 0) return // guarded at call site already
    if (totalCount - 1 < 2) {
      toast.error('A trip needs at least 2 members')
      return
    }
    setRemoving(uid)
    setConfirmTarget(null)
    try {
      await removeGroupMember(groupId, uid)
      if (uid === currentUid) {
        toast.success('You left the trip')
        onLeft?.()
      } else {
        const name = users[uid]?.displayName?.split(' ')[0] ?? 'Member'
        toast.success(`${name} removed from trip`)
      }
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setRemoving(null)
    }
  }

  async function handleRemovePending(email: string) {
    if (totalCount - 1 < 2) {
      toast.error('A trip needs at least 2 members')
      return
    }
    setRemoving(email)
    setConfirmTarget(null)
    try {
      await removePendingInvite(groupId, email)
      toast.success(`Invite for ${email.split('@')[0]} cancelled`)
    } catch {
      toast.error('Failed to cancel invite')
    } finally {
      setRemoving(null)
    }
  }

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
        await updateDoc(groupRef, { members: arrayUnion(existing.uid) })

        if (existing.email) {
          const payload: InvitePayload = {
            groupId,
            groupName,
            coverColor,
            invitedBy:     users[currentUid]?.displayName ?? 'Someone',
            pendingEmails: [existing.email],
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
        }

        toast.success(`${existing.displayName.split(' ')[0]} added to the trip`)
      } else {
        const batch     = writeBatch(db)
        const inviteRef = doc(db, 'invites', encodeEmail(email))
        batch.update(groupRef, { pendingInvites: arrayUnion(email) })
        batch.set(inviteRef, { email, groupIds: arrayUnion(groupId) }, { merge: true })
        await batch.commit()

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
        const u              = users[uid]
        const isSelf         = uid === currentUid
        const isCreator      = uid === createdBy
        const net            = netBalance(uid)
        const hasBalance     = net !== 0
        const isThisRemoving = removing === uid
        const isConfirming   = confirmTarget === uid

        // Self can leave (not if organiser); organiser can remove others
        const showLeave  = isSelf && !isCreator && isMember
        const showRemove = !isSelf && isOrganiser

        return (
          <div key={uid} className="flex items-center gap-3 py-3 px-3 rounded-sm border border-[#2A2A32] bg-[#111113]">
            {u
              ? <UserAvatar user={u} size={40} />
              : <div className="w-10 h-10 rounded-full bg-[#1A1A1F] animate-pulse shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-[#F2F2F7] text-sm font-medium truncate">
                {u?.displayName ?? '…'}
                {isSelf && <span className="text-faint text-xs ml-1">(you)</span>}
              </p>
              <p className="text-faint text-xs truncate">{u?.email ?? uid}</p>
              {u?.upiId && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[#8E8E9A] text-[11px] font-mono truncate">{u.upiId}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(u.upiId!)
                      setCopiedUpi(uid)
                      setTimeout(() => setCopiedUpi(null), 2000)
                    }}
                    className="shrink-0 text-faint hover:text-[#7C6BF8] transition-colors"
                    title="Copy UPI ID"
                  >
                    {copiedUpi === uid
                      ? <Check size={11} className="text-success" />
                      : <Copy size={11} />
                    }
                  </button>
                </div>
              )}
            </div>

            {isCreator && (
              <span className="flex items-center gap-1 text-warning text-[10px] font-medium shrink-0">
                <Crown size={11} /> Organiser
              </span>
            )}

            {(showLeave || showRemove) && (
              isConfirming ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasBalance ? (
                    <span className="text-[#F87171] text-[10px] max-w-27.5 text-right leading-tight">
                      Settle balance first
                    </span>
                  ) : (
                    <>
                      <span className="text-[#8E8E9A] text-[10px]">
                        {isSelf ? 'Leave?' : 'Remove?'}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(uid)}
                        disabled={isThisRemoving}
                        className="px-2 py-1 rounded bg-[#F87171] text-white text-[10px] font-medium hover:bg-[#ef4444] disabled:opacity-50 transition-colors"
                      >
                        {isThisRemoving ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmTarget(null)}
                        className="px-2 py-1 rounded border border-[#2A2A32] text-[#8E8E9A] text-[10px] hover:text-[#F2F2F7] transition-colors"
                      >
                        No
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (hasBalance) {
                      toast.error(
                        isSelf
                          ? 'Settle your balance before leaving'
                          : `${u?.displayName?.split(' ')[0] ?? 'Member'} has an unsettled balance`,
                      )
                      return
                    }
                    setConfirmTarget(uid)
                  }}
                  disabled={isThisRemoving}
                  className="p-1.5 rounded text-[#8E8E9A] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.08)] transition-colors disabled:opacity-40 shrink-0"
                  title={isSelf ? 'Leave trip' : 'Remove member'}
                >
                  {isThisRemoving
                    ? <Loader2 size={14} className="animate-spin" />
                    : isSelf
                      ? <LogOut size={14} />
                      : <UserMinus size={14} />
                  }
                </button>
              )
            )}
          </div>
        )
      })}

      {/* Pending invites */}
      {pendingInvites.map((email) => {
        const isThisRemoving = removing === email
        const isConfirming   = confirmTarget === email

        return (
          <div key={email} className="flex items-center gap-3 py-3 px-3 rounded-sm border border-[rgba(251,191,36,0.15)] bg-[rgba(251,191,36,0.04)]">
            <div className="w-10 h-10 rounded-full bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] flex items-center justify-center shrink-0">
              <Mail size={16} className="text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#F2F2F7] text-sm font-medium truncate">{email.split('@')[0]}</p>
              <p className="text-faint text-xs truncate">{email}</p>
            </div>

            <span className="flex items-center gap-1 text-warning text-[10px] font-medium shrink-0 mr-1">
              <Clock size={10} /> Invited
            </span>

            {/* Organiser can cancel pending invites */}
            {isOrganiser && (
              isConfirming ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[#8E8E9A] text-[10px]">Cancel?</span>
                  <button
                    onClick={() => handleRemovePending(email)}
                    disabled={isThisRemoving}
                    className="px-2 py-1 rounded bg-[#F87171] text-white text-[10px] font-medium hover:bg-[#ef4444] disabled:opacity-50 transition-colors"
                  >
                    {isThisRemoving ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmTarget(null)}
                    className="px-2 py-1 rounded border border-[#2A2A32] text-[#8E8E9A] text-[10px] hover:text-[#F2F2F7] transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmTarget(email)}
                  disabled={isThisRemoving}
                  className="p-1.5 rounded text-[#8E8E9A] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.08)] transition-colors disabled:opacity-40 shrink-0"
                  title="Cancel invite"
                >
                  {isThisRemoving
                    ? <Loader2 size={14} className="animate-spin" />
                    : <X size={14} />
                  }
                </button>
              )
            )}
          </div>
        )
      })}

      {/* Add member — any member */}
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
