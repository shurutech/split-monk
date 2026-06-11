'use client'

import { useEffect, useState } from 'react'
import { subscribeToExpenses, subscribeToSettlements } from '@/lib/firestore'
import { calculateBalances } from '@/lib/calculations'
import type { Expense, Settlement, Group } from '@/types'

export function useExpenses(groupId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!groupId) { setLoading(false); return }
    setLoading(true)
    const unsub = subscribeToExpenses(groupId, (exps) => {
      setExpenses(exps)
      setLoading(false)
    })
    return unsub
  }, [groupId])

  return { expenses, loading }
}

export function useSettlements(groupId: string | undefined) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!groupId) { setLoading(false); return }
    setLoading(true)
    const unsub = subscribeToSettlements(groupId, (ss) => {
      setSettlements(ss)
      setLoading(false)
    })
    return unsub
  }, [groupId])

  return { settlements, loading }
}

/**
 * Aggregates the current user's net balance across multiple active groups.
 * Subscribes to expenses + settlements for each group in parallel.
 * Returns { net, loading } where net > 0 means you are owed, net < 0 means you owe.
 */
export function useNetBalance(uid: string | undefined, groups: Group[]) {
  // Per-group state: expenses and settlements keyed by groupId
  const [expMap,  setExpMap]  = useState<Record<string, Expense[]>>({})
  const [settMap, setSettMap] = useState<Record<string, Settlement[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid || groups.length === 0) { setLoading(false); return }

    setLoading(true)
    const unsubs: (() => void)[] = []

    // Track how many groups have fired at least once
    const ready = new Set<string>()

    groups.forEach((g) => {
      const unsubExp = subscribeToExpenses(g.id, (exps) => {
        setExpMap((prev) => ({ ...prev, [g.id]: exps }))
        ready.add(`exp-${g.id}`)
        if (ready.size === groups.length * 2) setLoading(false)
      })
      const unsubSett = subscribeToSettlements(g.id, (ss) => {
        setSettMap((prev) => ({ ...prev, [g.id]: ss }))
        ready.add(`sett-${g.id}`)
        if (ready.size === groups.length * 2) setLoading(false)
      })
      unsubs.push(unsubExp, unsubSett)
    })

    return () => unsubs.forEach((u) => u())
  }, [uid, groups.map((g) => g.id).join(',')])

  const net = groups.reduce((total, g) => {
    const exps  = expMap[g.id]  ?? []
    const setts = settMap[g.id] ?? []
    const balances = calculateBalances(exps, g.members, g.pendingInvites ?? [], setts)
    const mine = balances.find((b) => b.uid === uid)
    return total + (mine?.net ?? 0)
  }, 0)

  return { net, loading }
}
