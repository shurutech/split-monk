'use client'

import { useEffect, useState } from 'react'
import { subscribeToExpenses, subscribeToSettlements } from '@/lib/firestore'
import type { Expense, Settlement } from '@/types'

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
