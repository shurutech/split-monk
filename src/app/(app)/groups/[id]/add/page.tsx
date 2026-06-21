'use client'

import { use, useEffect, useMemo, useState } from 'react'
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
import { ArrowLeft, Check, Loader2, Utensils, Hotel, Car, Target, ShoppingBag, MoreHorizontal, Mail, Users } from 'lucide-react'
import { toast } from 'sonner'

const SPLIT_TYPES = ['equal', 'exact', 'percentage'] as const
type SplitType = typeof SPLIT_TYPES[number]

const CAT_ICONS: Record<string, React.ReactNode> = {
  food:      <Utensils size={16} />,
  stay:      <Hotel size={16} />,
  transport: <Car size={16} />,
  activity:  <Target size={16} />,
  shopping:  <ShoppingBag size={16} />,
  other:     <MoreHorizontal size={16} />,
}

interface PendingMember { type: 'pending'; email: string; key: string }
interface ResolvedMember { type: 'resolved'; user: User; key: string }
type SplitMember = ResolvedMember | PendingMember

export default function AddExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params)
  const { user }  = useAuthContext()
  const { group } = useGroup(id)
  const router    = useRouter()

  const [splitMembers, setSplitMembers] = useState<SplitMember[]>([])
  const [title,        setTitle]        = useState('')
  const [amountStr,    setAmountStr]    = useState('')
  const [paidBy,       setPaidBy]       = useState(user?.uid ?? '')
  const [multiPayer,   setMultiPayer]   = useState(false)
  const [paymentAmts,  setPaymentAmts]  = useState<Record<string, string>>({}) // uid → rupee string
  const [splitType,    setSplitType]    = useState<SplitType>('equal')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [category,     setCategory]     = useState<Expense['category']>('other')
  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0])
  const [notes,        setNotes]        = useState('')
  const [exactAmts,    setExactAmts]    = useState<Record<string, string>>({})
  const [percentages,  setPercentages]  = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    if (!group) return
    getAllUsers().then((users) => {
      const resolved: SplitMember[] = users
        .filter((u) => group.members.includes(u.uid))
        .map((u) => ({ type: 'resolved', user: u, key: u.uid }))
      const pending: SplitMember[] = (group.pendingInvites ?? [])
        .map((email) => ({ type: 'pending', email, key: email }))
      const all = [...resolved, ...pending]
      setSplitMembers(all)
      setSelectedKeys(all.map((m) => m.key))
      setPaidBy((prev) => prev || user?.uid || (resolved[0]?.key ?? ''))
      const initAmt: Record<string, string> = {}
      const initPct: Record<string, string> = {}
      const initPay: Record<string, string> = {}
      all.forEach((m) => { initAmt[m.key] = ''; initPct[m.key] = ''; initPay[m.key] = '' })
      setExactAmts(initAmt)
      setPercentages(initPct)
      setPaymentAmts(initPay)
    })
  }, [group])

  useEffect(() => { if (user) setPaidBy((prev) => prev || user.uid) }, [user])

  const amountPaise     = toPaise(parseFloat(amountStr) || 0)
  const resolvedMembers = splitMembers.filter((m): m is ResolvedMember => m.type === 'resolved')

  // Multi-payer: payments keyed by uid with paise value, only non-zero entries
  const paymentsMap = useMemo<Record<string, number>>(() => {
    if (!multiPayer) return {}
    const result: Record<string, number> = {}
    resolvedMembers.forEach(({ key }) => {
      const val = toPaise(parseFloat(paymentAmts[key] ?? '') || 0)
      if (val > 0) result[key] = val
    })
    return result
  }, [multiPayer, paymentAmts, resolvedMembers])

  const paymentsTotal = useMemo(
    () => Object.values(paymentsMap).reduce((a, b) => a + b, 0),
    [paymentsMap],
  )

  const paymentsError = useMemo(() => {
    if (!multiPayer || !amountPaise) return null
    if (Object.keys(paymentsMap).length < 2) return 'At least 2 people must have paid'
    if (paymentsTotal !== amountPaise) {
      const diff = amountPaise - paymentsTotal
      return `Amounts are off by ${formatINR(Math.abs(diff))} — ${diff > 0 ? 'add more' : 'reduce'}`
    }
    return null
  }, [multiPayer, amountPaise, paymentsMap, paymentsTotal])

  // For equal split preview, use first payer uid (doesn't affect balance since multi-payer handled separately)
  const effectivePaidBy = multiPayer ? (Object.keys(paymentsMap)[0] ?? paidBy) : paidBy

  function getSplitPreview(): { key: string; amount: number; error?: string }[] {
    if (!amountPaise || selectedKeys.length === 0) return []
    if (splitType === 'equal') {
      const splits = calculateEqualSplit(amountPaise, selectedKeys, effectivePaidBy)
      return selectedKeys.map((key) => ({ key, amount: splits[key] ?? 0 }))
    }
    if (splitType === 'exact') {
      const input: Record<string, number> = {}
      selectedKeys.forEach((key) => { input[key] = toPaise(parseFloat(exactAmts[key]) || 0) })
      const { splits, error } = calculateExactSplit(amountPaise, input)
      return selectedKeys.map((key) => ({ key, amount: splits[key] ?? 0, error: error ?? undefined }))
    }
    if (splitType === 'percentage') {
      const input: Record<string, number> = {}
      selectedKeys.forEach((key) => { input[key] = parseFloat(percentages[key]) || 0 })
      const { splits, error } = calculatePercentageSplit(amountPaise, input)
      return selectedKeys.map((key) => ({ key, amount: splits[key] ?? 0, error: error ?? undefined }))
    }
    return []
  }

  const preview      = getSplitPreview()
  const previewError = preview.find((p) => p.error)?.error
  const exactSum     = selectedKeys.reduce((a, key) => a + toPaise(parseFloat(exactAmts[key]) || 0), 0)
  const pctSum       = selectedKeys.reduce((a, key) => a + (parseFloat(percentages[key]) || 0), 0)

  function memberDisplayName(m: SplitMember) {
    if (m.type === 'pending') return m.email.split('@')[0]
    return m.user.uid === user?.uid ? 'You' : m.user.displayName.split(' ')[0]
  }

  function toggleMember(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function handleToggleMultiPayer() {
    setMultiPayer((v) => {
      if (!v) {
        // Switching to multi-payer — pre-fill current single payer's amount
        setPaymentAmts((prev) => ({
          ...prev,
          [paidBy]: amountStr,
        }))
      } else {
        // Switching back to single — reset payment amounts
        setPaymentAmts((prev) => {
          const reset: Record<string, string> = {}
          Object.keys(prev).forEach((k) => { reset[k] = '' })
          return reset
        })
      }
      return !v
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !group) return
    if (!title.trim())           { toast.error('Title is required'); return }
    if (!amountPaise)            { toast.error('Amount is required'); return }
    if (amountPaise < MIN_EXPENSE_AMOUNT_PAISE) { toast.error('Minimum amount is ₹1'); return }
    if (amountPaise > MAX_EXPENSE_AMOUNT_PAISE) { toast.error('Maximum amount is ₹1,00,000'); return }
    if (selectedKeys.length < 1) { toast.error('Select at least 1 person to split with'); return }
    if (multiPayer && paymentsError) { toast.error(paymentsError); return }
    if (!multiPayer && !paidBy)  { toast.error('Select who paid'); return }
    if (previewError)            { toast.error(previewError); return }

    let finalSplits: Record<string, number> = {}
    if (splitType === 'equal') {
      finalSplits = calculateEqualSplit(amountPaise, selectedKeys, effectivePaidBy)
    } else if (splitType === 'exact') {
      const input: Record<string, number> = {}
      selectedKeys.forEach((key) => { input[key] = toPaise(parseFloat(exactAmts[key]) || 0) })
      const { splits, error } = calculateExactSplit(amountPaise, input)
      if (error) { toast.error(error); return }
      finalSplits = splits
    } else {
      const input: Record<string, number> = {}
      selectedKeys.forEach((key) => { input[key] = parseFloat(percentages[key]) || 0 })
      const { splits, error } = calculatePercentageSplit(amountPaise, input)
      if (error) { toast.error(error); return }
      finalSplits = splits
    }

    setLoading(true)
    try {
      await addExpense(id, {
        title:    title.trim(),
        amount:   amountPaise,
        paidBy:   multiPayer ? 'multiple' : paidBy,
        payments: multiPayer ? paymentsMap : undefined,
        splitType,
        splits:   finalSplits,
        date:     new Date(date),
        notes:    notes.trim() || undefined,
        category,
        createdBy: user.uid,
      })
      toast.success('Expense added!')
      router.push(`/groups/${id}`)
    } catch (err) {
      console.error('[addExpense]', err)
      toast.error(err instanceof Error ? err.message : 'Failed to add expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-36 md:pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
          Add Expense
        </h1>
      </div>

      <form id="add-expense-form" onSubmit={handleSubmit} className="space-y-5">

        {/* ── Amount hero ─────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <label className="block text-faint text-xs uppercase tracking-wide mb-3">Amount (₹)</label>
          <div className="flex items-center justify-center gap-2">
            <span className="text-faint font-mono text-4xl">₹</span>
            <input
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              min="1"
              step="1"
              autoFocus
              className="bg-transparent border-none outline-none text-[#F2F2F7] font-mono text-4xl font-bold w-36 sm:w-48 text-center placeholder-[#2A2A32]"
            />
          </div>
          <div className="mt-1 h-px bg-linear-to-r from-transparent via-[#7C6BF8] to-transparent" />
        </div>

        {/* ── Title ───────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">What for? *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Dinner at Café Himachal"
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
          />
        </div>

        {/* ── Category ────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-2">Category</label>
          <div className="grid grid-cols-6 gap-2">
            {EXPENSE_CATEGORIES.map((cat) => {
              const selected = category === cat.value
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value as Expense['category'])}
                  title={cat.label}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-sm border text-[10px] font-medium transition-all ${
                    selected
                      ? 'bg-[rgba(124,107,248,0.15)] border-[rgba(124,107,248,0.4)] text-[#7C6BF8]'
                      : 'bg-[#1A1A1F] border-[#2A2A32] text-[#8E8E9A] hover:border-faint'
                  }`}
                >
                  {CAT_ICONS[cat.value]}
                  <span className="truncate w-full text-center">{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Paid by ─────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[#8E8E9A] text-xs font-medium">Paid by</label>
            <button
              type="button"
              onClick={handleToggleMultiPayer}
              className="flex items-center gap-2 group"
              aria-pressed={multiPayer}
            >
              <span className={`text-[11px] font-medium transition-colors ${multiPayer ? 'text-[#7C6BF8]' : 'text-faint'}`}>
                Multiple people paid
              </span>
              {/* iOS-style toggle track */}
              <span className={`relative inline-block h-5.5 w-9.5 shrink-0 rounded-full transition-colors duration-200 ${
                multiPayer ? 'bg-[#7C6BF8]' : 'bg-[#2A2A32]'
              }`}>
                {/* Thumb */}
                <span className={`absolute top-0.75 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
                  multiPayer ? 'left-4.75' : 'left-0.75'
                }`} />
              </span>
            </button>
          </div>

          {!multiPayer ? (
            /* Single payer — avatar chip row */
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {resolvedMembers.map(({ user: u }) => {
                const selected = paidBy === u.uid
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => setPaidBy(u.uid)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-sm border shrink-0 transition-all ${
                      selected
                        ? 'bg-[rgba(124,107,248,0.15)] border-[rgba(124,107,248,0.4)]'
                        : 'bg-[#1A1A1F] border-[#2A2A32] hover:border-faint'
                    }`}
                  >
                    <div className="relative">
                      <UserAvatar user={u} size={32} />
                      {selected && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#7C6BF8] rounded-full flex items-center justify-center">
                          <Check size={8} className="text-white" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium truncate max-w-14 ${selected ? 'text-[#7C6BF8]' : 'text-[#8E8E9A]'}`}>
                      {u.uid === user?.uid ? 'You' : u.displayName.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Multi-payer — amount input per person */
            <div className="border border-[rgba(124,107,248,0.3)] rounded-sm overflow-hidden bg-[#0D0D0F]">
              <div className="px-3 py-2 border-b border-[#1A1A1F]">
                <p className="text-faint text-[11px]">Enter how much each person paid. Must add up to the total amount.</p>
              </div>
              {resolvedMembers.map(({ user: u, key }) => {
                const val    = parseFloat(paymentAmts[key] ?? '') || 0
                const paise  = toPaise(val)
                const hasAmt = paise > 0
                return (
                  <div key={key} className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#1A1A1F] last:border-0 transition-colors ${hasAmt ? 'bg-[#111113]' : ''}`}>
                    <UserAvatar user={u} size={28} />
                    <span className="flex-1 text-[#F2F2F7] text-sm truncate">
                      {u.uid === user?.uid ? 'You' : u.displayName.split(' ')[0]}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-faint text-xs font-mono">₹</span>
                      <input
                        type="number"
                        value={paymentAmts[key] ?? ''}
                        onChange={(e) => setPaymentAmts((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="0"
                        min="0"
                        className="w-20 bg-[#1A1A1F] border border-[#2A2A32] rounded px-2 py-1 text-[#F2F2F7] font-mono text-xs text-right focus:outline-none focus:border-[#7C6BF8] transition-all"
                      />
                    </div>
                  </div>
                )
              })}
              {/* Running total */}
              {amountPaise > 0 && (
                <div className={`flex justify-between px-3 py-2 text-xs font-mono border-t ${
                  paymentsTotal === amountPaise
                    ? 'border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.05)] text-success'
                    : 'border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.05)] text-[#F87171]'
                }`}>
                  <span>Total paid</span>
                  <span>{formatINR(paymentsTotal)} / {formatINR(amountPaise)}</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Split type ──────────────────────────────────────────────────── */}
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

        {/* ── Split among ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[#8E8E9A] text-xs font-medium">
              Split among
              <span className="ml-1.5 text-[#7C6BF8] font-semibold">{selectedKeys.length}</span>
              <span className="text-faint">/{splitMembers.length}</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedKeys(splitMembers.map((m) => m.key))}
                className="text-[10px] text-[#7C6BF8] hover:underline"
              >
                All
              </button>
              <span className="text-faint text-[10px]">·</span>
              <button
                type="button"
                onClick={() => setSelectedKeys([])}
                className="text-[10px] text-[#8E8E9A] hover:text-[#F2F2F7]"
              >
                None
              </button>
            </div>
          </div>

          {/* Equal split: compact avatar-chip grid */}
          {splitType === 'equal' && (
            <div className="flex flex-wrap gap-2">
              {splitMembers.map((member) => {
                const key       = member.key
                const selected  = selectedKeys.includes(key)
                const isPending = member.type === 'pending'
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMember(key)}
                    className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      selected
                        ? 'bg-accent-dim border-[rgba(124,107,248,0.35)] text-[#F2F2F7]'
                        : 'bg-[#111113] border-[#2A2A32] text-faint'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      selected ? 'bg-[#7C6BF8] border-[#7C6BF8]' : 'border-[#2A2A32]'
                    }`}>
                      {selected && <Check size={9} className="text-white" strokeWidth={3} />}
                    </span>
                    {isPending ? (
                      <div className="w-5 h-5 rounded-full bg-[rgba(251,191,36,0.1)] border border-[rgba(251,191,36,0.2)] flex items-center justify-center shrink-0">
                        <Mail size={10} className="text-warning" />
                      </div>
                    ) : (
                      <UserAvatar user={member.user} size={20} />
                    )}
                    <span className="truncate max-w-20">{memberDisplayName(member)}</span>
                    {selected && amountPaise > 0 && (
                      <span className="text-[#7C6BF8] font-mono text-[10px] ml-0.5">
                        {formatINR(calculateEqualSplit(amountPaise, selectedKeys, effectivePaidBy)[key] ?? 0)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Exact / percentage: scrollable compact list */}
          {(splitType === 'exact' || splitType === 'percentage') && (
            <div className="border border-[#2A2A32] rounded-sm overflow-hidden">
              <div className="overflow-y-auto max-h-72">
                {splitMembers.map((member) => {
                  const key       = member.key
                  const selected  = selectedKeys.includes(key)
                  const isPending = member.type === 'pending'
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#1A1A1F] last:border-0 transition-colors ${
                        selected ? 'bg-[#111113]' : 'bg-background opacity-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleMember(key)}
                        className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          selected ? 'bg-[#7C6BF8] border-[#7C6BF8]' : 'border-[#2A2A32]'
                        }`}
                      >
                        {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                      </button>
                      {isPending ? (
                        <div className="w-7 h-7 rounded-full bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] flex items-center justify-center shrink-0">
                          <Mail size={13} className="text-warning" />
                        </div>
                      ) : (
                        <UserAvatar user={member.user} size={28} />
                      )}
                      <span className="flex-1 text-[#F2F2F7] text-sm truncate">{memberDisplayName(member)}</span>
                      {isPending && (
                        <span className="text-warning text-[10px] font-medium shrink-0">invited</span>
                      )}
                      {splitType === 'exact' && selected && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-faint text-xs font-mono">₹</span>
                          <input
                            type="number"
                            value={exactAmts[key] ?? ''}
                            onChange={(e) => setExactAmts((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="0"
                            min="0"
                            className="w-16 sm:w-20 bg-[#1A1A1F] border border-[#2A2A32] rounded px-2 py-1 text-[#F2F2F7] font-mono text-xs text-right focus:outline-none focus:border-[#7C6BF8] transition-all"
                          />
                        </div>
                      )}
                      {splitType === 'percentage' && selected && (
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            value={percentages[key] ?? ''}
                            onChange={(e) => setPercentages((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="0"
                            min="0"
                            max="100"
                            className="w-16 bg-[#1A1A1F] border border-[#2A2A32] rounded px-2 py-1 text-[#F2F2F7] font-mono text-xs text-right focus:outline-none focus:border-[#7C6BF8] transition-all"
                          />
                          <span className="text-faint text-xs">%</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {splitType === 'exact' && amountPaise > 0 && (
                <div className={`flex justify-between px-3 py-2 text-xs font-mono border-t ${
                  exactSum === amountPaise
                    ? 'border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.05)] text-success'
                    : 'border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.05)] text-[#F87171]'
                }`}>
                  <span>Total entered</span>
                  <span>{formatINR(exactSum)} / {formatINR(amountPaise)}</span>
                </div>
              )}
              {splitType === 'percentage' && (
                <div className={`flex justify-between px-3 py-2 text-xs font-mono border-t ${
                  Math.abs(pctSum - 100) < 0.01
                    ? 'border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.05)] text-success'
                    : 'border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.05)] text-[#F87171]'
                }`}>
                  <span>Total %</span>
                  <span>{pctSum.toFixed(1)}% / 100%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Date ────────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all scheme-dark"
          />
        </div>

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Receipt details, context…"
            className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all resize-none"
          />
        </div>

      </form>

      {/* ── Sticky submit bar ───────────────────────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t border-[#2A2A32] px-4 py-3 md:relative md:bottom-auto md:border-0 md:bg-transparent md:backdrop-blur-none md:px-0 md:py-0 md:mt-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {/* Live hint */}
          {multiPayer && paymentsError && amountPaise > 0 && (
            <p className="flex-1 text-[#F87171] text-xs truncate">{paymentsError}</p>
          )}
          {!multiPayer && amountPaise > 0 && selectedKeys.length > 0 && !previewError && splitType === 'equal' && (
            <div className="flex-1 text-xs text-[#8E8E9A] truncate">
              <span className="text-[#F2F2F7] font-mono font-medium">
                {formatINR(calculateEqualSplit(amountPaise, selectedKeys, effectivePaidBy)[user?.uid ?? ''] ?? 0)}
              </span>
              <span className="ml-1">your share</span>
            </div>
          )}
          {previewError && (
            <p className="flex-1 text-[#F87171] text-xs truncate">{previewError}</p>
          )}
          <button
            form="add-expense-form"
            type="submit"
            disabled={loading}
            className="ml-auto flex items-center gap-2 bg-[#7C6BF8] text-white rounded-sm px-6 py-3 text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Adding…</> : 'Add Expense'}
          </button>
        </div>
      </div>

    </div>
  )
}
