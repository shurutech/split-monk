'use client'

import { useState, useEffect, useMemo } from 'react'
import { Balance, Expense, Group, Settlement, SettlementSuggestion, User } from '@/types'
import { formatINR } from '@/lib/calculations'
import { getUserById, recordSettlement } from '@/lib/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ArrowRight, CheckCircle2, Loader2, Mail, History, Smartphone, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  group:               Group
  balances:            Balance[]
  settlements:         SettlementSuggestion[]
  recordedSettlements: Settlement[]
  expenses:            Expense[]
  currentUid:          string
}

function isPendingKey(key: string) { return key.includes('@') }

function buildUpiLink(upiId: string, amount: number, toName: string, groupName: string) {
  const rupees = (amount / 100).toFixed(2)
  const note   = encodeURIComponent(`SplitMonk · ${groupName}`)
  const pn     = encodeURIComponent(toName)
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${pn}&am=${rupees}&cu=INR&tn=${note}`
}

export function BalancesTab({ group, balances, settlements, recordedSettlements, expenses, currentUid }: Props) {
  const [userCache,      setUserCache]      = useState<Record<string, User>>({})
  const [settling,       setSettling]       = useState<string | null>(null)
  const [noteInput,      setNoteInput]      = useState<Record<string, string>>({})
  const [breakdownOpen,  setBreakdownOpen]  = useState(false)

  useEffect(() => {
    const toFetch = new Set<string>([
      ...group.members,
      ...settlements.map((s) => s.to),
    ])
    toFetch.forEach(async (uid) => {
      if (userCache[uid] || isPendingKey(uid)) return
      const u = await getUserById(uid)
      if (u) setUserCache((prev) => ({ ...prev, [uid]: u }))
    })
  }, [group.members, settlements])

  // ── My balance breakdown ──────────────────────────────────────────────────
  const myBreakdown = useMemo(() => {
    const active = expenses.filter((e) => !e.isDeleted)

    // How much I paid that covers OTHER people (not myself)
    let iPaidForOthers = 0
    // How much others paid that covers ME
    let othersPaidForMe = 0
    // Per-person: how much each person's expenses cost me
    const perPerson: Record<string, number> = {}

    active.forEach((e) => {
      if (e.paidBy === currentUid) {
        // I paid — credit me for others' shares
        Object.entries(e.splits).forEach(([key, share]) => {
          if (key !== currentUid) iPaidForOthers += share
        })
      } else {
        // Someone else paid — debit me for my share
        const myShare = e.splits[currentUid] ?? 0
        if (myShare > 0) {
          othersPaidForMe += myShare
          perPerson[e.paidBy] = (perPerson[e.paidBy] ?? 0) + myShare
        }
      }
    })

    return { iPaidForOthers, othersPaidForMe, perPerson }
  }, [expenses, currentUid])


  const myBalance  = balances.find((b) => b.uid === currentUid)
  const allSettled = balances.every((b) => b.net === 0)

  function name(key: string) {
    if (key === currentUid) return 'You'
    if (isPendingKey(key))  return key.split('@')[0]
    return userCache[key]?.displayName?.split(' ')[0] ?? '…'
  }

  function avatar(key: string, size: 20 | 24 | 28 | 32 | 40 | 48 = 32) {
    if (isPendingKey(key)) {
      return (
        <div
          className="rounded-full bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] flex items-center justify-center shrink-0"
          style={{ width: size, height: size }}
        >
          <Mail size={size * 0.44} className="text-warning" />
        </div>
      )
    }
    const u = userCache[key]
    return u
      ? <UserAvatar user={u} size={size} />
      : <div className="rounded-full bg-[#1A1A1F] animate-pulse shrink-0" style={{ width: size, height: size }} />
  }

  async function handleSettle(s: SettlementSuggestion) {
    const key = `${s.from}-${s.to}`
    setSettling(key)
    try {
      await recordSettlement(
        group.id,
        { from: s.from, to: s.to, amount: s.amount, settledBy: currentUid, note: noteInput[key] },
        expenses,
        recordedSettlements,
        group.members,
        group.pendingInvites ?? [],
      )
      setNoteInput((prev) => { const n = { ...prev }; delete n[key]; return n })
      toast.success('Settlement recorded')
    } catch {
      toast.error('Failed to record settlement')
    } finally {
      setSettling(null)
    }
  }

  function handlePayUPI(s: SettlementSuggestion) {
    const receiver = userCache[s.to]
    if (!receiver?.upiId) return
    const link = buildUpiLink(receiver.upiId, s.amount, receiver.displayName, group.name)
    window.open(link, '_blank')
    const key = `${s.from}-${s.to}`
    setNoteInput((prev) => ({ ...prev, [key]: prev[key] || 'UPI' }))
  }

  return (
    <div className="space-y-5">

      {/* ── My balance hero ────────────────────────────────────────────────── */}
      {myBalance && (
        <div className={`rounded-md border ${
          myBalance.net > 0
            ? 'border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.06)]'
            : myBalance.net < 0
              ? 'border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)]'
              : 'border-[#2A2A32] bg-[#111113]'
        }`}>
          {allSettled ? (
            <div className="p-5 text-center">
              <CheckCircle2 size={32} className="text-success mx-auto mb-2" />
              <p className="text-success font-semibold">All settled up 🎉</p>
            </div>
          ) : myBalance.net === 0 ? (
            <div className="p-5 text-center">
              <p className="text-[#8E8E9A]">Your balance is zero</p>
            </div>
          ) : (
            <>
              {/* Top: amount */}
              <div className="px-5 pt-5 pb-3 text-center">
                <p className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-1">
                  {myBalance.net > 0 ? 'You are owed' : 'You owe'}
                </p>
                <p className={`font-mono text-3xl font-bold ${myBalance.net > 0 ? 'text-success' : 'text-[#F87171]'}`}>
                  {formatINR(Math.abs(myBalance.net))}
                </p>
              </div>

              {/* Breakdown rows */}
              <div className="mx-4 mb-4 rounded-sm border border-[#2A2A32] bg-background divide-y divide-[#1A1A1F]">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[#8E8E9A] text-xs">You paid for others</span>
                  <span className="font-mono text-xs text-success font-medium">+{formatINR(myBreakdown.iPaidForOthers)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[#8E8E9A] text-xs">Others paid for you</span>
                  <span className="font-mono text-xs text-[#F87171] font-medium">-{formatINR(myBreakdown.othersPaidForMe)}</span>
                </div>
                {/* Net line */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[#8E8E9A] text-xs font-medium">Net</span>
                  <span className={`font-mono text-xs font-bold ${myBalance.net > 0 ? 'text-success' : 'text-[#F87171]'}`}>
                    {myBalance.net > 0 ? '+' : ''}{formatINR(myBalance.net)}
                  </span>
                </div>
              </div>

              {/* Per-person breakdown toggle */}
              {Object.keys(myBreakdown.perPerson).length > 0 && (
                <div className="mx-4 mb-4">
                  <button
                    onClick={() => setBreakdownOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint text-xs transition-colors"
                  >
                    <span>Who you owe — by person</span>
                    {breakdownOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {breakdownOpen && (
                    <div className="mt-1.5 rounded-sm border border-[#2A2A32] bg-background overflow-hidden divide-y divide-[#1A1A1F]">
                      {Object.entries(myBreakdown.perPerson)
                        .sort((a, b) => b[1] - a[1])
                        .map(([uid, amount]) => (
                          <div key={uid} className="flex items-center gap-2.5 px-3 py-2.5">
                            {avatar(uid, 24)}
                            <span className="flex-1 text-[#F2F2F7] text-xs truncate">{name(uid)}</span>
                            <span className="font-mono text-xs text-[#F87171]">-{formatINR(amount)}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Suggested settlements ──────────────────────────────────────────── */}
      {settlements.length > 0 && (
        <div>
          <h3 className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-3">Suggested settlements</h3>
          <div className="space-y-3">
            {settlements.map((s) => {
              const key          = `${s.from}-${s.to}`
              const isLoading    = settling === key
              const isMyPayment  = s.from === currentUid
              const receiverUpi  = !isPendingKey(s.to) ? userCache[s.to]?.upiId : undefined

              return (
                <div key={key} className="rounded-md border border-[#2A2A32] bg-[#111113] overflow-hidden">
                  {/* From → amount → to */}
                  <div className="flex items-center gap-2 p-4 pb-3 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {avatar(s.from, 28)}
                      <span className="text-[#F2F2F7] text-sm font-medium truncate">{name(s.from)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ArrowRight size={13} className="text-faint" />
                      <span className="font-mono text-[#F2F2F7] text-sm font-semibold">{formatINR(s.amount)}</span>
                      <ArrowRight size={13} className="text-faint" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                      <span className="text-[#F2F2F7] text-sm font-medium truncate text-right">{name(s.to)}</span>
                      {avatar(s.to, 28)}
                    </div>
                  </div>

                  {(isMyPayment || s.to === currentUid) && (
                    <div className="px-4 pb-4 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={noteInput[key] ?? ''}
                          onChange={(e) => setNoteInput((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder="Note: GPay, cash…"
                          className="flex-1 min-w-0 bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-1.5 text-[#F2F2F7] text-xs placeholder-faint focus:outline-none focus:border-[#7C6BF8] transition-all"
                        />
                        <button
                          onClick={() => handleSettle(s)}
                          disabled={!!settling}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-success-dim text-success text-xs font-medium border border-[rgba(52,211,153,0.25)] hover:bg-[rgba(52,211,153,0.2)] disabled:opacity-50 transition-colors shrink-0 whitespace-nowrap"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Mark settled
                        </button>
                      </div>

                      {isMyPayment && receiverUpi && (
                        <button
                          onClick={() => handlePayUPI(s)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-sm border border-[rgba(124,107,248,0.3)] bg-[rgba(124,107,248,0.08)] text-[#7C6BF8] text-xs font-medium hover:bg-[rgba(124,107,248,0.14)] transition-colors"
                        >
                          <Smartphone size={13} />
                          Pay {formatINR(s.amount)} via UPI
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── All balances ───────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-3">All balances</h3>
        <div className="space-y-2">
          {balances.map((b) => (
            <div key={b.uid} className="flex items-center gap-3 py-2.5 px-3 rounded-sm border border-[#2A2A32] bg-[#111113]">
              {avatar(b.uid, 32)}
              <span className="flex-1 text-[#F2F2F7] text-sm truncate">{name(b.uid)}</span>
              {isPendingKey(b.uid) && (
                <span className="text-warning text-[10px] font-medium mr-1 shrink-0">invited</span>
              )}
              <span className={`font-mono text-sm font-medium shrink-0 ${b.net > 0 ? 'text-success' : b.net < 0 ? 'text-[#F87171]' : 'text-faint'}`}>
                {b.net === 0 ? 'Settled' : b.net > 0 ? `+${formatINR(b.net)}` : formatINR(b.net)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Settlement history ─────────────────────────────────────────────── */}
      {recordedSettlements.length > 0 && (
        <div>
          <h3 className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <History size={12} /> Payment history
          </h3>
          <div className="space-y-2">
            {recordedSettlements.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 px-3 rounded-sm border border-[#2A2A32] bg-[#111113]">
                {avatar(s.from, 28)}
                <div className="flex-1 min-w-0">
                  <p className="text-[#F2F2F7] text-xs truncate">
                    <span className="font-medium">{name(s.from)}</span>
                    <span className="text-faint mx-1">paid</span>
                    <span className="font-medium">{name(s.to)}</span>
                  </p>
                  {s.note && <p className="text-faint text-[10px] truncate mt-0.5">{s.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs text-success font-medium">{formatINR(s.amount)}</p>
                  <p className="text-faint text-[10px] mt-0.5">
                    {new Date(s.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
