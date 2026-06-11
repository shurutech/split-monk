'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { getAllUsers, getUserByEmail, createGroup } from '@/lib/firestore'
import { GROUP_COLORS, MAX_GROUP_NAME_LENGTH, MIN_GROUP_MEMBERS, ALLOWED_DOMAIN } from '@/constants'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { User } from '@/types'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, X, Mail, UserPlus } from 'lucide-react'
import type { InvitePayload } from '@/app/api/invite/route'

type MemberEntry =
  | { type: 'user';    user: User }
  | { type: 'pending'; email: string }

export function GroupForm({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const { user }  = useAuthContext()
  const router    = useRouter()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [startDate,   setStartDate]   = useState('')
  const [endDate,     setEndDate]     = useState('')
  const [coverColor,  setCoverColor]  = useState(GROUP_COLORS[0].value)
  const [members,     setMembers]     = useState<MemberEntry[]>([])
  const [allUsers,    setAllUsers]    = useState<User[]>([])
  const [loading,     setLoading]     = useState(false)
  const [fetching,    setFetching]    = useState(true)

  // Email input state
  const [emailInput,   setEmailInput]   = useState('')
  const [emailError,   setEmailError]   = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAllUsers().then((users) => {
      setAllUsers(users)
      if (user) {
        const self = users.find((u) => u.uid === user.uid)
        if (self) setMembers([{ type: 'user', user: self }])
      }
      setFetching(false)
    })
  }, [user])

  // Filter dropdown: existing users not yet added, matching input
  const inputLower = emailInput.toLowerCase().trim()
  const dropdownUsers = inputLower.length > 0
    ? allUsers.filter((u) => {
        const alreadyAdded = members.some(
          (m) => m.type === 'user' && m.user.uid === u.uid
        )
        if (alreadyAdded) return false
        return (
          u.email.toLowerCase().includes(inputLower) ||
          u.displayName.toLowerCase().includes(inputLower)
        )
      })
    : []

  function addExistingUser(u: User) {
    if (members.some((m) => m.type === 'user' && m.user.uid === u.uid)) return
    setMembers((prev) => [...prev, { type: 'user', user: u }])
    setEmailInput('')
    setEmailError('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  async function addByEmail(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase()
    if (!email) return

    // Domain check
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setEmailError(`Only @${ALLOWED_DOMAIN} emails are allowed`)
      return
    }

    // Duplicate check
    if (members.some(
      (m) => (m.type === 'user' && m.user.email === email) ||
             (m.type === 'pending' && m.email === email)
    )) {
      setEmailError('Already added')
      return
    }

    setEmailError('')
    setEmailLoading(true)
    setShowDropdown(false)

    try {
      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        setMembers((prev) => [...prev, { type: 'user', user: existingUser }])
      } else {
        // Not in DB yet — add as pending invite
        setMembers((prev) => [...prev, { type: 'pending', email }])
      }
      setEmailInput('')
    } catch {
      setEmailError('Failed to look up email')
    } finally {
      setEmailLoading(false)
      inputRef.current?.focus()
    }
  }

  function removeMember(index: number) {
    const entry = members[index]
    // Can't remove self
    if (entry.type === 'user' && entry.user.uid === user?.uid) return
    setMembers((prev) => prev.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault()
      if (dropdownUsers.length > 0 && showDropdown) {
        addExistingUser(dropdownUsers[0])
      } else if (emailInput.trim()) {
        addByEmail(emailInput)
      }
    }
    if (e.key === 'Escape') {
      setShowDropdown(false)
    }
    if (e.key === 'Backspace' && !emailInput && members.length > 1) {
      // Remove last non-self member on backspace when input is empty
      const last = members[members.length - 1]
      if (last.type !== 'user' || last.user.uid !== user?.uid) {
        setMembers((prev) => prev.slice(0, -1))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!name.trim()) { toast.error('Trip name is required'); return }
    if (members.length < MIN_GROUP_MEMBERS) {
      toast.error(`Add at least ${MIN_GROUP_MEMBERS} members`)
      return
    }

    // If there's leftover text in the email input, try to commit it first
    if (emailInput.trim()) {
      toast.error('Press Enter or Tab to confirm the email before creating')
      inputRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      const resolvedMembers = members.filter((m) => m.type === 'user') as { type: 'user'; user: User }[]
      const pendingMembers  = members.filter((m) => m.type === 'pending') as { type: 'pending'; email: string }[]
      const resolvedUids    = resolvedMembers.map((m) => m.user.uid)
      const pendingEmails   = pendingMembers.map((m) => m.email)

      const id = await createGroup({
        name:           name.trim(),
        description:    description.trim() || undefined,
        members:        resolvedUids,
        pendingInvites: pendingEmails,
        startDate:      startDate ? new Date(startDate) : undefined,
        endDate:        endDate   ? new Date(endDate)   : undefined,
        coverColor,
        createdBy:      user.uid,
      })

      // Send email invites to pending members — fire-and-forget.
      // Group creation already succeeded; email failure must never block the user.
      if (pendingEmails.length > 0) {
        const resolvedNames = resolvedMembers
          .filter((m) => m.user.uid !== user.uid)
          .map((m) => m.user.displayName.split(' ')[0])

        const invitePayload: InvitePayload = {
          groupId:       id,
          groupName:     name.trim(),
          coverColor,
          invitedBy:     user.displayName ?? user.email ?? 'Someone',
          pendingEmails,
          memberNames:   resolvedNames,
          startDate:     startDate || undefined,
          endDate:       endDate   || undefined,
        }

        fetch('/api/invite', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(invitePayload),
        })
          .then(async (res) => {
            if (!res.ok && res.status !== 207) {
              console.warn('[GroupForm] invite API error', res.status)
              return
            }
            const data = await res.json()
            const failed = (data.results ?? []).filter((r: { success: boolean }) => !r.success)
            if (failed.length > 0) {
              console.warn('[GroupForm] some invites failed:', failed)
              // Don't toast an error — group was created, they'll still join via sign-in
            }
          })
          .catch((err) => console.warn('[GroupForm] invite fetch failed:', err))
      }

      const inviteCount = pendingEmails.length
      toast.success(
        inviteCount > 0
          ? `Trip created · invite${inviteCount > 1 ? 's' : ''} sent to ${inviteCount} person${inviteCount > 1 ? 's' : ''}`
          : 'Trip created!'
      )
      if (onSuccess) onSuccess(id)
      else router.push(`/groups/${id}`)
    } catch {
      toast.error('Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Trip name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_GROUP_NAME_LENGTH}
          placeholder="e.g. Jibhi June 2026"
          className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Optional notes about this trip"
          className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all resize-none"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all scheme-dark"
          />
        </div>
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all scheme-dark"
          />
        </div>
      </div>

      {/* Cover color */}
      <div>
        <label className="block text-[#8E8E9A] text-xs font-medium mb-2">Color</label>
        <div className="flex gap-2">
          {GROUP_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCoverColor(c.value)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{ backgroundColor: c.value }}
              title={c.name}
            >
              {coverColor === c.value && <Check size={12} className="text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      {/* Members */}
      <div>
        <label className="block text-[#8E8E9A] text-xs font-medium mb-2">
          Members ({members.length} added)
        </label>

        {/* Tag pills + input */}
        <div
          className="min-h-11 w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-2 py-2 flex flex-wrap gap-1.5 items-center cursor-text focus-within:border-[#7C6BF8] focus-within:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
          onClick={() => inputRef.current?.focus()}
        >
          {members.map((entry, i) => (
            <MemberPill
              key={entry.type === 'user' ? entry.user.uid : entry.email}
              entry={entry}
              isSelf={entry.type === 'user' && entry.user.uid === user?.uid}
              onRemove={() => removeMember(i)}
            />
          ))}

          <div className="relative flex-1 min-w-40">
            <input
              ref={inputRef}
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value)
                setEmailError('')
                setShowDropdown(true)
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay so click on dropdown item registers
                setTimeout(() => setShowDropdown(false), 150)
              }}
              onFocus={() => { if (emailInput) setShowDropdown(true) }}
              placeholder={members.length === 0 ? 'Type name or email…' : 'Add more…'}
              disabled={fetching || emailLoading}
              className="w-full bg-transparent border-none outline-none text-[#F2F2F7] text-sm placeholder-faint py-0.5 disabled:opacity-50"
            />

            {/* Autocomplete dropdown */}
            {showDropdown && dropdownUsers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A1F] border border-[#2A2A32] rounded-sm shadow-lg z-20 max-h-48 overflow-y-auto">
                {dropdownUsers.map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addExistingUser(u) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[rgba(124,107,248,0.08)] text-left transition-colors"
                  >
                    <UserAvatar user={u} size={28} />
                    <div className="min-w-0">
                      <p className="text-[#F2F2F7] text-xs font-medium truncate">{u.displayName}</p>
                      <p className="text-faint text-[10px] truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
                {/* Show "invite by email" option if input looks like a full email */}
                {inputLower.includes('@') && !dropdownUsers.some((u) => u.email === inputLower) && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addByEmail(emailInput) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[rgba(124,107,248,0.08)] text-left transition-colors border-t border-[#2A2A32]"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#7C6BF8]/10 border border-accent-border flex items-center justify-center shrink-0">
                      <UserPlus size={13} className="text-[#7C6BF8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#7C6BF8] text-xs font-medium">Invite {inputLower}</p>
                      <p className="text-faint text-[10px]">They&apos;ll join when they sign in</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {emailLoading && <Loader2 size={14} className="text-[#7C6BF8] animate-spin shrink-0" />}
        </div>

        {/* Hint */}
        <p className="text-faint text-[10px] mt-1.5">
          Type a name to search · Type a full @shurutech.com email to invite · Press Enter or comma to add
        </p>

        {emailError && (
          <p className="text-[#F87171] text-xs mt-1 flex items-center gap-1">
            <X size={11} /> {emailError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || fetching}
        className="w-full flex items-center justify-center gap-2 bg-[#7C6BF8] text-white rounded-sm py-3 text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Trip'}
      </button>
    </form>
  )
}

function MemberPill({
  entry, isSelf, onRemove,
}: {
  entry: MemberEntry
  isSelf: boolean
  onRemove: () => void
}) {
  if (entry.type === 'user') {
    const u = entry.user
    return (
      <span className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-accent-dim border border-[rgba(124,107,248,0.2)] text-xs text-[#F2F2F7] max-w-40">
        <UserAvatar user={u} size={20} />
        <span className="truncate">{u.displayName.split(' ')[0]}</span>
        {isSelf ? (
          <span className="text-faint text-[10px]">(you)</span>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className="text-faint hover:text-[#F87171] transition-colors shrink-0"
          >
            <X size={11} />
          </button>
        )}
      </span>
    )
  }

  // Pending invite pill
  return (
    <span className="inline-flex items-center gap-1.5 pl-2 pr-2 py-0.5 rounded-full bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] text-xs text-warning max-w-50">
      <Mail size={11} className="shrink-0" />
      <span className="truncate">{entry.email.split('@')[0]}</span>
      <span className="text-[rgba(251,191,36,0.5)] text-[10px] shrink-0">invited</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-[rgba(251,191,36,0.4)] hover:text-[#F87171] transition-colors shrink-0"
      >
        <X size={11} />
      </button>
    </span>
  )
}
