'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Wallet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { addExpense } from '@/lib/firestore'
import { formatINR } from '@/lib/calculations'
import type { Group, User } from '@/types'

interface Props {
  open:        boolean
  onClose:     () => void
  group:       Group
  members:     User[]
  paidMap:     Record<string, number>  // uid → total paise already contributed
  currentUid:  string
}

export function RecordContributionsSheet({ open, onClose, group, members, paidMap, currentUid }: Props) {
  const perPerson = group.contributionAmount!

  // Per-member: checked = contributing this round, amountStr = rupee string
  const [checked,   setChecked]   = useState<Record<string, boolean>>({})
  const [amounts,   setAmounts]   = useState<Record<string, string>>({})
  const [saving,    setSaving]    = useState(false)

  const sheetRef = useRef<HTMLDivElement>(null)

  // Reset state each time sheet opens
  useEffect(() => {
    if (!open) return
    const initChecked: Record<string, boolean> = {}
    const initAmounts: Record<string, string>  = {}
    for (const uid of group.members) {
      const alreadyPaid = paidMap[uid] ?? 0
      const remaining   = perPerson - alreadyPaid
      // Pre-check members who still owe something
      initChecked[uid] = remaining > 0
      initAmounts[uid] = remaining > 0 ? String(Math.max(remaining / 100, 0)) : '0'
    }
    setChecked(initChecked)
    setAmounts(initAmounts)
  }, [open, group.members, paidMap, perPerson])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const selectedMembers = group.members.filter((uid) => checked[uid])

  const payments: Record<string, number> = {}
  for (const uid of selectedMembers) {
    const paise = Math.round(parseFloat(amounts[uid] || '0') * 100)
    if (paise > 0) payments[uid] = paise
  }

  const total = Object.values(payments).reduce((s, v) => s + v, 0)
  const canSubmit = total > 0 && !saving

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      // splits: organiser absorbs the entire pool amount
      const splits: Record<string, number> = { [group.createdBy]: total }

      await addExpense(group.id, {
        title:          `Trip pool — ${formatINR(perPerson)}/person`,
        amount:         total,
        paidBy:         'multiple',
        payments,
        splits,
        splitType:      'exact',
        category:       'contribution',
        date:           new Date(),
        notes:          '',
        createdBy:      currentUid,
        isContribution: true,
      })

      toast.success(`Recorded ${formatINR(total)} pool contribution`)
      onClose()
    } catch {
      toast.error('Failed to record contributions')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet — flex column so header stays pinned and only body scrolls */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Record contributions"
        className="fixed bottom-0 left-0 right-0 z-50 sm:max-w-2xl sm:mx-auto bg-[#111113] border border-[#2A2A32] border-b-0 rounded-t-xl shadow-2xl flex flex-col"
        style={{ maxHeight: "85dvh" }}
      >
        {/* Drag handle — never scrolls away */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#2A2A32]" />
        </div>

        {/* Header — pinned */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2A2A32] shrink-0">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-[#7C6BF8]" />
            <h2 className="text-[#F2F2F7] text-sm font-semibold">
              Record contributions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body — min-h-0 is required for flex children to actually overflow-scroll */}
        <div className="overflow-y-auto min-h-0 flex-1 px-5 py-4 space-y-4">
          <p className="text-faint text-xs">
            Check each member who transferred money to you. Adjust amounts if
            they paid a partial contribution.
          </p>

          {/* Member rows */}
          <div className="space-y-2">
            {(group.pendingInvites ?? []).map((email) => (
              <div
                key={email}
                className="flex items-center gap-3 px-3 py-3 rounded-sm border border-[#2A2A32] bg-[#1A1A1F] opacity-50"
              >
                <div className="w-5 h-5 rounded border border-[#3A3A44] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#8E8E9A] text-sm truncate">{email}</p>
                  <p className="text-faint text-[10px]">Hasn't joined yet — can't record</p>
                </div>
              </div>
            ))}
            {group.members.map((uid) => {
              const user = members.find((u) => u.uid === uid);
              const alreadyPaid = paidMap[uid] ?? 0;
              const isChecked = checked[uid] ?? false;
              const isSelf = uid === currentUid;

              return (
                <div
                  key={uid}
                  className={`flex items-center gap-3 px-3 py-3 rounded-sm border transition-colors ${
                    isChecked
                      ? "border-[rgba(124,107,248,0.4)] bg-[rgba(124,107,248,0.06)]"
                      : "border-[#2A2A32] bg-[#1A1A1F]"
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() =>
                      setChecked((prev) => ({ ...prev, [uid]: !prev[uid] }))
                    }
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      isChecked
                        ? "bg-[#7C6BF8] border-[#7C6BF8]"
                        : "border-[#3A3A44] bg-transparent"
                    }`}
                  >
                    {isChecked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F2F2F7] text-sm truncate">
                      {user?.displayName ?? "…"}
                      {isSelf && (
                        <span className="text-faint text-xs ml-1">(you)</span>
                      )}
                    </p>
                    <p className="text-faint text-[10px] truncate">
                      {alreadyPaid > 0
                        ? `Already paid ${formatINR(alreadyPaid)}`
                        : (user?.email ?? "")}
                    </p>
                  </div>

                  {/* Amount input */}
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8E9A] text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={amounts[uid] ?? ""}
                      onChange={(e) => {
                        setAmounts((prev) => ({
                          ...prev,
                          [uid]: e.target.value,
                        }));
                        if (parseFloat(e.target.value) > 0) {
                          setChecked((prev) => ({ ...prev, [uid]: true }));
                        }
                      }}
                      disabled={!isChecked}
                      className="w-full bg-[#111113] border border-[#2A2A32] rounded-sm pl-6 pr-2 py-1.5 text-[#F2F2F7] text-sm text-right focus:outline-none focus:border-[#7C6BF8] transition-all disabled:opacity-40"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          {total > 0 && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-sm bg-[#1A1A1F] border border-[#2A2A32]">
              <span className="text-[#8E8E9A] text-sm">Total to record</span>
              <span className="text-[#F2F2F7] font-mono text-sm font-medium">
                {formatINR(total)}
              </span>
            </div>
          )}

          {/* Submit + safe area */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-[#7C6BF8] text-white rounded-sm py-3 text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Recording…
              </>
            ) : (
              `Record ${total > 0 ? formatINR(total) : ""} contribution`
            )}
          </button>
          <div className="h-safe-bottom pb-4" />
        </div>
      </div>
    </>
  );
}
