'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { signInWithGoogle } from '@/lib/auth'

export function GoogleSignInButton({ size = 'default' }: { size?: 'default' | 'large' }) {
  const [loading, setLoading] = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()

  async function handleSignIn() {
    setLoading(true)
    try {
      await signInWithGoogle()
      const redirect = searchParams.get('redirect')
      router.push(redirect ?? '/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const isLarge = size === 'large'

  return (
    <button
      onClick={handleSignIn}
      disabled={loading}
      className={`
        inline-flex items-center justify-center gap-3 font-medium rounded-sm
        bg-white text-gray-900 hover:bg-gray-100
        transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
        ${isLarge ? 'px-8 py-4 text-base' : 'px-6 py-3 text-sm'}
      `}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
      ) : (
        <GoogleLogo size={isLarge ? 22 : 18} />
      )}
      {loading ? 'Signing in…' : 'Sign in with Google'}
    </button>
  )
}

function GoogleLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
