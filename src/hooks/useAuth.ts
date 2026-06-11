'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser]       = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
