'use client'

import { useState, useEffect } from 'react'
import { Balance, Expense, Group, Settlement, SettlementSuggestion, User } from '@/types'
import { formatINR } from '@/lib/calculations'
import { getUserById, recordSettlement } from '@/lib/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ArrowRight, CheckCircle2, Loader2, Mail, History } from 'lucide-react'
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

export function BalancesTab({ group, balances, settlements, recordedSettlements, expenses, currentUid }: Props) {
  const [userCache, setUserCache] = useState<Record<string, User>>({})
  const [settling,  setSettling]  = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState<Record<string, string>>({})

  useEffect(() => {
    group.members.forEach(async (uid) => {
      if (userCache[uid]) return
      const u = await getUserById(uid)
      if (u) setUserCache((prev) => ({ ...prev, [uid]: u }))
    })
  }, [group.members])

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

  return (
    <div className="space-y-6">

      {/* My balance hero */}
      {myBalance && (
        <div className={`rounded-md border p-5 text-center ${
          myBalance.net > 0
            ? 'border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.06)]'
            : myBalance.net < 0
              ? 'border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)]'
              : 'border-[#2A2A32] bg-[#111113]'
        }`}>
          {allSettled ? (
            <>
              <CheckCircle2 size={32} className="text-success mx-auto mb-2" />
              <p className="text-success font-semibold">All settled up 🎉</p>
            </>
          ) : myBalance.net === 0 ? (
            <p className="text-[#8E8E9A]">Your balance is zero</p>
          ) : (
            <>
              <p className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-1">
                {myBalance.net > 0 ? 'You are owed' : 'You owe'}
              </p>
              <p className={`font-mono text-3xl font-bold ${myBalance.net > 0 ? 'text-success' : 'text-[#F87171]'}`}>
                {formatINR(Math.abs(myBalance.net))}
              </p>
            </>
          )}
        </div>
      )}

      {/* Suggested settlements */}
      {settlements.length > 0 && (
        <div>
          <h3 className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-3">Suggested settlements</h3>
          <div className="space-y-3">
            {settlements.map((s) => {
              const key       = `${s.from}-${s.to}`
              const isLoading = settling === key
              return (
                <div key={key} className="rounded-md border border-[#2A2A32] bg-[#111113] p-4">
                  {/* From → amount → to row */}
                  <div className="flex items-center gap-2 mb-3 min-w-0">
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

                  {(s.from === currentUid || s.to === currentUid) && (
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
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All balances */}
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

      {/* Settlement history */}
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
