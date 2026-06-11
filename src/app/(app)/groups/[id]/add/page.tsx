'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useGroup } from '@/hooks/useGroup'
import { getAllUsers, addExpense } from '@/lib/firestore'
import {
  toPaise, formatINR,
  calculateEqualSplit, calculateExactSplit, calculatePercentageSplit,
} from '@/lib/calculations'
import { EXPENSE_CATEGORIES, MAX_EXPENSE_AMOUNT_PAISE, MIN_EXPENSE_AMOUNT_PAISE } from '@/constants'
import { User, Expense } from '@/types'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ArrowLeft, Check, Loader2, Utensils, Hotel, Car, Target, ShoppingBag, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'

const SPLIT_TYPES = ['equal', 'exact', 'percentage'] as const
type SplitType = typeof SPLIT_TYPES[number]

const CAT_ICONS: Record<string, React.ReactNode> = {
  food: <Utensils size={14} />, stay: <Hotel size={14} />, transport: <Car size={14} />,
  activity: <Target size={14} />, shopping: <ShoppingBag size={14} />, other: <MoreHorizontal size={14} />,
}

export default function AddExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id }         = use(params)
  const { user }       = useAuthContext()
  const { group }      = useGroup(id)
  const router         = useRouter()

  const [allUsers,     setAllUsers]     = useState<User[]>([])
  const [title,        setTitle]        = useState('')
  const [amountStr,    setAmountStr]    = useState('')
  const [paidBy,       setPaidBy]       = useState(user?.uid ?? '')
  const [splitType,    setSplitType]    = useState<SplitType>('equal')
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [category,     setCategory]     = useState<Expense['category']>('other')
  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0])
  const [notes,        setNotes]        = useState('')
  const [exactAmts,    setExactAmts]    = useState<Record<string, string>>({})
  const [percentages,  setPercentages]  = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    if (!group) return
    getAllUsers().then((users) => {
      const members = users.filter((u) => group.members.includes(u.uid))
      setAllUsers(members)
      setSelectedUids(group.members)
      const initAmt: Record<string, string>  = {}
      const initPct: Record<string, string>  = {}
      group.members.forEach((uid) => { initAmt[uid] = ''; initPct[uid] = '' })
      setExactAmts(initAmt)
      setPercentages(initPct)
    })
  }, [group])

  useEffect(() => { if (user) setPaidBy(user.uid) }, [user])

  const amountPaise = toPaise(parseFloat(amountStr) || 0)

  // ── Live split preview ──────────────────────────────────────────────────────

  function getSplitPreview(): { uid: string; amount: number; error?: string }[] {
    if (!amountPaise || selectedUids.length === 0) return []
    if (splitType === 'equal') {
      const splits = calculateEqualSplit(amountPaise, selectedUids, paidBy)
      return selectedUids.map((uid) => ({ uid, amount: splits[uid] ?? 0 }))
    }
    if (splitType === 'exact') {
      const splitInput: Record<string, number> = {}
      selectedUids.forEach((uid) => { splitInput[uid] = toPaise(parseFloat(exactAmts[uid]) || 0) })
      const { splits, error } = calculateExactSplit(amountPaise, splitInput)
      return selectedUids.map((uid) => ({ uid, amount: splits[uid] ?? 0, error: error ?? undefined }))
    }
    if (splitType === 'percentage') {
      const pctInput: Record<string, number> = {}
      selectedUids.forEach((uid) => { pctInput[uid] = parseFloat(percentages[uid]) || 0 })
      const { splits, error } = calculatePercentageSplit(amountPaise, pctInput)
      return selectedUids.map((uid) => ({ uid, amount: splits[uid] ?? 0, error: error ?? undefined }))
    }
    return []
  }

  const preview = getSplitPreview()
  const previewError = preview.find((p) => p.error)?.error

  // ── Validation summary for exact/percentage ──────────────────────────────

  const exactSum = selectedUids.reduce((a, uid) => a + toPaise(parseFloat(exactAmts[uid]) || 0), 0)
  const pctSum   = selectedUids.reduce((a, uid) => a + (parseFloat(percentages[uid]) || 0), 0)

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !group) return

    if (!title.trim())             { toast.error('Title is required'); return }
    if (!amountPaise)              { toast.error('Amount is required'); return }
    if (amountPaise < MIN_EXPENSE_AMOUNT_PAISE) { toast.error('Minimum amount is ₹1'); return }
    if (amountPaise > MAX_EXPENSE_AMOUNT_PAISE) { toast.error('Maximum amount is ₹1,00,000'); return }
    if (selectedUids.length < 2)   { toast.error('Select at least 2 people'); return }
    if (previewError)              { toast.error(previewError); return }

    let finalSplits: Record<string, number> = {}

    if (splitType === 'equal') {
      finalSplits = calculateEqualSplit(amountPaise, selectedUids, paidBy)
    } else if (splitType === 'exact') {
      const input: Record<string, number> = {}
      selectedUids.forEach((uid) => { input[uid] = toPaise(parseFloat(exactAmts[uid]) || 0) })
      const { splits, error } = calculateExactSplit(amountPaise, input)
      if (error) { toast.error(error); return }
      finalSplits = splits
    } else {
      const input: Record<string, number> = {}
      selectedUids.forEach((uid) => { input[uid] = parseFloat(percentages[uid]) || 0 })
      const { splits, error } = calculatePercentageSplit(amountPaise, input)
      if (error) { toast.error(error); return }
      finalSplits = splits
    }

    setLoading(true)
    try {
      await addExpense(id, {
        title:     title.trim(),
        amount:    amountPaise,
        paidBy,
        splitType,
        splits:    finalSplits,
        date:      new Date(date),
        notes:     notes.trim() || undefined,
        category,
        createdBy: user.uid,
      })
      toast.success('Expense added!')
      router.push(`/groups/${id}`)
    } catch {
      toast.error('Failed to add expense')
    } finally {
      setLoading(false)
    }
  }

  function toggleMember(uid: string) {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]
    )
  }

  const groupMembers = allUsers.filter((u) => group?.members.includes(u.uid))

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
          Add Expense
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Amount — hero input */}
        <div className="text-center py-4">
          <label className="block text-[#4A4A56] text-xs uppercase tracking-wide mb-3">Amount (₹)</label>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[#4A4A56] font-mono text-4xl">₹</span>
            <input
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              min="1"
              step="1"
              className="bg-transparent border-none outline-none text-[#F2F2F7] font-mono text-4xl font-bold w-48 text-center placeholder-[#2A2A32]"
            />
          </div>
          <div className="mt-1 h-px bg-gradient-to-r from-transparent via-[#7C6BF8] to-transparent" />
        </div>

        {/* Title */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">What for? *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Dinner at Café Himachal"
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-[#4A4A56] focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
          />
        </div>

        {/* Paid by */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-2">Paid by</label>
          <div className="flex gap-2 flex-wrap">
            {groupMembers.map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => setPaidBy(u.uid)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  paidBy === u.uid
                    ? 'bg-[rgba(124,107,248,0.15)] border-[rgba(124,107,248,0.4)] text-[#7C6BF8]'
                    : 'bg-[#1A1A1F] border-[#2A2A32] text-[#8E8E9A] hover:border-[#4A4A56]'
                }`}
              >
                <UserAvatar user={u} size={20} />
                {u.uid === user?.uid ? 'You' : u.displayName.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-2">Category</label>
          <div className="flex gap-2 flex-wrap">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value as Expense['category'])}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border transition-all ${
                  category === cat.value
                    ? 'bg-[rgba(124,107,248,0.15)] border-[rgba(124,107,248,0.4)] text-[#7C6BF8]'
                    : 'bg-[#1A1A1F] border-[#2A2A32] text-[#8E8E9A] hover:border-[#4A4A56]'
                }`}
              >
                {CAT_ICONS[cat.value]} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Split type */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-2">Split type</label>
          <div className="flex bg-[#111113] border border-[#2A2A32] rounded-sm p-1 gap-1">
            {SPLIT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSplitType(t)}
                className={`flex-1 py-1.5 rounded text-xs font-medium capitalize transition-all ${
                  splitType === t ? 'bg-[#7C6BF8] text-white' : 'text-[#8E8E9A] hover:text-[#F2F2F7]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Split among + inputs */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-2">
            Split among ({selectedUids.length})
          </label>
          <div className="space-y-1 border border-[#2A2A32] rounded-sm overflow-hidden">
            {groupMembers.map((u) => {
              const selected = selectedUids.includes(u.uid)
              return (
                <div
                  key={u.uid}
                  className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${selected ? 'bg-[#111113]' : 'bg-[#0A0A0B] opacity-50'}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMember(u.uid)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      selected ? 'bg-[#7C6BF8] border-[#7C6BF8]' : 'border-[#2A2A32]'
                    }`}
                  >
                    {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </button>
                  <UserAvatar user={u} size={28} />
                  <span className="flex-1 text-[#F2F2F7] text-sm">
                    {u.uid === user?.uid ? 'You' : u.displayName.split(' ')[0]}
                  </span>

                  {/* Exact amount input */}
                  {splitType === 'exact' && selected && (
                    <div className="flex items-center gap-1">
                      <span className="text-[#4A4A56] text-xs font-mono">₹</span>
                      <input
                        type="number"
                        value={exactAmts[u.uid] ?? ''}
                        onChange={(e) => setExactAmts((prev) => ({ ...prev, [u.uid]: e.target.value }))}
                        placeholder="0"
                        min="0"
                        className="w-20 bg-[#1A1A1F] border border-[#2A2A32] rounded px-2 py-1 text-[#F2F2F7] font-mono text-xs text-right focus:outline-none focus:border-[#7C6BF8] transition-all"
                      />
                    </div>
                  )}

                  {/* Percentage input */}
                  {splitType === 'percentage' && selected && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={percentages[u.uid] ?? ''}
                        onChange={(e) => setPercentages((prev) => ({ ...prev, [u.uid]: e.target.value }))}
                        placeholder="0"
                        min="0"
                        max="100"
                        className="w-16 bg-[#1A1A1F] border border-[#2A2A32] rounded px-2 py-1 text-[#F2F2F7] font-mono text-xs text-right focus:outline-none focus:border-[#7C6BF8] transition-all"
                      />
                      <span className="text-[#4A4A56] text-xs">%</span>
                    </div>
                  )}

                  {/* Equal preview */}
                  {splitType === 'equal' && selected && amountPaise > 0 && (
                    <span className="font-mono text-[#8E8E9A] text-xs">
                      {formatINR(calculateEqualSplit(amountPaise, selectedUids, paidBy)[u.uid] ?? 0)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Running total for exact/percentage */}
          {splitType === 'exact' && amountPaise > 0 && (
            <div className={`flex justify-between mt-2 px-1 text-xs font-mono ${exactSum === amountPaise ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
              <span>Total entered</span>
              <span>{formatINR(exactSum)} / {formatINR(amountPaise)}</span>
            </div>
          )}
          {splitType === 'percentage' && (
            <div className={`flex justify-between mt-2 px-1 text-xs font-mono ${Math.abs(pctSum - 100) < 0.01 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
              <span>Total %</span>
              <span>{pctSum.toFixed(1)}% / 100%</span>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all [color-scheme:dark]"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Receipt details, context…"
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-[#4A4A56] focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#7C6BF8] text-white rounded-sm py-3 text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Adding…</> : 'Add Expense'}
        </button>
      </form>
    </div>
  )
}
