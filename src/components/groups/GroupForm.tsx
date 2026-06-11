'use client'

import { useState, useEffect } from 'react'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { getAllUsers } from '@/lib/firestore'
import { createGroup } from '@/lib/firestore'
import { GROUP_COLORS, MAX_GROUP_NAME_LENGTH, MIN_GROUP_MEMBERS } from '@/constants'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { User } from '@/types'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'

export function GroupForm({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const { user }  = useAuthContext()
  const router    = useRouter()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [startDate,   setStartDate]   = useState('')
  const [endDate,     setEndDate]     = useState('')
  const [coverColor,  setCoverColor]  = useState(GROUP_COLORS[0].value)
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [allUsers,    setAllUsers]    = useState<User[]>([])
  const [loading,     setLoading]     = useState(false)
  const [fetching,    setFetching]    = useState(true)

  useEffect(() => {
    getAllUsers().then((users) => {
      setAllUsers(users)
      // Auto-select current user
      if (user) setSelectedUids([user.uid])
      setFetching(false)
    })
  }, [user])

  function toggleMember(uid: string) {
    if (uid === user?.uid) return // can't deselect self
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!name.trim()) { toast.error('Group name is required'); return }
    if (selectedUids.length < MIN_GROUP_MEMBERS) {
      toast.error(`Add at least ${MIN_GROUP_MEMBERS} members`)
      return
    }

    setLoading(true)
    try {
      const id = await createGroup({
        name:        name.trim(),
        description: description.trim() || undefined,
        members:     selectedUids,
        startDate:   startDate ? new Date(startDate) : undefined,
        endDate:     endDate   ? new Date(endDate)   : undefined,
        coverColor,
        createdBy:   user.uid,
      })
      toast.success('Trip created!')
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
          className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-[#4A4A56] focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
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
          className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-[#4A4A56] focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all resize-none"
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
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all [color-scheme:dark]"
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
          Members ({selectedUids.length} selected)
        </label>
        {fetching ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-sm bg-[#1A1A1F] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1 max-h-52 overflow-y-auto rounded-sm border border-[#2A2A32]">
            {allUsers.map((u) => {
              const isSelected = selectedUids.includes(u.uid)
              const isSelf     = u.uid === user?.uid
              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => toggleMember(u.uid)}
                  disabled={isSelf}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-[rgba(124,107,248,0.08)]' : 'hover:bg-[#1A1A1F]'
                  }`}
                >
                  <UserAvatar user={u} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F2F2F7] text-sm truncate">
                      {u.displayName} {isSelf && <span className="text-[#4A4A56] text-xs">(you)</span>}
                    </p>
                    <p className="text-[#4A4A56] text-xs truncate">{u.email}</p>
                  </div>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-[#7C6BF8] border-[#7C6BF8]' : 'border-[#2A2A32]'
                  }`}>
                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#7C6BF8] text-white rounded-sm py-3 text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Trip'}
      </button>
    </form>
  )
}
