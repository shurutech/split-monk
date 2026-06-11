'use client'

import { useEffect, useState } from 'react'
import { subscribeToExpenses } from '@/lib/firestore'
import type { Expense } from '@/types'

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
