'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [prompt,    setPrompt]    = useState<BeforeInstallPromptEvent | null>(null)
  const [visible,   setVisible]   = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Don't show if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // Rate-limit: max 3 shows per calendar day
    const STORAGE_KEY = 'pwa_prompt_shows'
    const today = new Date().toDateString()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const data: { date: string; count: number } = raw ? JSON.parse(raw) : { date: today, count: 0 }
      if (data.date !== today) {
        // New day — reset
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 0 }))
      } else if (data.count >= 3) {
        // Already shown 3 times today — skip entirely
        return
      }
    } catch { /* ignore storage errors */ }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)

      // Increment show count before making visible
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const data: { date: string; count: number } = raw ? JSON.parse(raw) : { date: today, count: 0 }
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: data.count + 1 }))
      } catch { /* ignore */ }

      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setVisible(false) })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || installed) return null

  async function handleInstall() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50">
      <div className="rounded-md border border-[rgba(124,107,248,0.3)] bg-[#111113] p-4 shadow-[0_0_24px_rgba(124,107,248,0.15)]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-sm bg-[rgba(124,107,248,0.12)] flex items-center justify-center flex-shrink-0">
            <Download size={18} className="text-[#7C6BF8]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#F2F2F7] text-sm font-medium">Install SplitMonk</p>
            <p className="text-[#8E8E9A] text-xs mt-0.5">Add to home screen for the best experience</p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-[#4A4A56] hover:text-[#8E8E9A] transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setVisible(false)}
            className="flex-1 py-2 rounded text-xs text-[#8E8E9A] border border-[#2A2A32] hover:border-[#4A4A56] transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 py-2 rounded text-xs text-white bg-[#7C6BF8] hover:bg-[#6B5CE7] transition-colors font-medium"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
