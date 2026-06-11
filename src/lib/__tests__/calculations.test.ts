import { describe, it, expect } from 'vitest'
import {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateBalances,
  getOptimalSettlements,
  toPaise,
} from '../calculations'
import type { Expense } from '@/types'

const makeExpense = (overrides: Partial<Expense>): Expense => ({
  id: 'e1',
  title: 'Test',
  amount: 10000,
  paidBy: 'A',
  splitType: 'equal',
  splits: {},
  date: new Date(),
  category: 'other',
  createdBy: 'A',
  createdAt: new Date(),
  updatedAt: new Date(),
  isDeleted: false,
  ...overrides,
})

describe('calculateEqualSplit', () => {
  it('splits ₹100 among 3 — remainder goes to payer', () => {
    const splits = calculateEqualSplit(toPaise(100), ['A', 'B', 'C'], 'A')
    expect(splits['A']).toBe(3334) // 33 + 1 remainder
    expect(splits['B']).toBe(3333)
    expect(splits['C']).toBe(3333)
    expect(splits['A'] + splits['B'] + splits['C']).toBe(toPaise(100))
  })

  it('splits ₹18,000 among 4 exactly', () => {
    const splits = calculateEqualSplit(toPaise(18000), ['A', 'B', 'C', 'D'], 'A')
    expect(splits['A']).toBe(toPaise(4500))
    expect(splits['B']).toBe(toPaise(4500))
    const total = Object.values(splits).reduce((a, b) => a + b, 0)
    expect(total).toBe(toPaise(18000))
  })
})

describe('calculateExactSplit', () => {
  it('returns no error when sum matches total', () => {
    const result = calculateExactSplit(10000, { A: 6000, B: 4000 })
    expect(result.error).toBeNull()
  })

  it('returns error when sum does not match', () => {
    const result = calculateExactSplit(10000, { A: 6000, B: 3000 })
    expect(result.error).toContain('off by')
  })
})

describe('calculatePercentageSplit', () => {
  it('splits ₹1,200 at 25/25/50', () => {
    const result = calculatePercentageSplit(toPaise(1200), { A: 25, B: 25, C: 50 })
    expect(result.error).toBeNull()
    expect(result.splits['A']).toBe(toPaise(300))
    expect(result.splits['B']).toBe(toPaise(300))
    expect(result.splits['C']).toBe(toPaise(600))
    const total = Object.values(result.splits).reduce((a, b) => a + b, 0)
    expect(total).toBe(toPaise(1200))
  })

  it('returns error when percentages do not sum to 100', () => {
    const result = calculatePercentageSplit(10000, { A: 40, B: 40 })
    expect(result.error).toContain('100%')
  })
})

describe('calculateBalances', () => {
  it('balance invariant: sum of all net balances === 0', () => {
    const expenses = [
      makeExpense({ paidBy: 'A', amount: 10000, splits: { A: 3334, B: 3333, C: 3333 } }),
      makeExpense({ paidBy: 'B', amount: 6000, splits: { A: 3000, B: 3000 } }),
    ]
    const balances = calculateBalances(expenses, ['A', 'B', 'C'])
    const sum = balances.reduce((a, b) => a + b.net, 0)
    expect(Math.abs(sum)).toBeLessThanOrEqual(1)
  })

  it('payer in split: correct net', () => {
    // A pays ₹100 and is also in the equal split with B
    const splits = calculateEqualSplit(toPaise(100), ['A', 'B'], 'A')
    const expense = makeExpense({ paidBy: 'A', amount: toPaise(100), splits })
    const balances = calculateBalances([expense], ['A', 'B'])
    const aBalance = balances.find((b) => b.uid === 'A')!
    const bBalance = balances.find((b) => b.uid === 'B')!
    expect(aBalance.net).toBe(toPaise(50))   // paid 100, owes 50 → net +50
    expect(bBalance.net).toBe(-toPaise(50))  // owes 50
  })

  it('mutual debt: A owes B ₹200, B owes A ₹300 → B owes A ₹100 net', () => {
    const expenses = [
      makeExpense({ paidBy: 'B', amount: toPaise(200), splits: { A: toPaise(200) } }),
      makeExpense({ paidBy: 'A', amount: toPaise(300), splits: { B: toPaise(300) } }),
    ]
    const balances = calculateBalances(expenses, ['A', 'B'])
    const aBalance = balances.find((b) => b.uid === 'A')!
    const bBalance = balances.find((b) => b.uid === 'B')!
    expect(aBalance.net).toBe(toPaise(100))
    expect(bBalance.net).toBe(-toPaise(100))
  })

  it('excludes soft-deleted expenses', () => {
    const expenses = [
      makeExpense({ paidBy: 'A', amount: 10000, splits: { A: 5000, B: 5000 }, isDeleted: true }),
    ]
    const balances = calculateBalances(expenses, ['A', 'B'])
    balances.forEach((b) => expect(b.net).toBe(0))
  })
})

describe('getOptimalSettlements', () => {
  it('A owes B ₹500, B owes C ₹500 → A pays C ₹500 (1 transaction)', () => {
    const balances = [
      { uid: 'A', net: -toPaise(500) },
      { uid: 'B', net: 0 },
      { uid: 'C', net: toPaise(500) },
    ]
    const settlements = getOptimalSettlements(balances)
    expect(settlements).toHaveLength(1)
    expect(settlements[0]).toMatchObject({ from: 'A', to: 'C', amount: toPaise(500) })
  })

  it('circular debt A→B, B→C, C→A each ₹100 → no transactions (all net 0)', () => {
    const expenses = [
      makeExpense({ paidBy: 'A', amount: toPaise(100), splits: { B: toPaise(100) } }),
      makeExpense({ paidBy: 'B', amount: toPaise(100), splits: { C: toPaise(100) } }),
      makeExpense({ paidBy: 'C', amount: toPaise(100), splits: { A: toPaise(100) } }),
    ]
    const balances    = calculateBalances(expenses, ['A', 'B', 'C'])
    const settlements = getOptimalSettlements(balances)
    expect(settlements).toHaveLength(0)
  })

  it('multiple creditors and debtors: minimises transactions', () => {
    // A net -300, B net -200, C net +300, D net +200
    const balances = [
      { uid: 'A', net: -toPaise(300) },
      { uid: 'B', net: -toPaise(200) },
      { uid: 'C', net: toPaise(300) },
      { uid: 'D', net: toPaise(200) },
    ]
    const settlements = getOptimalSettlements(balances)
    const totalPaid = settlements.reduce((a, s) => a + s.amount, 0)
    expect(totalPaid).toBe(toPaise(500))
    // Min transactions: 2 (A→C 300, B→D 200)
    expect(settlements.length).toBeLessThanOrEqual(3)
  })

  it('after applying all settlements, sum of balances reaches zero', () => {
    const balances = [
      { uid: 'A', net: -toPaise(400) },
      { uid: 'B', net: toPaise(150) },
      { uid: 'C', net: toPaise(250) },
    ]
    const settlements = getOptimalSettlements(balances)
    const copy = balances.map((b) => ({ ...b }))
    settlements.forEach(({ from, to, amount }) => {
      copy.find((b) => b.uid === from)!.net += amount
      copy.find((b) => b.uid === to)!.net   -= amount
    })
    copy.forEach((b) => expect(Math.abs(b.net)).toBeLessThanOrEqual(1))
  })
})
