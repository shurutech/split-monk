'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useUserGroups } from '@/hooks/useGroup'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt'
import { UPIPrompt } from '@/components/ui/UPIPrompt'
import { NotificationPermissionPrompt } from '@/components/ui/NotificationPermissionPrompt'
import { ensureToken } from '@/lib/notifications'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()
  const router            = useRouter()
  const { groups }        = useUserGroups(user?.uid)

  useEffect(() => {
    if (!loading && !user) {
      const intended = window.location.pathname + window.location.search
      const redirect = intended !== '/' ? `/?redirect=${encodeURIComponent(intended)}` : '/'
      router.replace(redirect)
    }
  }, [user, loading, router])

  // Register service worker + handle deep-link navigation messages from SW (notification click)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(() => {
      // If permission already granted (e.g. returning user), ensure token is saved
      if (user) ensureToken(user.uid).catch(() => {})
    }).catch((err) => {
      console.warn('[SW] registration failed:', err)
    })

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'NAVIGATE' && e.data?.url) router.push(e.data.url)
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [router, user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <UPIPrompt />
      <NotificationPermissionPrompt uid={user.uid} groupCount={groups.length} />
    </div>
  )
}
