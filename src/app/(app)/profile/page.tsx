'use client'

import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { signOut } from '@/lib/auth'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuthContext()
  const router   = useRouter()

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    router.replace('/')
  }

  if (!user) return null

  return (
    <div className="max-w-sm mx-auto space-y-6 pt-4">
      <h1 className="font-display font-bold text-2xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>Profile</h1>

      <div className="rounded-md border border-[#2A2A32] bg-[#111113] p-6 flex items-center gap-4">
        <UserAvatar user={{ displayName: user.displayName ?? '', photoURL: user.photoURL ?? '', uid: user.uid, email: user.email ?? '' }} size={48} />
        <div className="min-w-0">
          <p className="text-[#F2F2F7] font-semibold truncate">{user.displayName}</p>
          <p className="text-[#8E8E9A] text-sm truncate">{user.email}</p>
        </div>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm border border-[#F87171]/30 bg-[rgba(248,113,113,0.08)] text-[#F87171] text-sm font-medium hover:bg-[rgba(248,113,113,0.15)] transition-colors duration-150"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )
}
