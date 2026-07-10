'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { requestPermission, saveSubscription } from '@/lib/notifications'

interface Props {
  uid:        string
  groupCount: number  // only ask after user has at least one group
}

const ASKED_KEY = 'notification_permission_asked'

export function NotificationPermissionPrompt({ uid, groupCount }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return
    if (groupCount === 0) return

    try {
      const last = localStorage.getItem(ASKED_KEY);
      if (last && Date.now() - parseInt(last) < 7 * 24 * 60 * 60 * 1000) return;
    } catch {
      /* ignore */
    }

    // Show after 3s in dev, 30s in prod
    const delay = process.env.NODE_ENV === "development" ? 3_000 : 10_000;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer)
  }, [groupCount])

  if (!visible) return null

  function handleDismiss() {
    try {
      localStorage.setItem(ASKED_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  async function handleEnable() {
    try {
      localStorage.setItem(ASKED_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false)
    const sub = await requestPermission()
    if (sub) await saveSubscription(uid, sub)
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50">
      <div className="rounded-md border border-[rgba(124,107,248,0.3)] bg-[#111113] p-4 shadow-glow">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-sm bg-accent-dim flex items-center justify-center shrink-0">
            <Bell size={18} className="text-[#7C6BF8]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#F2F2F7] text-sm font-medium">
              Stay in the loop
            </p>
            <p className="text-[#8E8E9A] text-xs mt-0.5">
              Get notified when expenses are added or settlements are recorded
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-faint hover:text-[#8E8E9A] transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2 rounded text-xs text-[#8E8E9A] border border-[#2A2A32] hover:border-faint transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleEnable}
            className="flex-1 py-2 rounded text-xs text-white bg-[#7C6BF8] hover:bg-[#6B5CE7] transition-colors font-medium"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
