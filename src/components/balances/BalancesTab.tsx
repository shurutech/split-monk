'use client'

import { useState, useEffect } from 'react'
import { Balance, Expense, Group, SettlementSuggestion, User } from '@/types'
import { formatINR } from '@/lib/calculations'
import { getUserById, recordSettlement } from '@/lib/firestore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  group: Group
  balances: Balance[]
  settlements: SettlementSuggestion[]
  expenses: Expense[]
  currentUid: string
}

export function BalancesTab({ group, balances, settlements, expenses, currentUid }: Props) {
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

  const myBalance = balances.find((b) => b.uid === currentUid)
  const allSettled = balances.every((b) => b.net === 0)

  function name(uid: string) {
    if (uid === currentUid) return 'You'
    return userCache[uid]?.displayName?.split(' ')[0] ?? '…'
  }

  async function handleSettle(s: SettlementSuggestion) {
    const key = `${s.from}-${s.to}`
    setSettling(key)
    try {
      await recordSettlement(
        group.id,
        { from: s.from, to: s.to, amount: s.amount, settledBy: currentUid, note: noteInput[key] },
        expenses,
        group.members,
      )
      toast.success(`Settlement recorded ✓`)
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
              <CheckCircle2 size={32} className="text-[#34D399] mx-auto mb-2" />
              <p className="text-[#34D399] font-semibold">All settled up 🎉</p>
            </>
          ) : myBalance.net === 0 ? (
            <p className="text-[#8E8E9A]">Your balance is zero</p>
          ) : (
            <>
              <p className="text-[#8E8E9A] text-xs uppercase tracking-wide mb-1">
                {myBalance.net > 0 ? 'You are owed' : 'You owe'}
              </p>
              <p className={`font-mono text-3xl font-bold ${myBalance.net > 0 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
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
                  <div className="flex items-center gap-2 mb-3">
                    {userCache[s.from] ? <UserAvatar user={userCache[s.from]} size={32} /> : <div className="w-8 h-8 rounded-full bg-[#1A1A1F] animate-pulse" />}
                    <div className="flex-1">
                      <p className="text-[#F2F2F7] text-sm">
                        <span className="font-medium">{name(s.from)}</span>
                        <span className="text-[#4A4A56] mx-1.5">pays</span>
                        <span className="font-medium">{name(s.to)}</span>
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-[#4A4A56]" />
                    {userCache[s.to] ? <UserAvatar user={userCache[s.to]} size={32} /> : <div className="w-8 h-8 rounded-full bg-[#1A1A1F] animate-pulse" />}
                    <span className="font-mono text-[#F2F2F7] font-semibold ml-1">{formatINR(s.amount)}</span>
                  </div>

                  {(s.from === currentUid || s.to === currentUid) && (
                    <div className="flex gap-2">
                      <input
                        value={noteInput[key] ?? ''}
                        onChange={(e) => setNoteInput((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Note: via GPay, cash…"
                        className="flex-1 bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-1.5 text-[#F2F2F7] text-xs placeholder-[#4A4A56] focus:outline-none focus:border-[#7C6BF8] transition-all"
                      />
                      <button
                        onClick={() => handleSettle(s)}
                        disabled={!!settling}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[rgba(52,211,153,0.12)] text-[#34D399] text-xs font-medium border border-[rgba(52,211,153,0.25)] hover:bg-[rgba(52,211,153,0.2)] disabled:opacity-50 transition-colors"
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
          {balances.map((b) => {
            const u = userCache[b.uid]
            return (
              <div key={b.uid} className="flex items-center gap-3 py-2.5 px-3 rounded-sm border border-[#2A2A32] bg-[#111113]">
                {u ? <UserAvatar user={u} size={32} /> : <div className="w-8 h-8 rounded-full bg-[#1A1A1F] animate-pulse" />}
                <span className="flex-1 text-[#F2F2F7] text-sm">{name(b.uid)}</span>
                <span className={`font-mono text-sm font-medium ${b.net > 0 ? 'text-[#34D399]' : b.net < 0 ? 'text-[#F87171]' : 'text-[#4A4A56]'}`}>
                  {b.net === 0 ? 'Settled' : b.net > 0 ? `+${formatINR(b.net)}` : formatINR(b.net)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
