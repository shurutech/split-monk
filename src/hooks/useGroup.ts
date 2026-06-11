'use client'

import { useEffect, useState } from 'react'
import { subscribeToGroup, subscribeToUserGroups } from '@/lib/firestore'
import type { Group } from '@/types'

export function useGroup(groupId: string) {
  const [group,   setGroup]   = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    setError(null)
    const unsub = subscribeToGroup(
      groupId,
      (g) => { setGroup(g); setLoading(false) },
      (err) => { setError(err.message); setLoading(false) },
    )
    return unsub
  }, [groupId])

  return { group, loading, error }
}

export function useUserGroups(uid: string | undefined) {
  const [groups,  setGroups]  = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const unsub = subscribeToUserGroups(uid, (gs) => {
      setGroups(gs)
      setLoading(false)
    })
    return unsub
  }, [uid])

  return { groups, loading }
}
