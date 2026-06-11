'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()
  const router            = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      const intended = window.location.pathname + window.location.search
      const redirect = intended !== '/' ? `/?redirect=${encodeURIComponent(intended)}` : '/'
      router.replace(redirect)
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2A2A32] border-t-[#7C6BF8] rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pb-24 md:pb-8 pt-6">
        {children}
      </main>
      <BottomNav />
      <PWAInstallPrompt />
    </div>
  )
}
