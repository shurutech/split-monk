'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Settings, Loader2, Trash2, Archive, Check, Wallet, Lock, LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import { updateGroup, archiveGroup, closeGroup, reopenGroup, deleteGroup } from '@/lib/firestore'
import { GROUP_COLORS, MAX_GROUP_NAME_LENGTH } from '@/constants'
import { formatINR } from '@/lib/calculations'
import type { Group, Expense, Balance } from '@/types'

interface Props {
  open:     boolean
  onClose:  () => void
  group:    Group
  expenses: Expense[]
  balances: Balance[]
}

type DeleteState = 'idle' | 'confirm' | 'deleting'

export function GroupSettingsSheet({ open, onClose, group, expenses, balances }: Props) {
  const router = useRouter()

  // Edit fields
  const [name,               setName]               = useState(group.name)
  const [startDate,          setStartDate]          = useState(
    group.startDate ? group.startDate.toISOString().slice(0, 10) : ''
  )
  const [endDate,            setEndDate]            = useState(
    group.endDate   ? group.endDate.toISOString().slice(0, 10)   : ''
  )
  const [coverColor,         setCoverColor]         = useState(group.coverColor)
  const [contributionStr,    setContributionStr]    = useState(
    group.contributionAmount ? String(group.contributionAmount / 100) : ''
  )
  const [saving,             setSaving]             = useState(false)
  const [archiving,          setArchiving]          = useState(false)
  const [closing,            setClosing]            = useState(false)
  const [deleteState,        setDeleteState]        = useState<DeleteState>('idle')

  // Reset form whenever the sheet opens with fresh group data
  useEffect(() => {
    if (open) {
      setName(group.name)
      setStartDate(group.startDate ? group.startDate.toISOString().slice(0, 10) : '')
      setEndDate(group.endDate     ? group.endDate.toISOString().slice(0, 10)   : '')
      setCoverColor(group.coverColor)
      setContributionStr(group.contributionAmount ? String(group.contributionAmount / 100) : '')
      setDeleteState('idle')
    }
  }, [open, group])

  // Trap focus & handle Escape
  const sheetRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const hasUnsettledBalances = balances.some((b) => Math.abs(b.net) >= 100)
  const hasExpenses          = expenses.some((e) => !e.isContribution)

  const contributionPaise = Math.round(parseFloat(contributionStr) * 100) || 0

  // Derived: have any field values changed?
  const isDirty =
    name.trim()        !== group.name       ||
    coverColor         !== group.coverColor  ||
    startDate          !== (group.startDate ? group.startDate.toISOString().slice(0, 10) : '') ||
    endDate            !== (group.endDate   ? group.endDate.toISOString().slice(0, 10)   : '') ||
    contributionPaise  !== (group.contributionAmount ?? 0)

  async function handleSave() {
    if (!name.trim()) { toast.error('Trip name is required'); return }
    if (startDate && endDate && endDate < startDate) {
      toast.error('End date must be after start date')
      return
    }
    if (contributionStr && (isNaN(parseFloat(contributionStr)) || parseFloat(contributionStr) < 1)) {
      toast.error('Contribution must be at least ₹1')
      return
    }
    setSaving(true)
    try {
      await updateGroup(group.id, {
        name:               name.trim(),
        coverColor,
        startDate:          startDate ? new Date(startDate) : null,
        endDate:            endDate   ? new Date(endDate)   : null,
        contributionAmount: contributionPaise || undefined,
      })
      toast.success('Trip updated')
      onClose()
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    setArchiving(true)
    try {
      await archiveGroup(group.id)
      toast.success('Trip archived')
      onClose()
    } catch {
      toast.error('Failed to archive trip')
    } finally {
      setArchiving(false)
    }
  }

  async function handleClose() {
    setClosing(true)
    try {
      await closeGroup(group.id)
      toast.success('Trip closed — no more expenses can be added')
      onClose()
    } catch {
      toast.error('Failed to close trip')
    } finally {
      setClosing(false)
    }
  }

  async function handleReopen() {
    setClosing(true)
    try {
      await reopenGroup(group.id)
      toast.success('Trip re-opened')
      onClose()
    } catch {
      toast.error('Failed to re-open trip')
    } finally {
      setClosing(false)
    }
  }

  async function handleDelete() {
    if (deleteState === 'idle') {
      setDeleteState('confirm')
      return
    }
    setDeleteState('deleting')
    try {
      await deleteGroup(group.id)
      toast.success('Trip deleted')
      router.replace('/dashboard')
    } catch (err) {
      console.error('deleteGroup failed:', err)
      toast.error('Failed to delete trip')
      setDeleteState('idle')
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Trip settings"
        className="fixed bottom-0 left-0 right-0 z-50 sm:max-w-2xl sm:mx-auto bg-[#111113] border border-[#2A2A32] border-b-0 rounded-t-xl shadow-2xl"
        style={{ maxHeight: '90dvh', overflowY: 'auto' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#2A2A32]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2A2A32]">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-[#7C6BF8]" />
            <h2 className="text-[#F2F2F7] text-sm font-semibold">Trip settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* ── Edit section ─────────────────────────────────────────────── */}
          <section>
            <p className="text-faint text-[10px] uppercase tracking-wider mb-3">Edit trip</p>

            {/* Name */}
            <div className="mb-3">
              <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Trip name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_GROUP_NAME_LENGTH}
                className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all scheme-dark"
                />
              </div>
              <div>
                <label className="block text-[#8E8E9A] text-xs font-medium mb-1.5">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm px-3 py-2.5 text-[#F2F2F7] text-sm focus:outline-none focus:border-[#7C6BF8] transition-all scheme-dark"
                />
              </div>
            </div>

            {/* Contribution per person */}
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-[#8E8E9A] text-xs font-medium mb-1.5">
                <Wallet size={12} className="text-[#7C6BF8]" />
                Contribution per person
                <span className="text-faint font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E9A] text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={contributionStr}
                  onChange={(e) => setContributionStr(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#1A1A1F] border border-[#2A2A32] rounded-sm pl-7 pr-3 py-2.5 text-[#F2F2F7] text-sm placeholder-faint focus:outline-none focus:border-[#7C6BF8] focus:shadow-[0_0_0_3px_rgba(124,107,248,0.12)] transition-all"
                />
              </div>
              {contributionPaise > 0 && (
                <p className="text-faint text-[10px] mt-1">
                  Each member contributes {formatINR(contributionPaise)} upfront to the trip pool
                </p>
              )}
            </div>

            {/* Color */}
            <div className="mb-4">
              <label className="block text-[#8E8E9A] text-xs font-medium mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCoverColor(c.value)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {coverColor === c.value && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="w-full flex items-center justify-center gap-2 bg-[#7C6BF8] text-white rounded-sm py-2.5 text-sm font-medium hover:bg-[#6B5CE7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save changes'}
            </button>
          </section>

          <div className="border-t border-[#2A2A32]" />

          {/* ── Organiser actions ─────────────────────────────────────────── */}
          <section className="space-y-2.5">
            <p className="text-faint text-[10px] uppercase tracking-wider mb-3">Actions</p>

            {/* Close trip */}
            {(group.status === 'active' || group.status === 'settled') && (
              <button
                onClick={handleClose}
                disabled={closing}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-sm border border-[rgba(239,68,68,0.3)] bg-[#1A1A1F] text-[#EF4444] hover:border-[rgba(239,68,68,0.6)] hover:bg-[rgba(239,68,68,0.05)] transition-colors disabled:opacity-50"
              >
                {closing
                  ? <Loader2 size={15} className="animate-spin shrink-0" />
                  : <Lock size={15} className="shrink-0" />
                }
                <span className="text-sm font-medium">Close trip</span>
                <span className="ml-auto text-[10px] text-faint">Locks expenses permanently</span>
              </button>
            )}

            {/* Re-open closed trip */}
            {group.status === 'closed' && (
              <button
                onClick={handleReopen}
                disabled={closing}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-sm border border-[rgba(52,211,153,0.3)] bg-[#1A1A1F] text-[#34D399] hover:border-[rgba(52,211,153,0.6)] hover:bg-[rgba(52,211,153,0.05)] transition-colors disabled:opacity-50"
              >
                {closing
                  ? <Loader2 size={15} className="animate-spin shrink-0" />
                  : <LockOpen size={15} className="shrink-0" />
                }
                <span className="text-sm font-medium">Re-open trip</span>
                <span className="ml-auto text-[10px] text-faint">Allow new expenses again</span>
              </button>
            )}

            {/* Archive */}
            {group.status === 'active' && (
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-sm border border-[#2A2A32] bg-[#1A1A1F] text-[#8E8E9A] hover:text-[#F2F2F7] hover:border-[#3A3A44] transition-colors disabled:opacity-50"
              >
                {archiving
                  ? <Loader2 size={15} className="animate-spin shrink-0" />
                  : <Archive size={15} className="shrink-0" />
                }
                <span className="text-sm">Archive trip</span>
                <span className="ml-auto text-[10px] text-faint">Keeps all data, marks settled</span>
              </button>
            )}

            {/* Delete */}
            <DeleteButton
              state={deleteState}
              hasExpenses={hasExpenses}
              hasUnsettledBalances={hasUnsettledBalances}
              onDelete={handleDelete}
              onCancelConfirm={() => setDeleteState('idle')}
            />
          </section>

          {/* bottom safe area */}
          <div className="h-4" />
        </div>
      </div>
    </>
  )
}

// ── Delete button with three states ──────────────────────────────────────────

function DeleteButton({
  state,
  hasExpenses,
  hasUnsettledBalances,
  onDelete,
  onCancelConfirm,
}: {
  state:                DeleteState
  hasExpenses:          boolean
  hasUnsettledBalances: boolean
  onDelete:             () => void
  onCancelConfirm:      () => void
}) {
  // Blocked: has unsettled balances
  if (hasUnsettledBalances) {
    return (
      <div className="w-full flex items-center gap-3 px-4 py-3 rounded-sm border border-[#2A2A32] bg-[#1A1A1F] opacity-50 cursor-not-allowed select-none">
        <Trash2 size={15} className="text-[#F87171] shrink-0" />
        <div className="text-left">
          <p className="text-sm text-[#F87171]">Delete trip</p>
          <p className="text-[10px] text-faint mt-0.5">Settle all balances before deleting</p>
        </div>
      </div>
    )
  }

  // No expenses — one tap
  if (!hasExpenses) {
    if (state === 'deleting') {
      return (
        <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] text-[#F87171] text-sm">
          <Loader2 size={15} className="animate-spin" /> Deleting…
        </div>
      )
    }
    return (
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-sm border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] text-[#F87171] hover:bg-danger-dim hover:border-[rgba(248,113,113,0.4)] transition-colors"
      >
        <Trash2 size={15} className="shrink-0" />
        <span className="text-sm">Delete trip</span>
        <span className="ml-auto text-[10px] text-[rgba(248,113,113,0.6)]">No expenses</span>
      </button>
    )
  }

  // Has expenses, all settled — requires confirmation
  if (state === 'confirm') {
    return (
      <div className="rounded-sm border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] p-4 space-y-3">
        <p className="text-[#F87171] text-sm font-medium">Are you sure?</p>
        <p className="text-[#8E8E9A] text-xs leading-relaxed">
          This will permanently delete the trip, all expenses, and settlement history. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancelConfirm}
            className="flex-1 py-2 rounded-sm border border-[#2A2A32] text-[#8E8E9A] hover:text-[#F2F2F7] text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="flex-1 py-2 rounded-sm bg-[#F87171] text-white text-sm font-medium hover:bg-[#EF4444] transition-colors"
          >
            Delete permanently
          </button>
        </div>
      </div>
    )
  }

  if (state === 'deleting') {
    return (
      <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] text-[#F87171] text-sm">
        <Loader2 size={15} className="animate-spin" /> Deleting…
      </div>
    )
  }

  return (
    <button
      onClick={onDelete}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-sm border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] text-[#F87171] hover:bg-danger-dim hover:border-[rgba(248,113,113,0.4)] transition-colors"
    >
      <Trash2 size={15} className="shrink-0" />
      <span className="text-sm">Delete trip</span>
    </button>
  )
}
