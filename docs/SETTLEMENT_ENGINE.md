# SplitMonk — How the Settlement Engine Works

> This document explains exactly how SplitMonk calculates who owes whom, how it figures out the smartest way to settle up, and how every rupee is accounted for — with real examples and step-by-step dry runs. No technical background needed.

---

## Table of Contents

1. [The Core Idea](#1-the-core-idea)
2. [Money is stored in Paise, not Rupees](#2-money-is-stored-in-paise-not-rupees)
3. [Step 1 — Splitting an Expense](#3-step-1--splitting-an-expense)
   - Equal Split
   - Exact Split
   - Percentage Split
4. [Step 2 — Calculating Balances](#4-step-2--calculating-balances)
5. [Step 3 — Finding the Optimal Settlements](#5-step-3--finding-the-optimal-settlements)
6. [Full Trip Dry Run (4 people, 5 expenses)](#6-full-trip-dry-run-4-people-5-expenses)
7. [How Settlements Reduce Balances](#7-how-settlements-reduce-balances)
8. [Edge Cases Handled](#8-edge-cases-handled)
9. [The Golden Rule — The Invariant](#9-the-golden-rule--the-invariant)

---

## 1. The Core Idea

SplitMonk works in three stages every time you look at the Balances tab:

```
Expenses  →  Calculate net balance per person  →  Find minimum payments to zero everything out
```

**It never stores "X owes Y" directly.** Instead it calculates everyone's running net from scratch every time using all expenses and all recorded settlements. This means:

- Editing or deleting an expense instantly updates everyone's balance
- There is no stale data
- The math is always provably correct

---

## 2. Money is Stored in Paise, not Rupees

SplitMonk stores every amount internally in **paise** (₹1 = 100 paise).

**Why?** Floating point arithmetic in computers is notoriously inaccurate with decimals. For example:

```
0.1 + 0.2 = 0.30000000000000004  ← computers do this
```

By working in whole numbers (paise), every calculation is exact. ₹100 is stored as `10000`. ₹33.33 is stored as `3333`.

You never see paise — the app converts back to rupees for display using `formatINR()`.

---

## 3. Step 1 — Splitting an Expense

When you add an expense, you choose how to split it. There are three modes.

---

### Equal Split

The total is divided equally among all selected members. If the division leaves a remainder (because paise don't divide perfectly), **the extra paise go to the payer** — so the total always adds up exactly.

**Example: Shubham pays ₹100 for dinner. Split among Shubham, Sahil, Priya.**

```
Total: ₹100 = 10,000 paise
Members: 3
Base share: floor(10000 / 3) = 3333 paise each
Remainder: 10000 - (3333 × 3) = 1 paise

Shubham (payer) gets the remainder:
  Shubham → 3333 + 1 = 3334 paise (₹33.34)
  Sahil   → 3333 paise (₹33.33)
  Priya   → 3333 paise (₹33.33)

Total: 3334 + 3333 + 3333 = 10,000 ✅
```

---

### Exact Split

You manually enter each person's share. SplitMonk validates that your numbers add up exactly to the total before saving.

**Example: Sahil pays ₹500 for supplies. Shubham uses more, so custom split.**

```
Total: ₹500 = 50,000 paise

You enter:
  Shubham → ₹300
  Sahil   → ₹200

Check: 30,000 + 20,000 = 50,000 ✅  → Saved
Check: 30,000 + 15,000 = 45,000 ✗  → Error: "Amounts are off by ₹50 — add more"
```

---

### Percentage Split

You enter each person's percentage. Must add up to exactly 100%. SplitMonk converts percentages to paise amounts, and the **last person in the list absorbs any rounding difference** so the total is always exact.

**Example: Priya pays ₹1,200 for hotel. Split 25% / 25% / 50%.**

```
Total: ₹1,200 = 1,20,000 paise

Sahil   25% → floor(0.25 × 120000) = 30,000 paise (₹300)
Shubham 25% → floor(0.25 × 120000) = 30,000 paise (₹300)
Priya   50% → 120000 - 30000 - 30000 = 60,000 paise (₹600)  ← absorbs remainder

Total: 30000 + 30000 + 60000 = 120,000 ✅
```

---

## 4. Step 2 — Calculating Balances

After splitting, SplitMonk has a `splits` object for each expense — a map of who owes how much of that expense. The balance engine processes all expenses to find each person's **net position**.

### The Formula

For each expense:
- **Payer gets credited** the full amount (they are owed that money back)
- **Each person in splits gets debited** their share (they owe that amount)

```
net[payer]      += full_amount
net[each_person] -= their_share
```

Settlements are then applied on top:
```
net[from] += settlement_amount  (they paid, so their debt reduces)
net[to]   -= settlement_amount  (they received, so what's owed to them reduces)
```

### Dry Run — 3 people, 2 expenses

**Trip members: Sahil, Shubham, Priya**

**Expense 1:** Shubham pays ₹300 for rickshaw. Equal split among all 3.
```
splits: { Shubham: 10000, Sahil: 10000, Priya: 10000 }  (₹100 each)

net[Shubham] += 30000  → +30000  (paid ₹300)
net[Shubham] -= 10000  → +20000  (owes his share)
net[Sahil]   -= 10000  → -10000  (owes his share)
net[Priya]   -= 10000  → -10000  (owes her share)
```

**Expense 2:** Sahil pays ₹600 for dinner. Equal split among all 3.
```
splits: { Sahil: 20000, Shubham: 20000, Priya: 20000 }  (₹200 each)

net[Sahil]   += 60000  → +50000  (paid ₹600, was already -10000)
net[Sahil]   -= 20000  → +30000  (owes his share)
net[Shubham] -= 20000  → 0       (owes his share, was already +20000)
net[Priya]   -= 20000  → -30000  (owes her share, was already -10000)
```

**Final balances:**
```
Sahil:   +₹300  ← owed ₹300
Shubham:  ₹0    ← all square
Priya:   -₹300  ← owes ₹300
```

**Sum check: 300 + 0 + (−300) = 0 ✅**

---

## 5. Step 3 — Finding the Optimal Settlements

Once we have net balances, the settlement algorithm figures out the **minimum number of payments** needed to zero everyone out.

### The Algorithm (Greedy Matching)

1. Separate people into two lists: **creditors** (net > 0, are owed money) and **debtors** (net < 0, owe money)
2. Sort both lists — biggest creditor first, biggest debtor first
3. Match the largest debtor to the largest creditor:
   - Payment amount = the smaller of the two (debtor's debt or creditor's credit)
   - Record `debtor pays creditor that amount`
   - Reduce both balances by that amount
   - If either reaches zero, move to the next person
4. Repeat until everyone is at zero

### Why this minimises transactions

Instead of everyone paying back the exact person they borrowed from (which could mean 10 separate payments for 5 people), the algorithm **nets everything out** and finds direct transfers.

**Classic example — chain debt:**

```
Amit  owes Bhanu ₹500
Bhanu owes Charu ₹500

Naive approach: 2 payments (Amit→Bhanu, Bhanu→Charu)
Smart approach: 1 payment (Amit→Charu ₹500)

Bhanu's incoming and outgoing cancel out — he never needs to touch the money.
```

### Dry Run — 4 people

```
Balances:
  Arjun:  -₹400  (owes)
  Bharat: -₹100  (owes)
  Charu:  +₹300  (owed)
  Divya:  +₹200  (owed)

Sum: -400 - 100 + 300 + 200 = 0 ✅

Step 1:
  Debtors (sorted):  Arjun -400, Bharat -100
  Creditors (sorted): Charu +300, Divya +200

  Match Arjun (-400) with Charu (+300):
    Payment = min(400, 300) = 300
    → Arjun pays Charu ₹300
    Arjun remaining: -100
    Charu remaining:   0  ← done, move to next creditor

Step 2:
  Match Arjun (-100) with Divya (+200):
    Payment = min(100, 200) = 100
    → Arjun pays Divya ₹100
    Arjun remaining:   0  ← done
    Divya remaining: +100

Step 3:
  Match Bharat (-100) with Divya (+100):
    Payment = min(100, 100) = 100
    → Bharat pays Divya ₹100
    Both reach 0 ← done

Result: 3 payments instead of potentially 6+
  ✅ Arjun  → Charu  ₹300
  ✅ Arjun  → Divya  ₹100
  ✅ Bharat → Divya  ₹100
```

---

## 6. Full Trip Dry Run (4 people, 5 expenses)

**Trip: Goa 2025 — Sahil, Shubham, Priya, Ankit**

| # | Who Paid | What | Amount | Split Among |
|---|----------|------|--------|-------------|
| 1 | Sahil    | Hotel (2 nights) | ₹8,000 | All 4, equal |
| 2 | Shubham  | Cab from airport | ₹1,200 | All 4, equal |
| 3 | Priya    | Dinner Day 1 | ₹3,600 | All 4, equal |
| 4 | Ankit    | Water sports | ₹2,000 | Sahil ₹500, Shubham ₹500, Ankit ₹1,000 (exact) |
| 5 | Sahil    | Breakfast | ₹800 | Sahil only (he ate alone — payer = only split member) |

---

### Expense 1: Hotel ₹8,000 — Sahil pays, all 4 equal

```
Each share: floor(800000 / 4) = 200000 paise = ₹2,000
Remainder: 0

splits: { Sahil: 200000, Shubham: 200000, Priya: 200000, Ankit: 200000 }

net[Sahil]   += 800000 - 200000 = +600000  (+₹6,000)
net[Shubham] -= 200000           = -200000  (-₹2,000)
net[Priya]   -= 200000           = -200000  (-₹2,000)
net[Ankit]   -= 200000           = -200000  (-₹2,000)
```

### Expense 2: Cab ₹1,200 — Shubham pays, all 4 equal

```
Each share: floor(120000 / 4) = 30000 paise = ₹300
Remainder: 0

net[Sahil]   -= 30000   →  +570000  (+₹5,700)
net[Shubham] += 120000  →  -80000   (-₹800)   (paid ₹1200, owes ₹300)
net[Shubham] -= 30000   →  -80000
  wait, let's track carefully:
  Shubham was: -200000
  +120000 (paid) → -80000
  -30000  (share) → -110000  (-₹1,100)

net[Priya]   -= 30000   → -230000  (-₹2,300)
net[Ankit]   -= 30000   → -230000  (-₹2,300)
```

### Expense 3: Dinner ₹3,600 — Priya pays, all 4 equal

```
Each share: ₹900

net[Sahil]   -= 90000   →  +480000  (+₹4,800)
net[Shubham] -= 90000   →  -200000  (-₹2,000)
net[Priya]   += 360000  →  +130000  (was -230000, paid 360000, owes 90000 → +130000)
net[Priya]   -= 90000   →  +130000
  Priya: -230000 + 360000 - 90000 = +40000  (+₹400)
net[Ankit]   -= 90000   →  -320000  (-₹3,200)
```

### Expense 4: Water sports ₹2,000 — Ankit pays, exact split

```
Sahil ₹500, Shubham ₹500, Ankit ₹1,000

net[Sahil]   -= 50000   →  +430000  (+₹4,300)
net[Shubham] -= 50000   →  -250000  (-₹2,500)
net[Ankit]   += 200000  →  -120000  (was -320000, paid 200000, owes 100000)
net[Ankit]   -= 100000  →  -120000
  Ankit: -320000 + 200000 - 100000 = -220000  (-₹2,200)
```

### Expense 5: Breakfast ₹800 — Sahil pays, only Sahil

```
splits: { Sahil: 80000 }

net[Sahil] += 80000  →  +510000
net[Sahil] -= 80000  →  +430000  (net unchanged — he paid for himself)
```

---

### Final Balances

```
Sahil:   +₹4,300  ← is owed ₹4,300
Shubham: -₹2,500  ← owes ₹2,500
Priya:   +₹400    ← is owed ₹400
Ankit:   -₹2,200  ← owes ₹2,200

Sum: 4300 - 2500 + 400 - 2200 = 0 ✅
```

---

### Settlement Suggestions

```
Creditors (sorted by amount): Sahil +4300, Priya +400
Debtors (sorted by amount):   Shubham -2500, Ankit -2200

Step 1: Match Shubham (-2500) with Sahil (+4300)
  Payment = min(2500, 4300) = 2500
  → Shubham pays Sahil ₹2,500
  Shubham: 0 ✅
  Sahil: +4300 - 2500 = +1800

Step 2: Match Ankit (-2200) with Sahil (+1800)
  Payment = min(2200, 1800) = 1800
  → Ankit pays Sahil ₹1,800
  Sahil: 0 ✅
  Ankit: -2200 + 1800 = -400

Step 3: Match Ankit (-400) with Priya (+400)
  Payment = min(400, 400) = 400
  → Ankit pays Priya ₹400
  Both: 0 ✅
```

**Final result: 3 payments settle the entire trip**
```
✅ Shubham → Sahil  ₹2,500
✅ Ankit   → Sahil  ₹1,800
✅ Ankit   → Priya  ₹400
```

---

## 7. How Settlements Reduce Balances

When someone marks a payment as settled in the app, that settlement is stored and applied to the balance calculation in real time.

**Example: Shubham pays Sahil ₹2,500**

Before settlement:
```
Sahil:   +₹4,300
Shubham: -₹2,500
```

After recording settlement `{ from: Shubham, to: Sahil, amount: ₹2,500 }`:
```
net[Shubham] += 2500  →  0        ✅ fully settled
net[Sahil]   -= 2500  →  +₹1,800  (still owed by Ankit)
```

The app updates the balance view instantly — no page refresh needed.

---

## 8. Edge Cases Handled

### Deleted expenses
Soft-deleted expenses (`isDeleted: true`) are completely excluded from balance calculations. Deleting an expense instantly adjusts everyone's balance as if it never happened.

### Pending invites (people not yet signed up)
People invited by email but not yet signed in appear as email keys in splits (e.g. `rahul@gmail.com`). Their balances are tracked correctly. Once they sign in, all their split keys are migrated from email → their real user ID automatically.

### Rounding (1 paise off)
When splitting odd amounts, 1 paise of remainder is assigned to the payer. This means the invariant (sum = 0) may be off by at most 1 paise — the engine allows this tolerance with `Math.abs(sum) <= 1`.

### Single-person split
If an expense is split with only 1 person (e.g. Shubham pays ₹50 for Sahil's repair), the balance engine handles it correctly: Shubham +50, Sahil -50.

### Circular debts
If A owes B ₹100, B owes C ₹100, and C owes A ₹100 — all three net balances are zero. The settlement algorithm produces zero payments. Nobody needs to pay anyone.

### Mutual debts
If A owes B ₹500 across one expense, and B owes A ₹300 across another, these are automatically netted: A owes B ₹200 (1 payment, not 2).

---

## 9. The Golden Rule — The Invariant

**At all times, the sum of all net balances in a group must equal zero.**

```
sum(all net balances) = 0
```

This is mathematically guaranteed because:
- Every rupee paid by someone is owed by someone else in exactly equal measure
- Settlements move the same amount from one person to another — the total doesn't change

If this invariant is ever violated by more than 1 paise (rounding tolerance), the app logs an error to the console. This has never happened in practice.

This invariant is your guarantee that **no money appears or disappears** inside SplitMonk. Every paisa is accounted for.

---

*Last updated: June 2026 · SplitMonk · Built for the Shuru team*
