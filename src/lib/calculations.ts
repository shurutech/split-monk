import type { Balance, Expense, Settlement, SettlementSuggestion, Split } from '@/types'

// ─── Paise helpers ───────────────────────────────────────────────────────────

export const toPaise   = (rupees: number): number => Math.round(rupees * 100)
export const toRupees  = (paise: number):  number => paise / 100
export const formatINR = (paise: number):  string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100)

// ─── Split calculators ───────────────────────────────────────────────────────

/** Equal split — remainder paise go to the payer */
export function calculateEqualSplit(
  amountPaise: number,
  memberUids: string[],
  payerUid: string,
): Split {
  const n         = memberUids.length
  const base      = Math.floor(amountPaise / n)
  const remainder = amountPaise - base * n
  const splits: Split = {}

  memberUids.forEach((uid) => {
    splits[uid] = uid === payerUid ? base + remainder : base
  })
  return splits
}

/** Exact split — validate sum === total before saving */
export function calculateExactSplit(
  amountPaise: number,
  splitInput: Split,
): { splits: Split; error: string | null } {
  const sum = Object.values(splitInput).reduce((a, b) => a + b, 0)
  if (sum !== amountPaise) {
    const diff = amountPaise - sum
    return {
      splits: splitInput,
      error: `Amounts are off by ${formatINR(Math.abs(diff))} — ${diff > 0 ? 'add more' : 'reduce'}`,
    }
  }
  return { splits: splitInput, error: null }
}

/** Percentage split — last member absorbs rounding diff */
export function calculatePercentageSplit(
  amountPaise: number,
  percentages: { [uid: string]: number },
): { splits: Split; error: string | null } {
  const totalPct = Object.values(percentages).reduce((a, b) => a + b, 0)
  if (Math.abs(totalPct - 100) > 0.01) {
    return {
      splits: {},
      error: `Percentages must add up to 100% (currently ${totalPct.toFixed(1)}%)`,
    }
  }

  const uids = Object.keys(percentages)
  const splits: Split = {}
  let assigned = 0

  uids.slice(0, -1).forEach((uid) => {
    splits[uid] = Math.floor((percentages[uid] / 100) * amountPaise)
    assigned += splits[uid]
  })

  const lastUid   = uids[uids.length - 1]
  splits[lastUid] = amountPaise - assigned
  return { splits, error: null }
}

// ─── Balance engine ──────────────────────────────────────────────────────────

/**
 * Calculate net balance for each member from expenses and recorded settlements.
 * Positive = owed to you · Negative = you owe.
 * INVARIANT: sum of all balances === 0
 *
 * pendingEmails: invited members not yet signed in — their split shares are
 * keyed by email in the splits map.
 *
 * settlements: recorded payments that reduce outstanding balances.
 * A settlement { from, to, amount } means `from` paid `to` amount paise,
 * so `from` gets a credit and `to` gets a debit of that amount.
 */
export function calculateBalances(
  expenses: Expense[],
  memberUids: string[],
  pendingEmails: string[] = [],
  settlements: Settlement[] = [],
): Balance[] {
  const allKeys = [...memberUids, ...pendingEmails]
  const net: Record<string, number> = {}
  allKeys.forEach((key) => { net[key] = 0 })

  // Apply expenses: payer gets credit, each split participant gets debited
  expenses
    .filter((e) => !e.isDeleted)
    .forEach((expense) => {
      net[expense.paidBy] = (net[expense.paidBy] ?? 0) + expense.amount
      Object.entries(expense.splits).forEach(([key, share]) => {
        net[key] = (net[key] ?? 0) - share
      })
    })

  // Apply settlements: `from` paid `to`, so from's debt reduces, to's credit reduces
  settlements.forEach((s) => {
    net[s.from] = (net[s.from] ?? 0) + s.amount
    net[s.to]   = (net[s.to]   ?? 0) - s.amount
  })

  const balances = allKeys.map((key) => ({ uid: key, net: net[key] ?? 0 }))

  const sum = balances.reduce((a, b) => a + b.net, 0)
  if (Math.abs(sum) > 1) {
    console.error(`Balance invariant violated: sum = ${sum} paise`)
  }

  return balances
}

/**
 * Greedy min-transaction settlement algorithm.
 * Returns the minimum list of who-pays-whom to zero all debts.
 */
export function getOptimalSettlements(balances: Balance[]): SettlementSuggestion[] {
  const settlements: SettlementSuggestion[] = []

  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net)

  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.net - b.net)

  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor   = debtors[j]
    const amount   = Math.min(creditor.net, Math.abs(debtor.net))

    if (amount > 0) {
      settlements.push({ from: debtor.uid, to: creditor.uid, amount })
    }

    creditor.net -= amount
    debtor.net   += amount

    if (creditor.net === 0) i++
    if (debtor.net   === 0) j++
  }

  return settlements
}
