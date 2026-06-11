'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { signOut } from '@/lib/auth'
import { getUserById, updateUserUPI } from '@/lib/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { LogOut, Wallet, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/

export default function ProfilePage() {
  const { user } = useAuthContext()
  const router   = useRouter()

  const [upiId,    setUpiId]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [fetched,  setFetched]  = useState(false)

  useEffect(() => {
    if (!user) return
    getUserById(user.uid).then((u) => {
      if (u?.upiId) setUpiId(u.upiId)
      setFetched(true)
    })
  }, [user])

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    router.replace('/')
  }

  async function handleSaveUPI() {
    if (!user) return
    if (upiId && !UPI_RE.test(upiId)) {
      toast.error('Enter a valid UPI ID (e.g. name@upi)')
      return
    }
    setSaving(true)
    try {
      await updateUserUPI(user.uid, upiId)
      // Clear the "prompt shown" flag so it doesn't bug them again
      if (typeof window !== 'undefined') localStorage.removeItem('upi_prompt_dismissed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      toast.success(upiId ? 'UPI ID saved' : 'UPI ID removed')
    } catch {
      toast.error('Failed to save UPI ID')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-sm mx-auto space-y-6 pt-4">
      <h1 className="font-display font-bold text-2xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
        Profile
      </h1>

      {/* Identity card */}
      <div className="rounded-md border border-[#2A2A32] bg-[#111113] p-6 flex items-center gap-4">
        <UserAvatar user={{ displayName: user.displayName ?? '', photoURL: user.photoURL ?? '', uid: user.uid, email: user.email ?? '' }} size={48} />
        <div className="min-w-0">
          <p className="text-[#F2F2F7] font-semibold truncate">{user.displayName}</p>
          <p className="text-[#8E8E9A] text-sm truncate">{user.email}</p>
        </div>
      </div>

      {/* UPI ID */}
      <div className="rounded-md border border-[#2A2A32] bg-[#111113] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet size={15} className="text-[#7C6BF8] shrink-0" />
          <p className="text-[#F2F2F7] text-sm font-medium">UPI ID</p>
        </div>
        <p className="text-[#8E8E9A] text-xs leading-relaxed">
          Save your UPI ID so teammates can pay you directly from the balances screen.
        </p>
        <div className="flex gap-2">
          <input
            value={upiId}
            onChange={(e) => { setUpiId(e.target.value); setSaved(false) }}
            placeholder={fetched ? 'yourname@upi' : 'Loading…'}
            disabled={!fetched}
            className="flex-1 min-w-0 bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSaveUPI}
            disabled={saving || !fetched}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm font-medium transition-all shrink-0 whitespace-nowrap ${
              saved
                ? 'bg-success-dim border border-[rgba(52,211,153,0.25)] text-success'
                : 'bg-[#7C6BF8] text-white hover:bg-[#6B5CE7] disabled:opacity-50'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
        {upiId && !UPI_RE.test(upiId) && (
          <p className="text-[#F87171] text-xs">Format: name@upi or number@bank</p>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm border border-[#F87171]/30 bg-[rgba(248,113,113,0.08)] text-[#F87171] text-sm font-medium hover:bg-[rgba(248,113,113,0.15)] transition-colors duration-150"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )
}
