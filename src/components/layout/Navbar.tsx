'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { signOut } from '@/lib/auth'
import { UserAvatar } from '@/components/ui/UserAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User } from 'lucide-react'
import { toast } from 'sonner'

export function Navbar() {
  const { user } = useAuthContext()
  const router   = useRouter()

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    router.replace('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#2A2A32] bg-background/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-display font-bold text-lg text-gradient" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
          SplitMonk
        </Link>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-[#7C6BF8] focus:ring-offset-2 focus:ring-offset-background"
              render={
                <button>
                  <UserAvatar
                    user={{ displayName: user.displayName ?? '', photoURL: user.photoURL ?? '', uid: user.uid, email: user.email ?? '' }}
                    size={32}
                  />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-52 bg-[#111113] border-[#2A2A32] text-[#F2F2F7]">
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
                <p className="text-xs text-[#8E8E9A] truncate">{user.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-[#2A2A32]" />
              <DropdownMenuItem
                onClick={() => router.push('/profile')}
                className="cursor-pointer hover:bg-[#1A1A1F] focus:bg-[#1A1A1F] flex items-center gap-2"
              >
                <User size={14} /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-[#F87171] hover:bg-[#F87171]/10 focus:bg-[#F87171]/10 flex items-center gap-2"
              >
                <LogOut size={14} /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
