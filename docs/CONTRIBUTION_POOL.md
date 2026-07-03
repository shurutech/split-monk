# Contribution Pool Feature — End-to-End Plan

## What We're Building

Before a trip, the organiser sets a **contribution amount per person** (e.g., ₹5,000). Each member transfers that amount to the organiser (or whoever is managing the money). The system tracks who has paid their contribution and who hasn't. The pool then gets drawn down as the organiser records real expenses. At the end, final balances account for both the pool contributions AND the actual expense splits.

The mental model: **a contribution is a special expense where the organiser is the sole beneficiary of the entire amount, and each contributing member is a payer of their share.**

---

## Core Design Decision: Model Contributions as Expenses

**Don't create a new Firestore collection or a new concept.**

Instead, a contribution round is a single expense with:
- `category: 'contribution'` (new category we add to constants)
- `splitType: 'exact'` 
- `payments`: each member who has paid maps to their contribution amount
- `splits`: every member maps to their equal share (the contribution amount per person)
- `paidBy: 'multiple'` (uses existing multi-payer system)
- A flag `isContribution: true` on the expense so the UI can render it differently

Why this works:
- The balance engine already handles multi-payer expenses perfectly. A contribution is just a multi-payer expense where "the split" equals "the per-person contribution amount."
- If Sahil, Rizwan, and Byte each owe ₹5,000 and all three pay ₹5,000, the net effect is: Sahil pays +5000, Sahil's split -5000 → net 0. Same for everyone. The pool nets to zero because it's internally balanced.
- But wait — the **organiser** needs to actually hold the money and then spend it on real expenses. So the model needs to reflect that.

### Revised Model: Contributions flow to the organiser

The organiser collects the money. So the contribution expense should show:
- **paidBy/payments**: the members who contributed (Sahil ₹5k, Rizwan ₹5k, Byte ₹5k)
- **splits**: the organiser gets it all — `{ [organiserUid]: totalContribution }`

This means: each contributor gets a debit (they owe/paid their share), and the organiser gets a credit for the total amount. The organiser then spends that money via normal expenses (where they are `paidBy`), drawing down their credit balance.

The net effect at settlement time:
- If organiser spent exactly what was pooled: everyone's net is 0.
- If organiser overspent: organiser's balance is negative (he spent more than he collected), others may need to top up.
- If underspent: organiser owes the excess back to members (system shows refund settlements).

This is the **correct, zero-new-concept approach** — it works entirely within the existing balance engine.

---

## Dry Run — End-to-End Example

**Setup:** 3 members — Sahil (organiser), Rizwan, Byte. Contribution = ₹5,000/person.

---

### Step 1: Organiser sets contribution amount

Sahil opens Group Settings → sets "Contribution per person: ₹5,000".  
Firestore: `groups/gid → { contributionAmount: 500000 }` (stored in paise)

---

### Step 2: Rizwan and Byte transfer ₹5,000 each to Sahil (offline — GPay/cash)

