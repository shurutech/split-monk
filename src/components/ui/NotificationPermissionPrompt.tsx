'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, ReceiptText, Wallet, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { requestPermission, saveSubscription } from '@/lib/notifications'

interface Props {
  uid:        string
  groupCount: number  // only ask after user has at least one group
}

const ASKED_KEY   = 'notification_permission_asked'
const WEEK_MS     = 7 * 24 * 60 * 60 * 1000
const DESKTOP_MQ  = '(min-width: 640px)'

const BENEFITS = [
  { icon: ReceiptText,  text: 'A new expense is added to your trip' },
  { icon: CheckCircle2, text: 'Someone pays you, or a payment is undone' },
  { icon: Wallet,       text: 'Your trip pool contribution is recorded' },
]

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_MQ)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(DESKTOP_MQ).matches,
    () => false,
  )
}

function markAsked() {
  try { localStorage.setItem(ASKED_KEY, String(Date.now())) } catch { /* ignore */ }
}

export function NotificationPermissionPrompt({ uid, groupCount }: Props) {
  const [visible, setVisible] = useState(false)
  const isDesktop             = useIsDesktop()
  const reduceMotion          = useReducedMotion()

  // Show rules: never if granted/denied/unsupported; at most once a week otherwise
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return
    if (groupCount === 0) return

    try {
      const last = localStorage.getItem(ASKED_KEY)
      if (last && Date.now() - parseInt(last) < WEEK_MS) return
    } catch { /* ignore */ }

    // Short delay in dev, longer in prod so the page settles first.
    // If another app modal (e.g. the UPI prompt) is open, wait for it to close instead of stacking.
    const delay = process.env.NODE_ENV === 'development' ? 3_000 : 10_000
    let timer: ReturnType<typeof setTimeout>
    const tryShow = () => {
      if (document.querySelector('[data-app-modal]')) {
        timer = setTimeout(tryShow, 2_000)
        return
      }
      setVisible(true)
    }
    timer = setTimeout(tryShow, delay)
    return () => clearTimeout(timer)
  }, [groupCount])

  // Escape closes; background scroll locked while open
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismiss() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [visible])

  function handleDismiss() {
    markAsked()
    setVisible(false)
  }

  async function handleEnable() {
    markAsked()
    setVisible(false)
    const sub = await requestPermission()
    if (sub) {
      await saveSubscription(uid, sub).catch(() => {})
      toast.success('Notifications are on')
    }
  }

  // Mobile: bottom sheet sliding up. Desktop: centred card with a short rise.
  const hidden  = isDesktop ? { opacity: 0, y: 32, scale: 0.97 } : { y: '100%' }
  const shown   = isDesktop ? { opacity: 1, y: 0,  scale: 1 }    : { y: 0 }
  const instant = reduceMotion ? { duration: 0 } : undefined

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-app-modal
          className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={instant ?? { duration: 0.2 }}
          onClick={handleDismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-modal-title"
            className="relative w-full sm:max-w-md bg-[#111113] border border-[#2A2A32] border-b-0 sm:border-b rounded-t-3xl sm:rounded-2xl shadow-glow overflow-hidden pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            style={{ maxHeight: '92dvh' }}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={instant ?? { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
            // Swipe down to dismiss on touch layouts
            drag={isDesktop ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) handleDismiss()
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[#2A2A32]" />
            </div>

            <button
              onClick={handleDismiss}
              aria-label="Close"
              className="absolute right-4 top-4 p-1.5 rounded-full text-faint hover:text-[#F2F2F7] hover:bg-[#1A1A1F] transition-colors"
            >
              <X size={18} />
            </button>

            <div className="px-6 pt-8 sm:pt-10 pb-2 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent-dim border border-[rgba(124,107,248,0.3)] flex items-center justify-center shadow-glow">
                <Bell size={28} className="text-[#7C6BF8]" />
              </div>
              <h2
                id="notif-modal-title"
                className="mt-5 text-[#F2F2F7] text-xl font-bold"
                style={{ fontFamily: 'var(--font-syne, sans-serif)' }}
              >
                Never miss a payment
              </h2>
              <p className="mt-1.5 text-[#8E8E9A] text-sm">
                Turn on notifications and we&apos;ll ping you when:
              </p>
            </div>

            <ul className="px-6 py-4 space-y-2.5">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#1A1A1F] border border-[#2A2A32]"
                >
                  <Icon size={16} className="text-[#7C6BF8] shrink-0" />
                  <span className="text-[#F2F2F7] text-sm">{text}</span>
                </li>
              ))}
            </ul>

            <div className="px-6 pt-1 space-y-2">
              <button
                onClick={handleEnable}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#7C6BF8] hover:bg-[#6B5CE7] active:scale-[0.99] transition-all"
              >
                Turn on notifications
              </button>
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 rounded-xl text-sm text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors"
              >
                Maybe later
              </button>
              <p className="text-center text-faint text-[11px]">
                You can change this anytime in your browser settings.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
