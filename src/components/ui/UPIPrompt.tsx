'use client'

import { useEffect, useState } from 'react'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { getUserById, updateUserUPI } from '@/lib/firestore'
import { Wallet, X, Check, Loader2, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'upi_prompt_dismissed'
const UPI_RE      = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/

export function UPIPrompt() {
  const { user }              = useAuthContext()
  const [visible, setVisible] = useState(false)
  const [upiId,   setUpiId]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)

  useEffect(() => {
    if (!user) return
    // Already dismissed — never show again
    if (localStorage.getItem(STORAGE_KEY)) return

    getUserById(user.uid).then((u) => {
      if (u?.upiId) return  // already has one
      // Delay 5 s so the page loads first
      const t = setTimeout(() => setVisible(true), 5000)
      return () => clearTimeout(t)
    })
  }, [user])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  async function handleSave() {
    if (!user) return
    if (upiId && !UPI_RE.test(upiId)) return
    setSaving(true)
    try {
      await updateUserUPI(user.uid, upiId)
      localStorage.setItem(STORAGE_KEY, '1')
      setDone(true)
      setTimeout(() => setVisible(false), 1200)
    } catch {
      // silent — they can set it in profile
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Sheet */}
      <div className="w-full max-w-sm bg-[#111113] border border-[#2A2A32] rounded-xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[rgba(124,107,248,0.12)] border border-[rgba(124,107,248,0.2)] flex items-center justify-center shrink-0">
              <Wallet size={16} className="text-[#7C6BF8]" />
            </div>
            <div>
              <p className="text-[#F2F2F7] text-sm font-semibold">Add your UPI ID</p>
              <p className="text-[#8E8E9A] text-xs mt-0.5">So teammates can pay you directly</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-faint hover:text-[#F2F2F7] transition-colors mt-0.5 shrink-0">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="flex items-center justify-center gap-2 py-3 text-success text-sm font-medium">
            <Check size={16} /> Saved!
          </div>
        ) : (
          <>
            <input
              autoFocus
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="yourname@upi"
              className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
            />
            {upiId && !UPI_RE.test(upiId) && (
              <p className="text-[#F87171] text-xs -mt-2">Format: name@upi or 9876543210@ybl</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={dismiss}
                className="flex-1 py-2.5 rounded-sm border border-[#2A2A32] text-[#8E8E9A] text-sm hover:text-[#F2F2F7] hover:border-faint transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!!upiId && !UPI_RE.test(upiId))}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-sm bg-[#7C6BF8] text-white text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-50 transition-colors"
              >
                {saving
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ArrowRight size={14} />
                }
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