Sahil opens "Record contributions" sheet, checks Rizwan and Byte, leaves Sahil unchecked (he's the organiser, he already has the cash).

Wait — actually Sahil also needs to contribute his own ₹5,000 to the pool. He checks all three, including himself.

Sahil hits submit. The system creates **one contribution expense**:

```
Expense doc: expenses/contrib-1
{
  title: "Trip pool — ₹5,000 per person",
  amount: 1500000,           ← ₹15,000 total (3 × ₹5,000) in paise
  paidBy: "multiple",
  payments: {
    "sahil-uid":  500000,    ← Sahil paid ₹5,000
    "rizwan-uid": 500000,    ← Rizwan paid ₹5,000
    "byte-uid":   500000,    ← Byte paid ₹5,000
  },
  splits: {
    "sahil-uid": 1500000,    ← Sahil "owes" the entire pool to himself (he holds it)
  },
  splitType: "exact",
  isContribution: true,
  category: "contribution",
}
```

---

### Step 3: Balance engine processes this contribution expense

`calculateBalances()` runs through all expenses including this one.

**From the contribution expense:**

| Who | Payment credit (+) | Split debit (−) | Net from this expense |
|-----|-------------------:|----------------:|----------------------:|
| Sahil | +₹5,000 | −₹15,000 | **−₹10,000** |
| Rizwan | +₹5,000 | ₹0 | **+₹5,000** |
| Byte | +₹5,000 | ₹0 | **+₹5,000** |

So after contributions are recorded:
- Sahil: −₹10,000 (he holds the cash, so the system says he "owes" Rizwan and Byte)
- Rizwan: +₹5,000 (he is owed)
- Byte: +₹5,000 (he is owed)

Balance invariant check: −10,000 + 5,000 + 5,000 = **0** ✓

This makes sense — Sahil has ₹15,000 of other people's money. He needs to spend it.

---

### Step 4: Trip happens — Sahil pays for expenses

**Expense A — Flight tickets: ₹9,000 total, split equally (₹3,000 each)**
```
{ amount: 900000, paidBy: "sahil-uid", splits: { sahil: 300000, rizwan: 300000, byte: 300000 } }
```

Running balance after Expense A:
| Who | Δ from Expense A | New running balance |
|-----|------------------:|--------------------:|
| Sahil | +9,000 − 3,000 = +₹6,000 | −₹10,000 + ₹6,000 = **−₹4,000** |
| Rizwan | −₹3,000 | +₹5,000 − ₹3,000 = **+₹2,000** |
| Byte | −₹3,000 | +₹5,000 − ₹3,000 = **+₹2,000** |

Sum: −4,000 + 2,000 + 2,000 = 0 ✓

**Expense B — Hotel: ₹6,000 total, split equally (₹2,000 each)**
```
{ amount: 600000, paidBy: "sahil-uid", splits: { sahil: 200000, rizwan: 200000, byte: 200000 } }
```

Running balance after Expense B:
| Who | Δ from Expense B | New running balance |
|-----|------------------:|--------------------:|
| Sahil | +6,000 − 2,000 = +₹4,000 | −₹4,000 + ₹4,000 = **₹0** |
| Rizwan | −₹2,000 | +₹2,000 − ₹2,000 = **₹0** |
| Byte | −₹2,000 | +₹2,000 − ₹2,000 = **₹0** |

**Everyone is settled. Total spent = ₹15,000 = exactly what was pooled.** 🎉

---

### Step 5: What if Sahil overspends the pool?

Add **Expense C — Meals: ₹6,000 total, split equally (₹2,000 each)**

After Expense B we were at all zeros. Now Expense C:
| Who | Δ from Expense C | New running balance |
|-----|------------------:|--------------------:|
| Sahil | +6,000 − 2,000 = +₹4,000 | **+₹4,000** |
| Rizwan | −₹2,000 | **−₹2,000** |
| Byte | −₹2,000 | **−₹2,000** |

Settlement suggestions: Rizwan → Sahil ₹2,000, Byte → Sahil ₹2,000.

Makes sense — Sahil spent ₹6,000 more than the pool covered (pool was ₹15k, spent ₹21k), so Rizwan and Byte each owe him ₹2,000 more.

---

### Step 6: What if pool is underspent?

Suppose only Expense A happened (₹9,000 spent, pool was ₹15,000).

Balances after just Expense A:
| Who | Balance |
|-----|--------:|
| Sahil | −₹4,000 |
| Rizwan | +₹2,000 |
| Byte | +₹2,000 |

Settlement suggestions: Sahil → Rizwan ₹2,000, Sahil → Byte ₹2,000.

Sahil has ₹6,000 of unspent pool money sitting in his account. The system correctly tells him to refund ₹2,000 each to Rizwan and Byte.

---

### Step 7: What if Byte didn't pay his contribution?

Sahil checks only himself and Rizwan when recording contributions:
```
payments: { sahil: 500000, rizwan: 500000 }   ← Byte not included
splits:   { sahil: 1000000 }                  ← total pool = ₹10,000 only
```

After same Expense A (₹9,000 split 3 ways, ₹3,000 each):
| Who | Contribution Δ | Expense A Δ | Net balance |
|-----|---------------:|------------:|------------:|
| Sahil | +5k − 10k = −5k | +9k − 3k = +6k | **+₹1,000** |
| Rizwan | +5k − 0 = +5k | −3k | **+₹2,000** |
| Byte | ₹0 | −₹3,000 | **−₹3,000** |

Sum: 1,000 + 2,000 − 3,000 = 0 ✓

Settlement suggestion: Byte → Sahil ₹1,000, Byte → Rizwan ₹2,000.

Byte owes ₹3,000 — his ₹5,000 contribution he didn't pay + ₹3,000 expense share − ₹5,000 that Sahil covered in the pool math = ₹3,000 net owed. System shows this automatically.

---

### What the pool card shows

```
💰 Trip Pool                              
₹5,000 per person · 2 of 3 collected     
████████░░  ₹10,000 / ₹15,000            
                                          
  ✓ Sahil    ₹5,000  paid               
  ✓ Rizwan   ₹5,000  paid               
  ✗ Byte              pending            
```

Derived entirely from the contribution expense's `payments` map — no extra Firestore reads.

---

## Data Model Changes

### 1. `Expense` type (`src/types/index.ts`)
```typescript
interface Expense {
  // ... all existing fields ...
  isContribution?: boolean   // true for contribution-round expenses
}
```

### 2. `AddExpenseInput` (`src/types/index.ts`)
```typescript
interface AddExpenseInput {
  // ... existing fields ...
  isContribution?: boolean
}
```

### 3. `Group` type — add contribution config (`src/types/index.ts`)
```typescript
interface Group {
  // ... existing fields ...
  contributionAmount?: number  // paise per person; set by organiser
}
```

Storing the target amount on the group lets us show "X of N members have contributed" without scanning expenses every time.

### 4. New category in `src/constants/index.ts`
```typescript
export const CATEGORIES = [
  // ... existing ...
  { value: 'contribution', label: 'Contribution', emoji: '💰' },
] as const
```

### 5. Firestore rules — no changes needed
Contribution expenses are just expenses. The existing rules cover them.

---

## Firestore Collections — No New Collection Needed

A contribution round is stored as a single expense doc in `/groups/{groupId}/expenses/{expenseId}` with `isContribution: true`.

To query "who has contributed": filter expenses where `isContribution === true`, look at the `payments` field to see which UIDs have contributed and how much.

---

## Balance Engine — No Changes Needed

`calculateBalances()` already handles this correctly via the multi-payer path. No modifications to `src/lib/calculations.ts`.

---

## UI Changes

### A. Group creation / settings — set contribution target

In `GroupSettingsSheet` (and optionally the `GroupForm` new-trip flow), add:

- "Contribution per person" input (optional; leave blank = no pool)
- Saves `contributionAmount` (in paise) to the group doc
- Can be changed later (before contributions are recorded)

### B. New "Contribution" UI section on the group page

When `group.contributionAmount` is set, show a card **above the tab bar**:

```
┌─────────────────────────────────────────┐
│  💰 Trip Pool                           │
│  ₹5,000 per person · 2 of 3 collected  │
│  ████████░░  ₹10,000 / ₹15,000         │
│                                         │
│  ✓ Sahil    ₹5,000                     │
│  ✓ Rizwan   ₹5,000                     │
│  ✗ Byte     pending                    │
│                                         │
│  [Record contributions]   (organiser)  │
└─────────────────────────────────────────┘
```

This card is derived by:
1. Finding all expenses where `isContribution === true`
2. Merging all their `payments` maps to get who paid and how much
3. Comparing against `group.members` to determine who is pending

### C. "Record contributions" modal/sheet (organiser only)

When the organiser clicks "Record contributions":
- Shows all members with a checkbox + amount field (pre-filled with `contributionAmount`)
- Organiser checks off who has paid and optionally adjusts amount (partial payment)
- On submit: creates ONE expense with:
  - `title`: "Trip pool contribution" (or custom)
  - `amount`: sum of all selected payments
  - `payments`: `{ [uid]: amountPaise }` for each checked member
  - `splits`: `{ [organiserUid]: totalAmount }` — all goes to organiser
  - `paidBy`: `'multiple'`
  - `isContribution`: `true`
  - `category`: `'contribution'`
  - `splitType`: `'exact'`
  - `date`: today
- This records that those members transferred money to the organiser

### D. ExpenseList — filter out contributions from default view

Contribution expenses should NOT appear in the normal expense list — they're pool management, not trip expenses. Add a filter: `expenses.filter(e => !e.isContribution)`.

But they MUST still be included in `calculateBalances()` — the balance engine needs them.

Keep them in:
- `useExpenses` hook return (full list)
- `calculateBalances()` input
- CSV export (with their own section or label)
- Stats (`totalSpend` — debatable; see edge cases)

Hide them from:
- `ExpenseList` display
- `SpendingAnalytics` charts (or show separately)

### E. BalancesTab — show contribution context

When contribution expenses exist, add a line in the "breakdown" section:
- "Contributed to pool: ₹5,000" (shown as a credit for the member)
- This is already captured in `myBreakdown.othersPaidForMe` if we model it right... 

Actually, since contributions have `splits: { organiserUid: total }`, the organiser gets the "split debt" and the members get the "payer credit". So `myBreakdown` for a contributing member shows: "you paid ₹5,000 for the organiser" which is correct — the organiser owes them back indirectly via the expenses they cover.

No changes needed to the balance engine. Optionally add a callout label "incl. pool contribution" in the breakdown.

### F. Expense detail page — contribution display

Show a special banner: "This is a pool contribution — members transferred funds to the organiser." List who paid what.

---

## Edge Cases

### 1. Partial contribution
Member pays ₹3,000 instead of ₹5,000.
- Organiser adjusts the amount in the modal.
- `payments[uid] = 3000` — the system records the partial amount correctly.
- The contribution card shows "₹3,000 / ₹5,000" for that member.
- Their balance naturally reflects the shortfall via normal settlement math.

### 2. Multiple contribution rounds
Trip runs low on money, organiser asks for a second ₹2,000 from everyone.
- Just record a second contribution expense — same flow.
- The pool card merges all `isContribution` expenses to show total collected.

### 3. Member joins after contributions are recorded
New member joins mid-trip. Contribution pool was already set up.
- They don't appear in the existing contribution expense.
- Organiser can record a new contribution expense just for the new member.
- The pool card shows their status as "pending" (₹0 paid).

### 4. Organiser is also a contributor
Yes — organiser contributes too. Their `payments` entry is in the contribution expense, and their `splits` entry is the full pool. Net effect: their split is the whole pool (debit), their payment is their personal share (credit), so they still "owe" the other members' portions until they spend the money on expenses.

Wait — this is the one subtle point. If we model `splits: { organiserUid: totalAmount }`, the organiser absorbs the entire pool as a debit. Then each real expense they pay (as `paidBy`) gives them credits. The members who paid contributions have credits from `payments`. The math works.

### 5. Organiser overspends the pool
E.g., pool is ₹15,000 but organiser spent ₹18,000. Organiser's balance will be `-₹3,000` (they are net owed). The settlement algorithm will suggest other members pay the organiser ₹1,000 each. This is correct — the pool ran out and the organiser covered the excess.

### 6. Pool underspent / refund
E.g., pool is ₹15,000 but only ₹12,000 was spent. Organiser's balance is `+₹3,000` (they have excess funds). The settlement algorithm will suggest organiser pays each member back ₹1,000. The UI can label these as "refund" in the BalancesTab.

### 7. Member with no contribution (forgot to pay)
Their `payments` map entry is absent in the contribution expense. Their balance shows them owing the organiser their contribution amount. Settlement algorithm surfaces this. The pool card shows them as "pending". Works automatically.

### 8. Trip cancelled before contributions are spent
All contributions are in the system. `isContribution` expenses credit the organiser. Since the organiser hasn't spent the money (no real expenses), the organiser's balance is deeply negative (owes everyone back). Settlement algorithm correctly tells organiser to refund each member. No special cancellation logic needed.

### 9. `totalSpend` stat card
Should we include contribution amounts in "Total spent"? 

Recommendation: **NO** — contributions are pool management, not actual spending. Filter them out of the `totalSpend` calculation:
```typescript
const totalSpend = expenses.filter(e => !e.isContribution).reduce((sum, e) => sum + e.amount, 0)
```

But keep them in balance calculation.

### 10. CSV export
Add a separate section for contribution rows or add a "Contribution" marker in the Type column. The `resolvePaidBy()` function already handles multi-payer format.

---

## Implementation Sequence

### Phase 1 — Data layer (no UI yet)
1. Add `isContribution?: boolean` to `Expense` type and `AddExpenseInput`
2. Add `contributionAmount?: number` to `Group` type
3. Add `'contribution'` category to constants
4. Update `docToExpense` in `firestore.ts` to deserialize `isContribution`
5. Ensure `addExpense` passes `isContribution` through to Firestore
6. Update `updateGroup` in `firestore.ts` to accept `contributionAmount`

### Phase 2 — Group settings
7. Add "Contribution per person" field in `GroupSettingsSheet`
8. Add same field in `GroupForm` (new trip creation) — optional

### Phase 3 — Pool card + contribution recording
9. Build `ContributionPoolCard` component
   - Reads from `expenses.filter(e => e.isContribution)`
   - Shows progress bar, per-member status
   - Organiser-only "Record contributions" button
10. Build `RecordContributionsSheet` component
    - Member checkboxes + amount inputs (pre-filled)
    - On submit: calls `addExpense()` with contribution payload
11. Wire `ContributionPoolCard` into group page (above tabs, when `group.contributionAmount` is set)

### Phase 4 — Display hygiene
12. Filter `isContribution` expenses out of `ExpenseList` display
13. Filter them out of `totalSpend` stat card
14. Filter them out of `SpendingAnalytics`
15. Add `isContribution` label in expense detail page
16. Update CSV export to label contribution rows

### Phase 5 — BalancesTab polish (optional)
17. Add "Pool contribution: ₹X" callout in `myBreakdown` section when contribution expenses exist

---

## Files Touched

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `isContribution?` to `Expense` + `AddExpenseInput`; add `contributionAmount?` to `Group` |
| `src/constants/index.ts` | Add `contribution` category |
| `src/lib/firestore.ts` | `docToExpense` deserializes `isContribution`; `updateGroup` accepts `contributionAmount` |
| `src/app/(app)/groups/[id]/page.tsx` | Filter contributions from `totalSpend`; render `ContributionPoolCard` |
| `src/components/groups/GroupSettingsSheet.tsx` | Add contribution amount field |
| `src/components/groups/GroupForm.tsx` | Add optional contribution amount field |
| `src/components/groups/ContributionPoolCard.tsx` | New component — pool status display |
| `src/components/groups/RecordContributionsSheet.tsx` | New component — record who paid |
| `src/components/expenses/ExpenseList.tsx` | Filter `isContribution` from display |
| `src/components/groups/SpendingAnalytics.tsx` | Exclude contributions from charts |
| `src/app/(app)/groups/[id]/expenses/[eid]/page.tsx` | Show "pool contribution" banner |
| `src/lib/export.ts` | Label contribution rows in CSV |

**Files NOT touched:**
- `src/lib/calculations.ts` — balance engine needs zero changes
- `firestore.rules` — no new collections or permission models
- `src/hooks/useExpenses.ts` — contributions are just expenses; hooks work as-is

---

## What We Explicitly Don't Do

- No new Firestore collection (`/contributions`)
- No changes to settlement recording
- No changes to the balance algorithm
- No "pool account" abstraction
- No blocking of expense recording until contributions are paid (too restrictive)
- No forced equal contributions (organiser can record partial amounts freely)
