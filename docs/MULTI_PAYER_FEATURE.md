# Multi-Payer Expense — Feature Plan

## The Problem

Today `paidBy: string` — one person per expense. Real-world case: hotel ₹15,000 where Sahil paid ₹9,000 and Rizwan paid ₹6,000. There's no way to record this as one expense.

---

## Approach: Backwards-Compatible Model Extension

Never change what's already in Firestore. Extend the model so:
- Old expenses (`paidBy` field present, no `payments` field) → continue to work exactly as before
- New multi-payer expenses (`payments` field present) → handled by new logic

No migration. No touching prod data. Both shapes coexist.

---

## Data Model Change

### Current
```typescript
interface Expense {
  paidBy: string           // single payer uid
  amount: number           // total in paise
  splits: Split            // uid → share in paise
}
```

### New (additive only)
```typescript
interface Expense {
  paidBy:   string                    // kept for backwards compat — primary payer or 'multiple'
  payments?: Record<string, number>   // uid → amount paid in paise (only set for multi-payer)
  amount:   number                    // total still a single number — sum of all payments
  splits:   Split                     // unchanged — uid → share in paise
}
```

**Rules:**
- If `payments` is absent → single payer, use `paidBy` as before (all old expenses)
- If `payments` is present → multi-payer, `paidBy` is set to `'multiple'` as a sentinel
- `sum(payments.values()) === amount` always
- `sum(splits.values()) === amount` always (unchanged invariant)

---

## Balance Engine Change (`src/lib/calculations.ts`)

### Current logic
```
net[expense.paidBy] += expense.amount   // payer gets full credit
net[uid] -= share                        // each participant gets debited their share
```

### New logic (3 lines change)
```typescript
if (expense.payments) {
  // Multi-payer: each payer gets credit for what they actually paid
  Object.entries(expense.payments).forEach(([uid, paid]) => {
    net[uid] = (net[uid] ?? 0) + paid
  })
} else {
  // Single payer: existing behaviour untouched
  net[expense.paidBy] = (net[expense.paidBy] ?? 0) + expense.amount
}
// splits side is unchanged
Object.entries(expense.splits).forEach(([key, share]) => {
  net[key] = (net[key] ?? 0) - share
})
```

No other change to calculations. Settlement algorithm unchanged. Balance invariant still holds because `sum(payments) === amount === sum(splits)`.

---

## Firestore Write (`src/lib/firestore.ts`)

### `addExpense` — add optional `payments` field
```typescript
tx.set(expRef, {
  title, amount, splitType, splits, date, notes, category, createdBy,
  paidBy:    data.payments ? 'multiple' : data.paidBy,
  ...(data.payments ? { payments: data.payments } : {}),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  isDeleted: false,
})
```

### `AddExpenseInput` type change
```typescript
interface AddExpenseInput {
  // existing fields unchanged
  paidBy:    string
  payments?: Record<string, number>   // only set for multi-payer
}
```

---

## UI/UX — Add Expense Form (`src/app/(app)/groups/[id]/add/page.tsx`)

### "Paid by" section redesign

**Current:** Horizontal scrollable avatar chips, tap one to select.

**New:** Same chips, but add a **"Multiple people paid"** toggle below the row.

```
Paid by
[ Sahil ]  [ Rizwan ]  [ Nityam ]  [ Agastya ]     ← tap one for single payer

[ + Multiple people paid ]                           ← toggle button
```

When "Multiple people paid" is ON, the chip row changes to **amount inputs per person** instead of a selection:

```
Paid by (multiple)
[ Sahil    ₹ [9000] ]
[ Rizwan   ₹ [6000] ]
[ Nityam   ₹ [____] ]
[ Agastya  ₹ [____] ]

Total paid: ₹15,000 / ₹15,000  ✓       ← running total like exact split
```

Only people with a non-zero amount entered are considered payers.
Validation: sum of all payment amounts must equal the total expense amount.

