'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { Zap, RefreshCw, WifiOff } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export default function LandingPage() {
  const { user, loading } = useAuthContext()
  const router            = useRouter()
  const heroRef           = useRef<HTMLHeadingElement>(null)
  const subRef            = useRef<HTMLParagraphElement>(null)
  const ctaRef            = useRef<HTMLDivElement>(null)
  const mockRef           = useRef<HTMLDivElement>(null)
  const glowRef           = useRef<HTMLDivElement>(null)

  // Redirect if already signed in
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  // Hero entrance animations
  useEffect(() => {
    if (loading) return
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo(heroRef.current, { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.9 })
      .fromTo(subRef.current,  { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.5')
      .fromTo(ctaRef.current,  { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
      .fromTo(mockRef.current, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')

    // Float loop on mock card
    gsap.to(mockRef.current, {
      y: -12, duration: 2.5, ease: 'sine.inOut', yoyo: true, repeat: -1,
    })

    // CTA glow pulse
    gsap.to(glowRef.current, {
      opacity: 0.6, scale: 1.15, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1,
    })
  }, [loading])

  if (loading) return null

  return (
    <main className="min-h-screen bg-[#0A0A0B] overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 text-center">

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#7C6BF8] opacity-[0.06] blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-indigo-500 opacity-[0.05] blur-[100px]" />
        </div>

        {/* Logo mark */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2A2A32] bg-[#111113] text-[#8E8E9A] text-sm">
          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
          Split bills with anyone · No spreadsheets
        </div>

        <h1
          ref={heroRef}
          className="opacity-0 font-display font-extrabold text-5xl sm:text-6xl md:text-7xl leading-tight mb-6"
          style={{ fontFamily: 'var(--font-syne, sans-serif)' }}
        >
          <span className="text-gradient">Split bills.</span>
          <br />
          <span className="text-[#F2F2F7]">Stay friends.</span>
        </h1>

        <p
          ref={subRef}
          className="opacity-0 text-[#8E8E9A] text-lg md:text-xl max-w-md mx-auto mb-10 leading-relaxed"
        >
          Expense splitting for trips and groups. No spreadsheets. No WhatsApp math. No awkward asking.
        </p>

        <div ref={ctaRef} className="opacity-0 mb-20">
          <GoogleSignInButton size="large" />
        </div>

        {/* Floating mock card */}
        <div ref={mockRef} className="opacity-0 w-full max-w-xs mx-auto">
          <MockExpenseCard />
        </div>
      </section>

      {/* ── Pain points ──────────────────────────────────── */}
      <Section>
        <div className="text-center mb-12">
          <p className="text-[#7C6BF8] text-sm font-medium uppercase tracking-widest mb-3">The problem</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
            No more WhatsApp math
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { title: 'Mental overload',    desc: 'Tracking who paid what across 3 days of a trip is a spreadsheet nightmare.' },
            { title: 'Missed amounts',     desc: 'Someone always forgets a ₹200 coffee or misremembers the split.' },
            { title: 'Awkward asking',     desc: "Nobody wants to be the person chasing ₹450 over text. It's uncomfortable." },
          ].map((p) => (
            <div key={p.title} className="rounded-md border border-[#2A2A32] bg-[#111113] p-6">
              <h3 className="text-[#F2F2F7] font-semibold mb-2">{p.title}</h3>
              <p className="text-[#8E8E9A] text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Features ─────────────────────────────────────── */}
      <Section>
        <div className="text-center mb-12">
          <p className="text-[#7C6BF8] text-sm font-medium uppercase tracking-widest mb-3">Features</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
            Everything you actually need
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: <Zap size={22} className="text-[#7C6BF8]" />,      title: 'Real-time balances',    desc: 'See who owes what the moment an expense is added. No refresh needed.' },
            { icon: <RefreshCw size={22} className="text-[#34D399]" />, title: 'Smart settlements',    desc: 'Optimal algorithm minimises the number of payments to zero all debts.' },
            { icon: <WifiOff size={22} className="text-[#FBBF24]" />,   title: 'Works offline',        desc: "Mountain cabin, no signal? Balances are cached. Writes sync when you're back." },
          ].map((f) => (
            <div key={f.title} className="rounded-md border border-[#2A2A32] bg-[#111113] p-6 hover:border-[rgba(124,107,248,0.25)] hover:shadow-[0_0_24px_rgba(124,107,248,0.10)] transition-all duration-150">
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-[#F2F2F7] font-semibold mb-2">{f.title}</h3>
              <p className="text-[#8E8E9A] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── How it works ─────────────────────────────────── */}
      <Section>
        <div className="text-center mb-12">
          <p className="text-[#7C6BF8] text-sm font-medium uppercase tracking-widest mb-3">How it works</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
            Three steps
          </h2>
        </div>
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {[
            { n: '01', title: 'Create a group',   desc: 'Name your trip, add team members.' },
            { n: '02', title: 'Add expenses',     desc: 'Log who paid, split however you like.' },
            { n: '03', title: 'Settle up',        desc: 'See the minimal payments. Mark done.' },
          ].map((s, i) => (
            <div key={s.n} className="flex sm:flex-col items-start gap-4 flex-1">
              {i > 0 && <div className="hidden sm:block w-full h-px bg-[#2A2A32] mb-4 -mt-2" />}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#7C6BF8]/10 border border-[rgba(124,107,248,0.25)] flex items-center justify-center text-[#7C6BF8] font-mono text-sm font-semibold">
                {s.n}
              </div>
              <div>
                <p className="text-[#F2F2F7] font-semibold mb-1">{s.title}</p>
                <p className="text-[#8E8E9A] text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="relative py-32 flex flex-col items-center justify-center text-center px-6">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div ref={glowRef} className="w-96 h-96 rounded-full bg-[#7C6BF8] opacity-[0.07] blur-[100px]" />
        </div>
        <h2 className="relative font-display font-bold text-4xl md:text-5xl text-[#F2F2F7] mb-4" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
          Ready for your next trip?
        </h2>
        <p className="relative text-[#8E8E9A] mb-10">Sign in takes 10 seconds. No setup needed.</p>
        <div className="relative">
          <GoogleSignInButton size="large" />
        </div>
      </section>
    </main>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="max-w-4xl mx-auto px-6 py-20">
      {children}
    </section>
  )
}

function MockExpenseCard() {
  return (
    <div className="rounded-md border border-[#2A2A32] bg-[#111113] p-5 text-left shadow-[0_0_0_1px_#2A2A32,0_8px_32px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[#F2F2F7] font-medium text-sm">Jibhi Stay</p>
          <p className="text-[#8E8E9A] text-xs mt-0.5">
            Paid by Rishab · 6 members
          </p>
        </div>
        <span className="font-mono text-[#F2F2F7] font-medium">₹18,000</span>
      </div>
      <div className="space-y-2">
        {[
          { name: "Purvi", amount: "-₹3,000", color: "text-[#F87171]" },
          { name: "Sahil", amount: "-₹3,000", color: "text-[#F87171]" },
          { name: "Rishab", amount: "+₹15,000", color: "text-[#34D399]" },
        ].map((r) => (
          <div key={r.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#7C6BF8]/20 flex items-center justify-center text-[#7C6BF8] text-xs font-semibold">
                {r.name[0]}
              </div>
              <span className="text-[#8E8E9A] text-xs">{r.name}</span>
            </div>
            <span className={`font-mono text-xs font-medium ${r.color}`}>
              {r.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
