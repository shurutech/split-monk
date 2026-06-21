'use client'

import { useState, useEffect, useMemo } from 'react'
import { Balance, Expense, Group, Settlement, SettlementSuggestion, User } from '@/types'
import { formatINR } from '@/lib/calculations'
import { getUserById, recordSettlement } from '@/lib/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ArrowRight, CheckCircle2, Loader2, Mail, History, Smartphone, ChevronDown, ChevronUp, Copy, Bell, BellRing } from 'lucide-react'
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
  const [breakdownOpen,      setBreakdownOpen]      = useState(false)
  const [expandedPaidBy,     setExpandedPaidBy]     = useState<string | null>(null)
  const [copiedUpi,          setCopiedUpi]          = useState<string | null>(null)
  const [reminding,          setReminding]          = useState<string | null>(null)   // uid being reminded, or 'bulk', or 'test'
  const [reminded,           setReminded]           = useState<Set<string>>(new Set()) // "from-to" keys already sent this session

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
    // Per-person: how much each person paid that covered me, + which expenses
    const perPerson: Record<string, number> = {}
    const perPersonExpenses: Record<string, Expense[]> = {}

    active.forEach((e) => {
      if (e.paidBy === currentUid) {
        Object.entries(e.splits).forEach(([key, share]) => {
          if (key !== currentUid) iPaidForOthers += share
        })
      } else {
        const myShare = e.splits[currentUid] ?? 0
        if (myShare > 0) {
          othersPaidForMe += myShare
          perPerson[e.paidBy] = (perPerson[e.paidBy] ?? 0) + myShare
          perPersonExpenses[e.paidBy] = [...(perPersonExpenses[e.paidBy] ?? []), e]
        }
      }
    })

    return { iPaidForOthers, othersPaidForMe, perPerson, perPersonExpenses }
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

  // ── Reminder helpers ─────────────────────────────────────────────────────────

  const isOrganizer    = group.createdBy === currentUid
  const tripEnded      = group.endDate ? new Date(group.endDate) < new Date() : false
  const showReminders  = isOrganizer && tripEnded

  function buildReminderPayload(targets: SettlementSuggestion[]) {
    const active        = expenses.filter((e) => !e.isDeleted)
    const organizerName = userCache[currentUid]?.displayName?.split(' ')[0] ?? 'Organizer'
    const tripEndDate   = group.endDate
      ? new Date(group.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : undefined

    const recipients = targets.map((s) => {
      const debtor      = userCache[s.from]
      const creditor    = userCache[s.to]
      if (!debtor?.email) return null

      // All expenses where the debtor has a share but didn't pay — grouped by who paid
      const relevantExps = active
        .filter((e) => e.paidBy !== s.from && (e.splits[s.from] ?? 0) > 0)
        .sort((a, b) => (b.splits[s.from] ?? 0) - (a.splits[s.from] ?? 0))

      const topExpenses = relevantExps.slice(0, 8).map((e) => ({
        title:     e.title,
        paidBy:    userCache[e.paidBy]?.displayName?.split(' ')[0] ?? name(e.paidBy),
        yourShare: formatINR(e.splits[s.from] ?? 0),
      }))

      return {
        email:         debtor.email,
        recipientName: debtor.displayName?.split(' ')[0] ?? debtor.email.split('@')[0],
        owesTo:        creditor?.displayName?.split(' ')[0] ?? name(s.to),
        amount:        formatINR(s.amount),
        expenseCount:  relevantExps.length,
        topExpenses,
      }
    }).filter(Boolean)

    return { recipients, organizerName, tripEndDate }
  }

  async function sendReminders(targets: SettlementSuggestion[], key: string) {
    setReminding(key)
    try {
      const { recipients, organizerName, tripEndDate } = buildReminderPayload(targets)
      if (recipients.length === 0) {
        toast.error('No email found for recipient')
        return
      }

      const res = await fetch('/api/remind', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId:     group.id,
          groupName:   group.name,
          coverColor:  group.coverColor,
          sentBy:      organizerName,
          tripEndDate,
          recipients,
        }),
      })

      const data = await res.json()
      const failed = (data.results ?? []).filter((r: { success: boolean }) => !r.success)

      if (failed.length === 0) {
        toast.success(recipients.length > 1 ? `${recipients.length} reminders sent` : 'Reminder sent')
        setReminded((prev) => {
          const next = new Set(prev)
          targets.forEach((t) => next.add(`${t.from}-${t.to}`))
          return next
        })
      } else {
        toast.error('Some reminders failed to send')
      }
    } catch {
      toast.error('Failed to send reminder')
    } finally {
      setReminding(null)
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
            <>
              <div className="px-5 pt-5 pb-3 text-center">
                <p className="text-[#8E8E9A]">Your balance is zero</p>
              </div>
              {Object.keys(myBreakdown.perPerson).length > 0 && (
                <div className="mx-4 mb-4">
                  <button
                    onClick={() => { setBreakdownOpen((v) => !v); setExpandedPaidBy(null) }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint text-xs transition-colors"
                  >
                    <span>Paid for you — by person</span>
                    {breakdownOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {breakdownOpen && (
                    <div className="mt-1.5 rounded-sm border border-[#2A2A32] bg-background overflow-hidden divide-y divide-[#1A1A1F]">
                      {Object.entries(myBreakdown.perPerson)
                        .sort((a, b) => b[1] - a[1])
                        .map(([uid, amount]) => {
                          const isOpen = expandedPaidBy === uid
                          const exps   = myBreakdown.perPersonExpenses[uid] ?? []
                          return (
                            <div key={uid}>
                              <button
                                onClick={() => setExpandedPaidBy(isOpen ? null : uid)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#1A1A1F] transition-colors text-left"
                              >
                                {avatar(uid, 24)}
                                <span className="flex-1 text-[#F2F2F7] text-xs truncate">{name(uid)}</span>
                                <span className="font-mono text-xs text-[#F87171] mr-2">-{formatINR(amount)}</span>
                                {isOpen ? <ChevronUp size={11} className="text-faint shrink-0" /> : <ChevronDown size={11} className="text-faint shrink-0" />}
                              </button>
                              {isOpen && (
                                <div className="border-t border-[#2A2A32] bg-[#0D0D0F] divide-y divide-[#1A1A1F]">
                                  {exps.map((e) => {
                                    const myShare = e.splits[currentUid] ?? 0
                                    const date    = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                    return (
                                      <div key={e.id} className="flex items-center gap-2 px-4 py-2.5">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[#F2F2F7] text-[11px] font-medium truncate">{e.title}</p>
                                          <p className="text-faint text-[10px] mt-0.5">
                                            {name(uid)} paid {formatINR(e.amount)} · {date}
                                          </p>
                                        </div>
                                        <span className="font-mono text-[11px] text-[#F87171] shrink-0">-{formatINR(myShare)}</span>
                                      </div>
                                    )
                                  })}
                                  <div className="flex items-center justify-between px-4 py-2 bg-[#111113]">
                                    <span className="text-faint text-[10px]">{exps.length} expense{exps.length > 1 ? 's' : ''} · {name(uid)} paid for you</span>
                                    <span className="font-mono text-[11px] text-[#F87171] font-semibold">-{formatINR(amount)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      }
                    </div>
                  )}
                </div>
              )}
            </>
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

              {/* Paid for you — by person, drillable */}
              {Object.keys(myBreakdown.perPerson).length > 0 && (
                <div className="mx-4 mb-4">
                  <button
                    onClick={() => { setBreakdownOpen((v) => !v); setExpandedPaidBy(null) }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint text-xs transition-colors"
                  >
                    <span>Paid for you — by person</span>
                    {breakdownOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {breakdownOpen && (
                    <div className="mt-1.5 rounded-sm border border-[#2A2A32] bg-background overflow-hidden divide-y divide-[#1A1A1F]">
                      {Object.entries(myBreakdown.perPerson)
                        .sort((a, b) => b[1] - a[1])
                        .map(([uid, amount]) => {
                          const isOpen   = expandedPaidBy === uid
                          const exps     = myBreakdown.perPersonExpenses[uid] ?? []
                          return (
                            <div key={uid}>
                              {/* Person row — tap to expand */}
                              <button
                                onClick={() => setExpandedPaidBy(isOpen ? null : uid)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#1A1A1F] transition-colors text-left"
                              >
                                {avatar(uid, 24)}
                                <span className="flex-1 text-[#F2F2F7] text-xs truncate">{name(uid)}</span>
                                <span className="font-mono text-xs text-[#F87171] mr-2">-{formatINR(amount)}</span>
                                {isOpen ? <ChevronUp size={11} className="text-faint shrink-0" /> : <ChevronDown size={11} className="text-faint shrink-0" />}
                              </button>

                              {/* Expense drilldown */}
                              {isOpen && (
                                <div className="border-t border-[#2A2A32] bg-[#0D0D0F] divide-y divide-[#1A1A1F]">
                                  {exps.map((e) => {
                                    const myShare = e.splits[currentUid] ?? 0
                                    const date    = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                    return (
                                      <div key={e.id} className="flex items-center gap-2 px-4 py-2.5">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[#F2F2F7] text-[11px] font-medium truncate">{e.title}</p>
                                          <p className="text-faint text-[10px] mt-0.5">
                                            {name(uid)} paid {formatINR(e.amount)} · {date}
                                          </p>
                                        </div>
                                        <span className="font-mono text-[11px] text-[#F87171] shrink-0">-{formatINR(myShare)}</span>
                                      </div>
                                    )
                                  })}
                                  <div className="flex items-center justify-between px-4 py-2 bg-[#111113]">
                                    <span className="text-faint text-[10px]">{exps.length} expense{exps.length > 1 ? 's' : ''} · {name(uid)} paid for you</span>
                                    <span className="font-mono text-[11px] text-[#F87171] font-semibold">-{formatINR(amount)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[#8E8E9A] text-xs uppercase tracking-wide">Suggested settlements</h3>
            {isOrganizer && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => sendReminders([{ ...settlements[0], from: currentUid }], 'test')}
                  disabled={!!reminding}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#2A2A32] text-[#8E8E9A] text-[11px] font-medium hover:text-[#F2F2F7] hover:border-faint transition-colors disabled:opacity-40"
                >
                  {reminding === 'test' ? <Loader2 size={10} className="animate-spin" /> : <Bell size={10} />}
                  Test
                </button>
                {showReminders && settlements.some((s) => userCache[s.from]?.email) && (
                  <button
                    onClick={() => sendReminders(settlements, 'bulk')}
                    disabled={!!reminding}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[rgba(124,107,248,0.4)] bg-[rgba(124,107,248,0.08)] text-[#7C6BF8] text-[11px] font-medium hover:bg-[rgba(124,107,248,0.16)] transition-colors disabled:opacity-40"
                  >
                    {reminding === 'bulk' ? <Loader2 size={10} className="animate-spin" /> : <BellRing size={10} />}
                    Remind all
                  </button>
                )}
              </div>
            )}
          </div>
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

                  {(isMyPayment || s.to === currentUid || isOrganizer) && (
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePayUPI(s)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-sm border border-[rgba(124,107,248,0.3)] bg-[rgba(124,107,248,0.08)] text-[#7C6BF8] text-xs font-medium hover:bg-[rgba(124,107,248,0.14)] transition-colors"
                          >
                            <Smartphone size={13} />
                            Pay via UPI
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(receiverUpi)
                              setCopiedUpi(key)
                              setTimeout(() => setCopiedUpi(null), 1500)
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm border border-[#2A2A32] bg-[#1A1A1F] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint text-xs font-medium transition-colors shrink-0 whitespace-nowrap"
                          >
                            {copiedUpi === key ? <CheckCircle2 size={12} className="text-success" /> : <Copy size={12} />}
                            {copiedUpi === key ? 'Copied!' : 'Copy UPI ID'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Per-row remind — organizer only, trip ended, debtor has email */}
                  {showReminders && userCache[s.from]?.email && (
                    <div className="border-t border-[#1A1A1F] px-4 py-2.5 flex items-center justify-between">
                      <p className="text-faint text-[11px]">
                        Send a payment reminder to <span className="text-[#F2F2F7]">{name(s.from)}</span>
                      </p>
                      <button
                        onClick={() => sendReminders([s], `${s.from}-${s.to}`)}
                        disabled={!!reminding}
                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-sm border text-[11px] font-medium transition-colors disabled:opacity-40 ml-3 whitespace-nowrap ${
                          reminded.has(`${s.from}-${s.to}`)
                            ? 'border-[rgba(52,211,153,0.25)] text-success bg-[rgba(52,211,153,0.06)]'
                            : 'border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-faint'
                        }`}
                      >
                        {reminding === `${s.from}-${s.to}`
                          ? <Loader2 size={11} className="animate-spin" />
                          : reminded.has(`${s.from}-${s.to}`) ? <CheckCircle2 size={11} /> : <Bell size={11} />
                        }
                        {reminded.has(`${s.from}-${s.to}`) ? 'Sent' : 'Remind'}
                      </button>
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