### State additions
```typescript
const [multiPayer,    setMultiPayer]    = useState(false)
const [paymentAmts,   setPaymentAmts]   = useState<Record<string, string>>({})  // uid → rupee string
```

### Validation additions
- If `multiPayer`: sum of `paymentAmts` (in paise) must equal `amountPaise`
- At least 1 person must have a non-zero payment amount
- Error shown inline same as exact split running total

---

## UI/UX — Expense Card (`src/components/expenses/ExpenseCard.tsx`)

**Current:** "Paid by Sahil"

**New:**
- Single payer → "Paid by Sahil" (unchanged)
- Multi-payer → "Paid by 2 people" with a subtle expand or tooltip

```
[ Hotel booking          ₹15,000 ]
  Paid by Sahil, Rizwan · 4 people · 12 Jun
```

---

## UI/UX — Expense List & BalancesTab

No changes needed. The balance engine change handles multi-payer transparently.

---

## CSV Export (`src/lib/export.ts`)

**Current:** "Paid By" column = single name

**New:**
- Single payer → name as before
- Multi-payer → "Sahil (₹9,000), Rizwan (₹6,000)"

```typescript
function resolvePaidBy(e: Expense): string {
  if (!e.payments) return resolveName(e.paidBy)
  return Object.entries(e.payments)
    .map(([uid, amt]) => `${resolveName(uid)} (₹${toRupees(amt).toFixed(2)})`)
    .join(', ')
}
```

---

## Reminder Email (`src/components/balances/BalancesTab.tsx` → `/api/remind`)

`buildReminderPayload` currently does:
```typescript
.filter((e) => e.paidBy === s.to && (e.splits[s.from] ?? 0) > 0)
```

For multi-payer, need to also include expenses where `s.to` is in `e.payments`:
```typescript
.filter((e) => {
  const creditorPaid = e.payments
    ? (e.payments[s.to] ?? 0) > 0
    : e.paidBy === s.to
  return creditorPaid && (e.splits[s.from] ?? 0) > 0
})
```

---

## Files Changed — Summary

| File | Change | Risk |
|---|---|---|
| `src/types/index.ts` | Add optional `payments` field to `Expense` and `AddExpenseInput` | Zero — additive |
| `src/lib/calculations.ts` | Handle `payments` in balance engine | Low — old path unchanged |
| `src/lib/firestore.ts` | Write `payments` field when present | Zero — additive write |
| `src/app/(app)/groups/[id]/add/page.tsx` | Multi-payer toggle + payment inputs | UI only |
| `src/components/expenses/ExpenseCard.tsx` | Show "Paid by X, Y" for multi-payer | Display only |
| `src/lib/export.ts` | Multi-payer in "Paid By" CSV column | Display only |
| `src/components/balances/BalancesTab.tsx` | Fix reminder expense filter | Minor |

---

## What Does NOT Change

- Firestore security rules — no new collections or fields that need rule changes
- All existing expenses — `paidBy` is still present, `payments` absent → old code path runs
- Settlement algorithm — unchanged
- `splits` structure — unchanged
- Balance invariant `sum === 0` — still holds
- `resolvePendingInvites` — payments are by UID only, emails don't pay

---

## Prod Safety Checklist

- [ ] Deploy with feature flag? No — old data is untouched, new field is optional
- [ ] Firestore index changes? No — no new queries
- [ ] Migration needed? No — backwards compatible by design
- [ ] Rollback plan? Remove the UI toggle — old expenses unaffected, any new multi-payer expenses degrade gracefully (balance engine would treat `paidBy: 'multiple'` as zero credit, so rollback would corrupt new expenses only)
- [ ] Test before ship: add one multi-payer expense on staging, verify balance sum === 0, verify old expenses unaffected

---

## Build Order

1. `types/index.ts` — add `payments` field
2. `calculations.ts` — update balance engine
3. `firestore.ts` — update `addExpense` write
4. `add/page.tsx` — multi-payer UI
5. `ExpenseCard.tsx` — display update
6. `export.ts` — CSV update
7. `BalancesTab.tsx` — reminder filter fix
