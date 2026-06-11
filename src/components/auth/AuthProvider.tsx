'use client'

import { createContext, useContext, ReactNode } from 'react'
import { User } from 'firebase/auth'
import { useAuth } from '@/hooks/useAuth'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export const useAuthContext = () => useContext(AuthContext)
