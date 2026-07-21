'use client'

import { useState } from 'react'
import { Wallet, CheckCircle2, Clock, ChevronDown, ChevronUp, Copy, Check, IndianRupee } from 'lucide-react'
import { formatINR } from '@/lib/calculations'
import { RecordContributionsSheet } from './RecordContributionsSheet'
import { toast } from 'sonner'
import type { Group, Expense, User } from '@/types'

interface Props {
  group:       Group
  expenses:    Expense[]
  members:     User[]
  currentUid:  string
}

export function ContributionPoolCard({ group, expenses, members, currentUid }: Props) {
  const [sheetOpen,   setSheetOpen]   = useState(false)
  const [expanded,    setExpanded]    = useState(false)
  const [upiCopied,   setUpiCopied]   = useState(false)

  const perPerson  = group.contributionAmount!
  const organiser  = members.find((u) => u.uid === group.createdBy)

  // Merge all contribution expenses' payments maps to get total paid per uid
  const paidMap: Record<string, number> = {}
  for (const e of expenses) {
    if (!e.isContribution || !e.payments) continue
    for (const [uid, amt] of Object.entries(e.payments)) {
      paidMap[uid] = (paidMap[uid] ?? 0) + amt
    }
  }

  const pendingInvites = group.pendingInvites ?? []
  const totalCount     = group.members.length + pendingInvites.length
  const totalExpected  = perPerson * totalCount
  const totalCollected = Object.values(paidMap).reduce((s, v) => s + v, 0)
  // "paid" = contributed at least the target per-person amount
  const paidCount      = group.members.filter((uid) => (paidMap[uid] ?? 0) >= perPerson).length
  // pending invitees always count as unpaid (no uid, can't be in paidMap)
  const allPaid        = paidCount === totalCount
  // Progress can exceed 100% if extra contributions were recorded
  const hasExtra       = totalCollected > totalExpected
  const progress       = Math.min(totalCollected / totalExpected, 1)

  const isOrganiser = currentUid === group.createdBy

  return (
    <>
      <div className="rounded-sm border border-[#2A2A32] bg-[#111113] overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-accent-dim flex items-center justify-center shrink-0">
            <Wallet size={15} className="text-[#7C6BF8]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[#F2F2F7] text-sm font-medium">Trip Pool</p>
              {allPaid && (
                <span className="text-[10px] font-medium text-success bg-[rgba(52,211,153,0.1)] px-1.5 py-0.5 rounded-full">
                  {hasExtra ? 'Overfunded' : 'Fully collected'}
                </span>
              )}
            </div>
            <p className="text-faint text-xs mt-0.5">
              {formatINR(perPerson)}/person target ·{' '}
              {hasExtra
                ? `${formatINR(totalCollected)} collected`
                : `${paidCount} of ${totalCount} paid`
              }
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOrganiser && group.status !== 'archived' && group.status !== 'closed' && (
              <button
                onClick={() => setSheetOpen(true)}
                className="px-2.5 py-1.5 rounded-sm bg-[#7C6BF8] text-white text-xs font-medium hover:bg-[#6B5CE7] transition-colors"
              >
                Record
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-faint hover:text-[#F2F2F7] transition-colors p-1"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-[#1A1A1F] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: allPaid ? '#34D399' : '#7C6BF8',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className={`text-[10px] ${hasExtra ? 'text-success' : 'text-faint'}`}>
              {formatINR(totalCollected)} collected{hasExtra ? ` (+${formatINR(totalCollected - totalExpected)} extra)` : ''}
            </span>
            <span className="text-faint text-[10px]">{formatINR(totalExpected)} target</span>
          </div>
        </div>

        {/* Member breakdown — expandable */}
        {expanded && (
          <div className="border-t border-[#2A2A32]">
            {group.members.map((uid) => {
              const user      = members.find((u) => u.uid === uid)
              const paid      = paidMap[uid] ?? 0
              const isSelf    = uid === currentUid
              const hasPaid   = paid >= perPerson
              const isPartial = paid > 0 && paid < perPerson

              return (
                <div key={uid} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1A1A1F] last:border-b-0">
                  <div className="shrink-0">
                    {hasPaid
                      ? <CheckCircle2 size={15} className="text-success" />
                      : <Clock size={15} className="text-faint" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#F2F2F7] truncate">
                      {user?.displayName ?? '…'}
                      {isSelf && <span className="text-faint text-xs ml-1">(you)</span>}
                    </p>
                    {isPartial && (
                      <p className="text-[10px] text-warning">
                        {formatINR(paid)} paid · {formatINR(perPerson - paid)} remaining
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {hasPaid ? (
                      <span className="text-success text-xs font-mono">{formatINR(paid)}</span>
                    ) : (
                      <span className="text-faint text-xs font-mono">
                        {isPartial ? formatINR(paid) : 'pending'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Pending invitees — not yet joined, always unpaid */}
            {pendingInvites.map((email) => (
              <div key={email} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1A1A1F] last:border-b-0">
                <Clock size={15} className="text-faint shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#8E8E9A] truncate">{email}</p>
                  <p className="text-[10px] text-faint">Invite pending · hasn't joined yet</p>
                </div>
                <span className="text-faint text-xs font-mono shrink-0">pending</span>
              </div>
            ))}

            {/* Single UPI share row — only when there are pending members */}
            {(group.members.some((uid) => (paidMap[uid] ?? 0) < perPerson) || pendingInvites.length > 0) && (() => {
              if (!organiser?.upiId) {
                return (
                  <div className="px-4 py-2.5 border-t border-[#2A2A32] text-faint text-[10px]">
                    Add your UPI ID in profile to enable one-tap payment requests.
                  </div>
                )
              }

              function handleShare() {
                if (!organiser?.upiId) return
                navigator.clipboard.writeText(organiser.upiId)
                setUpiCopied(true)
                setTimeout(() => setUpiCopied(false), 2000)
                toast.success('UPI ID copied — open any UPI app and pay')
              }

              return (
                <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[#2A2A32]">
                  <IndianRupee size={13} className="text-faint shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#8E8E9A] truncate">
                      {organiser.upiId}
                    </p>
                    <p className="text-[10px] text-faint">
                      {formatINR(perPerson)}/person · {organiser.displayName}
                    </p>
                  </div>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#7C6BF8] hover:border-[rgba(124,107,248,0.4)] transition-colors text-[10px] shrink-0"
                  >
                    {upiCopied
                      ? <><Check size={10} className="text-success" /><span className="text-success ml-1">Copied</span></>
                      : <><Copy size={10} /><span className="ml-1">Copy UPI</span></>
                    }
                  </button>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      <RecordContributionsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        group={group}
        members={members}
        paidMap={paidMap}
        currentUid={currentUid}
      />
    </>
  )
}
