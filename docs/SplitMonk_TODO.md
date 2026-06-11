# SplitMonk — Build Plan

> Phase-by-phase todo from zero to production.
> Each phase ends with a **manual test checkpoint** — you test, sign off, then next phase begins.
> Prerequisites that need manual setup are clearly marked as `[MANUAL]`.

---

## Quick Reference

| Phase | Name | Type | Est. Time |
|:---:|---|---|---|
| [Phase 0](#phase-0--prerequisites--project-setup) | Prerequisites & Project Setup | Manual setup | 1–2 hrs |
| [Phase 1](#phase-1--project-scaffold--foundation) | Project Scaffold & Foundation | Code | 1 day |
| [Phase 2](#phase-2--authentication--user-profiles) | Authentication & User Profiles | Code | 1–2 days |
| [Phase 3](#phase-3--design-system--landing-page) | Design System & Landing Page | Code | 2–3 days |
| [Phase 4](#phase-4--groups--core-data-layer) | Groups & Core Data Layer | Code | 2 days |
| [Phase 5](#phase-5--expenses--split-engine) | Expenses & Split Engine | Code | 3 days |
| [Phase 6](#phase-6--balances--settlement-engine) | Balances & Settlement Engine | Code | 2–3 days |
| [Phase 7](#phase-7--pwa--performance--polish) | PWA, Performance & Polish | Code | 2 days |
| [Phase 8](#phase-8--production-deployment--team-onboarding) | Production Deployment & Team Onboarding | Deploy + Manual | 1 day |

---

## Phase 0 — Prerequisites & Project Setup

> **Type: MANUAL** — You do all of this before any code is written.
> This is infrastructure setup. Takes 1–2 hours, mostly waiting for consoles to load.

### 0.1 GitHub Repo

- [✅] Create private GitHub repo: `github.com/shurutech/splitmonk`
- [✅] Add `.gitignore` for Next.js (GitHub will offer this on creation)
- [✅] Go to repo **Settings → Branches** → set `main` as default, enable branch protection (require PR before merge — optional but good habit)

### 0.2 Firebase Project

- [✅] Go to [console.firebase.google.com](https://console.firebase.google.com)
- [✅] Click **Add Project** → name it `splitmonk`
- [✅] Disable Google Analytics (not needed)
- [✅] Once created, go to **Build → Authentication → Get Started**
- [✅] Under **Sign-in providers**, enable **Google**
  - Set project public-facing name: `SplitMonk`
  - Set support email to your email
  - Save
- [✅] Go to **Build → Firestore Database → Create Database**
  - Choose **production mode** (we'll set real rules in Phase 2)
  - Choose region: `asia-south1` (Mumbai — closest to India)
- [✅] Go to **Project Settings → General**
  - Scroll to **Your apps** → click `</>` (Web)
  - App nickname: `splitmonk-web`
  - **Do NOT enable Firebase Hosting** (we're using Vercel)
  - Register app → copy the `firebaseConfig` object — save it somewhere, you'll need it in Phase 1
- [✅] Go to **Project Settings → Usage and billing** → upgrade to **Blaze (pay-as-you-go)** plan
  - Required for production. Set a billing alert at $5/month — you'll never hit it for team usage.

### 0.3 Google OAuth — Authorized Domains

- [✅] Still in Firebase console → **Authentication → Settings → Authorized domains**
- [✅] Note: `localhost` is already there. After you get your Vercel URL in Phase 1, come back and add it here.

### 0.4 Vercel Account

- [✅] Go to [vercel.com](https://vercel.com) → Sign in with GitHub
- [✅] We won't create the project yet — Vercel project is created during Phase 1 after pushing the repo.

### 0.5 Node.js Environment

- [✅] Ensure Node.js `v18+` is installed locally: `node --version`
- [✅] Ensure `pnpm` is installed: `npm install -g pnpm` (we use pnpm, not npm — faster, better lockfile)

### 0.6 Environment Variables Cheatsheet

When you have the Firebase config from step 0.2, you'll need these values ready:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

---

### ✅ Phase 0 Sign-off Checklist

Before moving to Phase 1, confirm:

- [ ] GitHub repo is created and accessible
- [ ] Firebase project `splitmonk` exists with Auth + Firestore enabled
- [ ] Google sign-in provider is enabled in Firebase Auth
- [ ] Firestore is in production mode, region `asia-south1`
- [ ] Firebase app is registered and `firebaseConfig` is saved
- [ ] Firebase project is on **Blaze plan**
- [ ] Node.js v18+ and pnpm installed locally

---

## Phase 1 — Project Scaffold & Foundation

> **Type: CODE**
> Sets up the Next.js project with all tooling configured. No features yet — just the skeleton.

### 1.1 Create Next.js App

```bash
pnpm create next-app@latest splitmonk \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd splitmonk
```

### 1.2 Install All Dependencies Upfront

```bash
# Firebase
pnpm add firebase

# UI — shadcn/ui setup
pnpm add -D @shadcn/ui
pnpm dlx shadcn@latest init
# When prompted: Dark theme, CSS variables: yes

# Animation
pnpm add gsap @gsap/react framer-motion lenis

# Fonts (local via next/font — faster than Google CDN)
pnpm add @next/font

# Icons
pnpm add lucide-react

# Utilities
pnpm add clsx tailwind-merge class-variance-authority

# Charts (Sprint 4 but install now)
pnpm add recharts

# PWA
pnpm add next-pwa

# Dev tools
pnpm add -D prettier prettier-plugin-tailwindcss
```

### 1.3 Install shadcn Components

```bash
pnpm dlx shadcn@latest add button input label card badge avatar
pnpm dlx shadcn@latest add dialog sheet dropdown-menu tabs toast
pnpm dlx shadcn@latest add separator skeleton progress
```

### 1.4 Project Folder Structure

Create this exact folder structure:

```
src/
├── app/
│   ├── (auth)/
│   │   └── page.tsx              # Landing + login
│   ├── (app)/
│   │   ├── layout.tsx            # App shell with nav
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── groups/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx      # Group detail
│   │   │   │   ├── add/
│   │   │   │   │   └── page.tsx  # Add expense
│   │   │   │   ├── balances/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── expenses/
│   │   │   │       └── [eid]/
│   │   │   │           └── page.tsx
│   │   │   └── archived/
│   │   │       └── page.tsx
│   │   └── profile/
│   │       └── page.tsx
│   ├── globals.css
│   └── layout.tsx                # Root layout
├── components/
│   ├── ui/                       # shadcn components live here (auto-generated)
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── BottomNav.tsx         # Mobile bottom navigation
│   │   └── PageWrapper.tsx
│   ├── auth/
│   │   └── GoogleSignInButton.tsx
│   ├── groups/
│   │   ├── GroupCard.tsx
│   │   └── GroupForm.tsx
│   ├── expenses/
│   │   ├── ExpenseCard.tsx
│   │   ├── ExpenseForm.tsx
│   │   └── SplitInput.tsx
│   ├── balances/
│   │   ├── BalanceCard.tsx
│   │   └── SettlementItem.tsx
│   └── animations/
│       ├── RevealOnScroll.tsx
│       └── LenisProvider.tsx
├── lib/
│   ├── firebase.ts               # Firebase init
│   ├── firestore.ts              # All DB operations
│   ├── auth.ts                   # Auth helpers
│   └── calculations.ts          # Balance + settlement logic
├── hooks/
│   ├── useAuth.ts
│   ├── useGroup.ts
│   └── useExpenses.ts
├── types/
│   └── index.ts                  # All TypeScript interfaces
└── constants/
    └── index.ts                  # App-wide constants
```

### 1.5 Tailwind Config — Design Tokens

Update `tailwind.config.ts` with the full SplitMonk design system:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background:  '#0A0A0B',
        surface:     '#111113',
        elevated:    '#1A1A1F',
        border:      '#2A2A32',
        foreground:  '#F2F2F7',
        muted:       '#8E8E9A',
        faint:       '#4A4A56',
        accent: {
          DEFAULT:   '#7C6BF8',
          dim:       'rgba(124, 107, 248, 0.12)',
          border:    'rgba(124, 107, 248, 0.25)',
        },
        success: {
          DEFAULT:   '#34D399',
          dim:       'rgba(52, 211, 153, 0.12)',
        },
        danger: {
          DEFAULT:   '#F87171',
          dim:       'rgba(248, 113, 113, 0.12)',
        },
        warning: {
          DEFAULT:   '#FBBF24',
          dim:       'rgba(251, 191, 36, 0.12)',
        },
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body:    ['var(--font-inter)', 'sans-serif'],
        mono:    ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        'glow':         '0 0 24px rgba(124, 107, 248, 0.15)',
        'glow-success': '0 0 16px rgba(52, 211, 153, 0.10)',
        'glow-danger':  '0 0 16px rgba(248, 113, 113, 0.10)',
        'card':         '0 0 0 1px #2A2A32',
        'card-hover':   '0 0 0 1px rgba(124, 107, 248, 0.25), 0 0 24px rgba(124, 107, 248, 0.10)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

### 1.6 Global CSS — CSS Variables

Update `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg-base:              #0A0A0B;
    --bg-surface:           #111113;
    --bg-elevated:          #1A1A1F;
    --bg-border:            #2A2A32;
    --text-primary:         #F2F2F7;
    --text-secondary:       #8E8E9A;
    --text-muted:           #4A4A56;
    --accent:               #7C6BF8;
    --accent-dim:           rgba(124, 107, 248, 0.12);
    --success:              #34D399;
    --success-dim:          rgba(52, 211, 153, 0.12);
    --danger:               #F87171;
    --danger-dim:           rgba(248, 113, 113, 0.12);
    --warning:              #FBBF24;

    /* shadcn/ui overrides */
    --background:           0 0% 4%;
    --foreground:           240 20% 97%;
    --card:                 240 5% 6%;
    --border:               240 5% 16%;
    --input:                240 5% 10%;
    --ring:                 250 87% 69%;
    --primary:              250 87% 69%;
    --primary-foreground:   0 0% 100%;
    --radius:               0.75rem;
  }

  * { border-color: var(--bg-border); }
  body {
    background-color: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-inter), sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* Scrollbar — dark themed */
  ::-webkit-scrollbar        { width: 6px; }
  ::-webkit-scrollbar-track  { background: var(--bg-base); }
  ::-webkit-scrollbar-thumb  { background: var(--bg-border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
}
```

### 1.7 TypeScript Types

Populate `src/types/index.ts` with all entity interfaces:

```ts
export interface User {
  uid: string
  email: string
  displayName: string
  photoURL: string
  createdAt: Date
  lastActiveAt: Date
}

export interface Group {
  id: string
  name: string
  description?: string
  createdBy: string
  members: string[]
  startDate?: Date
  endDate?: Date
  status: 'active' | 'settled' | 'archived'
  totalSpend: number
  createdAt: Date
  coverColor: string
}

export interface Split {
  [uid: string]: number  // amount in PAISE
}

export interface Expense {
  id: string
  title: string
  amount: number         // in PAISE (₹1 = 100 paise)
  paidBy: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: Split
  date: Date
  notes?: string
  category: 'food' | 'stay' | 'transport' | 'activity' | 'shopping' | 'other'
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isDeleted: boolean
}

export interface Settlement {
  id: string
  from: string
  to: string
  amount: number         // in PAISE
  settledAt: Date
  settledBy: string
  note?: string
}

export interface Balance {
  uid: string
  net: number            // positive = owed to you, negative = you owe
}

export interface SettlementSuggestion {
  from: string
  to: string
  amount: number
}
```

### 1.8 Firebase Init

```ts
// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db   = getFirestore(app)
export default app
```

### 1.9 Environment Variables

Create `.env.local` in project root — paste your Firebase config values from Phase 0:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Add `.env.local` to `.gitignore` (should already be there from Next.js default).

### 1.10 Deploy to Vercel (Staging)

```bash
git add .
git commit -m "feat: initial scaffold"
git push origin main
```

- [ ] Go to [vercel.com/new](https://vercel.com/new) → Import `splitmonk` repo
- [ ] Framework: **Next.js** (auto-detected)
- [ ] Add all `NEXT_PUBLIC_FIREBASE_*` env vars in Vercel dashboard
- [ ] Deploy → copy the staging URL (e.g. `splitmonk.vercel.app`)
- [ ] Go back to Firebase Console → **Authentication → Settings → Authorized domains** → add your Vercel URL

---

### ✅ Phase 1 Sign-off — Manual Test

**Run locally first:**
```bash
pnpm dev
```

- [ ] App starts on `localhost:3000` with no console errors
- [ ] Page background is `#0A0A0B` (deep dark) — not white
- [ ] No TypeScript errors: `pnpm tsc --noEmit`
- [ ] Vercel staging URL is live and shows the page

---

## Phase 2 — Authentication & User Profiles

> **Type: CODE**
> Google OAuth login, domain restriction, user profile creation, route protection.
> After this phase: any `@shurutech.com` member can sign in and land on the dashboard.

### 2.1 Firebase Auth Hook

```ts
// src/hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser]       = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
```

### 2.2 Auth Helpers — with Domain Restriction

```ts
// src/lib/auth.ts
import {
  signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

const ALLOWED_DOMAIN = 'shurutech.com'

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result   = await signInWithPopup(auth, provider)
  const user     = result.user

  // Domain check — hard gate
  if (!user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await firebaseSignOut(auth)
    throw new Error('Access restricted to @shurutech.com accounts only.')
  }

  // Create or update user profile in Firestore
  const userRef = doc(db, 'users', user.uid)
  const snap    = await getDoc(userRef)

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid:          user.uid,
      email:        user.email,
      displayName:  user.displayName ?? '',
      photoURL:     user.photoURL ?? '',
      createdAt:    serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    })
  } else {
    await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true })
  }

  return user
}

export async function signOut() {
  await firebaseSignOut(auth)
}
```

### 2.3 Auth Context Provider

```tsx
// src/components/auth/AuthProvider.tsx
'use client'

import { createContext, useContext, ReactNode } from 'react'
import { User } from 'firebase/auth'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

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
```

### 2.4 Route Protection Middleware

```ts
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/privacy', '/terms']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic     = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))
  const session      = req.cookies.get('session')  // set after login

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

> **Note:** Firebase Auth is client-side. For true server-side protection we use a session cookie via Firebase Admin SDK — or keep it simple with client-side redirect in `(app)/layout.tsx`. For an internal tool, client-side guard is fine.

### 2.5 App Layout Guard (Client-side)

```tsx
// src/app/(app)/layout.tsx
'use client'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()
  const router            = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading])

  if (loading) return <FullScreenSpinner />
  if (!user)   return null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>{children}</main>
      <BottomNav />  {/* mobile only */}
    </div>
  )
}
```

### 2.6 Landing Page & Google Sign-In Button

- Full-screen dark landing page with "Sign in with Google" button
- On click: calls `signInWithGoogle()`, shows loading state, handles errors
- On success: redirect to `/dashboard`
- Error state: toast with "Access restricted to @shurutech.com" message

### 2.7 Firestore Security Rules

```
// Firebase Console → Firestore → Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users — can only read/write own profile
    match /users/{uid} {
      allow read:  if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Groups — only members can read/write
    match /groups/{groupId} {
      allow read:  if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update: if request.auth.uid in resource.data.members;
      allow delete: if request.auth.uid == resource.data.createdBy;

      // Expenses subcollection
      match /expenses/{expenseId} {
        allow read, write: if request.auth.uid in
          get(/databases/$(database)/documents/groups/$(groupId)).data.members;
      }

      // Settlements subcollection
      match /settlements/{settlementId} {
        allow read: if request.auth.uid in
          get(/databases/$(database)/documents/groups/$(groupId)).data.members;
        allow create: if request.auth.uid == request.resource.data.from
                      || request.auth.uid == request.resource.data.to;
      }
    }
  }
}
```

- [ ] Paste these rules into Firebase Console → Firestore → Rules tab → Publish

---

### ✅ Phase 2 Sign-off — Manual Test

On staging URL:

- [ ] Click "Sign in with Google" → Google account picker opens
- [ ] Sign in with a `@shurutech.com` account → lands on `/dashboard`
- [ ] Sign out → redirected back to landing page
- [ ] Try signing in with a personal Gmail → see error toast "Access restricted to @shurutech.com"
- [ ] Open DevTools → Application → Firestore → verify user document was created with correct fields
- [ ] Paste Firestore rules into Firebase console and verify they publish without errors
- [ ] Directly navigate to `/dashboard` while logged out → redirected to `/`

---

## Phase 3 — Design System & Landing Page

> **Type: CODE**
> The landing page with full GSAP/Lenis animation, and the shared UI components used across all app screens.
> After this phase: SplitMonk looks and feels premium. Design system is locked in.

### 3.1 Font Setup

```tsx
// src/app/layout.tsx
import { Syne, Inter } from 'next/font/google'
import localFont from 'next/font/local'

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
})

// JetBrains Mono — download and serve locally for speed
// Get from: https://www.jetbrains.com/lp/mono/
const jetbrains = localFont({
  src: '../fonts/JetBrainsMono-Regular.woff2',
  variable: '--font-jetbrains',
})
```

> `[MANUAL]` Download JetBrains Mono `.woff2` file from [jetbrains.com/lp/mono](https://www.jetbrains.com/lp/mono/) and place in `src/fonts/`.

### 3.2 Lenis Smooth Scroll Provider

```tsx
// src/components/animations/LenisProvider.tsx
'use client'
import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true })

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove(() => {})
    }
  }, [])

  return <>{children}</>
}
```

### 3.3 RevealOnScroll Animation Component

```tsx
// src/components/animations/RevealOnScroll.tsx
'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

interface Props {
  children: React.ReactNode
  delay?: number
  y?: number
}

export function RevealOnScroll({ children, delay = 0, y = 40 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    gsap.fromTo(ref.current,
      { opacity: 0, y },
      {
        opacity: 1, y: 0, duration: 0.7,
        ease: 'power2.out', delay,
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 85%',
        }
      }
    )
  }, [])

  return <div ref={ref}>{children}</div>
}
```

### 3.4 Landing Page Sections

Build `src/app/(auth)/page.tsx` with these sections in order:

**Section 1 — Hero**
- Full viewport, dark `#0A0A0B`
- Ambient gradient orbs (CSS `radial-gradient`, subtle violet + indigo, blurred 200px)
- GSAP hero headline: "Split bills. Stay friends." — Syne 800, 72px, gradient text
- Subhead in Inter 400, muted color
- "Sign in with Google" CTA — accent violet button with Google logo SVG
- Floating expense card mockup (styled div, GSAP `gsap.to` y-float loop)

**Section 2 — Pain points** (`RevealOnScroll`)
- "No more WhatsApp math" eyebrow
- 3 pain point cards: Mental overload · Missed amounts · Awkward asking

**Section 3 — Features** (`RevealOnScroll` staggered)
- 3-column grid
- Real-time balances · Smart settlements · Works offline

**Section 4 — How it works** (`RevealOnScroll`)
- 3 numbered steps with SVG connector line
- Create group → Add expenses → Settle up

**Section 5 — CTA**
- "Ready for your next trip?" in Syne
- Large Google sign-in button, ambient glow pulsing behind it (GSAP timeline loop)

### 3.5 Shared UI Components

Build these components — they're used across all app screens:

- `AmountDisplay` — renders a paise value as ₹X,XXX with correct color (success/danger/muted)
- `UserAvatar` — Google photo or initials fallback, multiple sizes
- `GroupCard` — dark card with cover color accent, group name, member count, total spend
- `ExpenseCard` — title, amount, payer avatar, split count, date
- `BalancePill` — "You owe ₹X" or "You're owed ₹X" in colored pill
- `PageHeader` — back button + title + optional action button
- `BottomSheet` — Framer Motion animated panel from bottom (mobile-first modal)
- `EmptyState` — icon + headline + subtext + optional CTA button
- `LoadingSkeleton` — dark shimmer skeleton for all loading states

### 3.6 Bottom Navigation (Mobile)

```tsx
// src/components/layout/BottomNav.tsx
// Shows on mobile only (md:hidden)
// Tabs: Home (dashboard), Groups, Profile
// Active tab: accent violet icon + label
// Framer Motion active indicator pill
```

---

### ✅ Phase 3 Sign-off — Manual Test

- [ ] Landing page loads on `localhost:3000`
- [ ] Smooth scroll feels silky (Lenis working)
- [ ] Hero headline animates in on load
- [ ] All sections reveal as you scroll down (GSAP ScrollTrigger working)
- [ ] CTA glow pulses
- [ ] "Sign in with Google" button works (takes you through auth)
- [ ] Mobile view (375px): layout looks correct, text doesn't overflow, button is tappable
- [ ] All fonts loaded correctly: Syne for headings, Inter for body, JetBrains Mono for amounts
- [ ] Test on actual phone (open staging URL) — smooth scroll, animations work

---

## Phase 4 — Groups & Core Data Layer

> **Type: CODE**
> All group management features + Firestore helper layer. Dashboard comes alive.
> After this phase: team can create trips, add members, see their groups.

### 4.1 Firestore Helpers

```ts
// src/lib/firestore.ts — implement all these functions:

// Users
getAllUsers(): Promise<User[]>
getUserById(uid: string): Promise<User | null>

// Groups
createGroup(data: CreateGroupInput): Promise<string>
updateGroup(groupId: string, data: Partial<Group>): Promise<void>
archiveGroup(groupId: string): Promise<void>
getUserGroups(uid: string): Promise<Group[]>
getGroupById(groupId: string): Promise<Group | null>
subscribeToGroup(groupId: string, cb: (group: Group) => void): Unsubscribe
subscribeToUserGroups(uid: string, cb: (groups: Group[]) => void): Unsubscribe
```

### 4.2 useGroup Hook

```ts
// src/hooks/useGroup.ts
// Realtime subscription to a single group via onSnapshot
// Returns: { group, loading, error }
```

### 4.3 Dashboard Page

`/dashboard` layout:

- **Hero row:** "Hey [name] 👋" + net balance across all groups in large AmountDisplay
- **Active groups grid:** GroupCard components, 2-col on mobile, 3-col on desktop
- **+ New Group** FAB (floating action button, bottom-right, accent violet)
- **Empty state:** if no groups, show "Create your first trip" EmptyState component
- **Framer Motion:** stagger cards on load (`staggerChildren: 0.05`)

### 4.4 Create Group Flow

- FAB click → BottomSheet slides up with GroupForm
- GroupForm fields:
  - Group name (text input)
  - Description (textarea, optional)
  - Start date / End date (date pickers)
  - Member selection (shows all users from `/users` collection — checkboxes with avatar + name)
  - Cover color picker (6 preset accent colors)
- Submit → `createGroup()` → close sheet → new GroupCard appears
- Loading state on button during save

### 4.5 Group Detail Page

`/groups/[id]` layout:

- **Group header:** cover color gradient, group name in Syne, date range, member avatars row
- **Tab bar:** "Expenses" · "Balances" · "Members"
- **Expenses tab:** expense list (placeholder — wired in Phase 5)
- **Members tab:** list of all members with their avatar, name, email
- **+ Add Expense FAB** — accent violet, links to `/groups/[id]/add`

### 4.6 Cover Color System

```ts
// src/constants/index.ts
export const GROUP_COLORS = [
  { name: 'Violet', value: '#7C6BF8' },
  { name: 'Teal',   value: '#2DD4BF' },
  { name: 'Rose',   value: '#FB7185' },
  { name: 'Amber',  value: '#FBBF24' },
  { name: 'Blue',   value: '#60A5FA' },
  { name: 'Green',  value: '#34D399' },
]
```

---

### ✅ Phase 4 Sign-off — Manual Test

- [ ] Dashboard loads after login — shows "Hey [Name]"
- [ ] Click + FAB → BottomSheet slides up smoothly
- [ ] Create a group "Test Trip" with 2–3 members and a date range
- [ ] GroupCard appears on dashboard with correct color and member count
- [ ] Click the group → Group detail page loads
- [ ] Expenses tab shows empty state
- [ ] Members tab shows correct members
- [ ] Refresh page — group persists (Firestore working)
- [ ] Check Firestore console — group document exists under `/groups/`
- [ ] Create 2 more groups — all appear on dashboard grid

---

## Phase 5 — Expenses & Split Engine

> **Type: CODE**
> The core of SplitMonk — adding expenses with all split types, validation, and expense history.
> This is the most complex phase. Take your time here.

### 5.1 Paise Helpers

```ts
// src/lib/calculations.ts — add these first

// NEVER store rupees. Always paise.
export const toPaise    = (rupees: number): number => Math.round(rupees * 100)
export const toRupees   = (paise: number):  number => paise / 100
export const formatINR  = (paise: number):  string => {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(rupees)
}
```

### 5.2 Split Calculation Functions

```ts
// src/lib/calculations.ts

/**
 * Equal split — remainder paise go to payer
 */
export function calculateEqualSplit(
  amountPaise: number,
  memberUids: string[],
  payerUid: string
): Split {
  const n        = memberUids.length
  const base     = Math.floor(amountPaise / n)
  const remainder = amountPaise - (base * n)
  const splits: Split = {}

  memberUids.forEach((uid) => {
    splits[uid] = uid === payerUid ? base + remainder : base
  })
  return splits
}

/**
 * Exact split — validate sum === total before calling
 */
export function calculateExactSplit(
  amountPaise: number,
  splitInput: Split  // already in paise
): { splits: Split; error: string | null } {
  const sum = Object.values(splitInput).reduce((a, b) => a + b, 0)
  if (sum !== amountPaise) {
    const diff = amountPaise - sum
    return {
      splits: splitInput,
      error: `Amounts are off by ${formatINR(Math.abs(diff))} — ${diff > 0 ? 'add more' : 'reduce'}`
    }
  }
  return { splits: splitInput, error: null }
}

/**
 * Percentage split — last member absorbs rounding diff
 */
export function calculatePercentageSplit(
  amountPaise: number,
  percentages: { [uid: string]: number }
): { splits: Split; error: string | null } {
  const totalPct = Object.values(percentages).reduce((a, b) => a + b, 0)
  if (Math.abs(totalPct - 100) > 0.01) {
    return { splits: {}, error: `Percentages must add up to 100% (currently ${totalPct}%)` }
  }

  const uids   = Object.keys(percentages)
  const splits: Split = {}
  let assigned = 0

  uids.slice(0, -1).forEach((uid) => {
    splits[uid] = Math.floor((percentages[uid] / 100) * amountPaise)
    assigned += splits[uid]
  })

  // Last member gets remainder
  const lastUid      = uids[uids.length - 1]
  splits[lastUid]    = amountPaise - assigned
  return { splits, error: null }
}
```

### 5.3 Firestore — Expense Operations

```ts
// src/lib/firestore.ts — add:

addExpense(groupId: string, data: AddExpenseInput): Promise<string>
// Also: atomically update group.totalSpend with Firestore transaction

updateExpense(groupId: string, expenseId: string, data: Partial<Expense>): Promise<void>
softDeleteExpense(groupId: string, expenseId: string): Promise<void>
// Sets isDeleted: true — never hard delete

subscribeToExpenses(
  groupId: string,
  cb: (expenses: Expense[]) => void
): Unsubscribe
// Filter: where('isDeleted', '==', false), orderBy('date', 'desc')
```

### 5.4 useExpenses Hook

```ts
// src/hooks/useExpenses.ts
// Realtime subscription to group expenses
// Returns: { expenses, loading, error }
// Filters out isDeleted === true
```

### 5.5 Add Expense Page

`/groups/[id]/add` — full-screen form on mobile, sheet on desktop:

**Form layout:**
1. Amount input — large, centered, INR prefix, JetBrains Mono font
2. Title input
3. "Paid by" selector — member avatars in a horizontal scroll row
4. Split type tabs: Equal · Exact · Percentage
5. Split among — member checkboxes (defaults: all selected)
6. **Dynamic split preview:** shows each member's share in real time as you type
7. Date picker (defaults to today)
8. Notes (optional, collapsible)
9. Submit button — "Add Expense" with loading state

**Split preview component:**
- Updates live as amount or members change
- Shows: avatar + name + amount in JetBrains Mono
- Exact split: editable per-person field + running total vs expected
- Percentage: editable % field + computed amount preview

### 5.6 Expense List (Group Detail — Expenses Tab)

- Chronological list, newest first
- Each `ExpenseCard`:
  - Title + category icon
  - Amount in JetBrains Mono
  - "Paid by [Avatar] [Name]"
  - Date (relative: "Today", "Yesterday", "3 days ago")
  - Click → Expense Detail page
- Date group headers: "Today", "Yesterday", "June 10"
- Framer Motion stagger on list items

### 5.7 Expense Detail Page

`/groups/[id]/expenses/[eid]`:

- Full breakdown: who paid, amount, split type
- Per-member split table: avatar + name + share amount
- Edit button (only visible to expense creator or group creator)
- Delete button (soft delete with confirmation dialog)
- Notes section if present

---

### ✅ Phase 5 Sign-off — Manual Test

Use the "Test Trip" group created in Phase 4.

- [ ] Add an expense "Hotel Stay" ₹18,000 — equal split, 4 members
  - Verify each member shows ₹4,500
  - Verify payer's share is correctly calculated (no floating point issues)
- [ ] Add "Van Ride" ₹4,500 — exact split, specify different amounts per person
  - Try submitting with wrong total → see validation error
  - Fix and submit → expense saved
- [ ] Add "Dinner" ₹1,200 — percentage split (25%, 25%, 50%)
  - Verify amounts are correct in paise
- [ ] Add "Coffee" ₹300 ÷ 3 = ₹100 each — verify no rounding issues
- [ ] Check Firestore console — all expense documents have `amount` in paise, correct splits
- [ ] Click an expense → detail page shows correct breakdown
- [ ] Delete an expense → it disappears from list, Firestore shows `isDeleted: true`
- [ ] Try ₹100 ÷ 3 = ₹33.33 case — verify remainder goes to payer correctly

---

## Phase 6 — Balances & Settlement Engine

> **Type: CODE**
> The magic phase. Real-time balances, optimal settlement algorithm, settle up flow.
> **This is P0. Every edge case must pass before this phase is signed off.**

### 6.1 Balance Calculation Engine

```ts
// src/lib/calculations.ts

/**
 * Calculate net balance for each member from all expenses.
 * Returns positive = owed to you, negative = you owe.
 * INVARIANT: sum of all balances === 0 (always verify this)
 */
export function calculateBalances(
  expenses: Expense[],
  memberUids: string[]
): Balance[] {
  const credits: Record<string, number> = {}
  const debits:  Record<string, number> = {}

  memberUids.forEach((uid) => {
    credits[uid] = 0
    debits[uid]  = 0
  })

  expenses
    .filter(e => !e.isDeleted)
    .forEach((expense) => {
      credits[expense.paidBy] = (credits[expense.paidBy] ?? 0) + expense.amount
      Object.entries(expense.splits).forEach(([uid, share]) => {
        debits[uid] = (debits[uid] ?? 0) + share
      })
    })

  const balances = memberUids.map((uid) => ({
    uid,
    net: (credits[uid] ?? 0) - (debits[uid] ?? 0)
  }))

  // INVARIANT CHECK — throw in dev, log in prod
  const sum = balances.reduce((a, b) => a + b.net, 0)
  if (Math.abs(sum) > 1) {  // allow 1 paise rounding tolerance
    console.error(`Balance invariant violated: sum = ${sum} paise`)
  }

  return balances
}

/**
 * Greedy min-transaction settlement algorithm.
 * Returns the minimum list of who-pays-whom to zero all debts.
 */
export function getOptimalSettlements(balances: Balance[]): SettlementSuggestion[] {
  const settlements: SettlementSuggestion[] = []

  // Deep copy — we mutate these
  const creditors = balances
    .filter(b => b.net > 0)
    .map(b => ({ ...b }))
    .sort((a, b) => b.net - a.net)

  const debtors = balances
    .filter(b => b.net < 0)
    .map(b => ({ ...b }))
    .sort((a, b) => a.net - b.net)

  let i = 0, j = 0
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor   = debtors[j]
    const amount   = Math.min(creditor.net, Math.abs(debtor.net))

    if (amount > 0) {
      settlements.push({ from: debtor.uid, to: creditor.uid, amount })
    }

    creditor.net -= amount
    debtor.net   += amount

    if (creditor.net === 0) i++
    if (debtor.net  === 0) j++
  }

  return settlements
}
```

### 6.2 Unit Tests — Mandatory

```ts
// src/lib/__tests__/calculations.test.ts

// Test suite must cover:
// 1. Equal split — 3 people, ₹100 (remainder goes to payer)
// 2. Equal split — 4 people, ₹18,000 (exact, no remainder)
// 3. Exact split — correct sum → no error
// 4. Exact split — wrong sum → returns correct error message
// 5. Percentage split — 25/25/50, ₹1,200 → correct paise amounts
// 6. Percentage split — doesn't sum to 100 → error
// 7. Balance invariant: sum of all net balances === 0
// 8. Settlement: A owes B ₹500, B owes C ₹500 → A pays C ₹500 (1 transaction)
// 9. Settlement: circular debt A→B ₹100, B→C ₹100, C→A ₹100 → no transactions
// 10. Settlement: multiple creditors and debtors → minimum transactions
// 11. Payer is in split: paidBy = A, splits include A → correct net
// 12. Mutual debt: A owes B ₹200, B owes A ₹300 → B owes A ₹100 net

// Run with: pnpm test
```

```bash
pnpm add -D vitest @vitest/ui
# Add to package.json: "test": "vitest"
```

### 6.3 Balances Tab (Group Detail)

`/groups/[id]/balances`:

**Layout:**
- Top: "Total group spend: ₹X,XXX" in Syne
- My balance hero card:
  - If positive: "You are owed ₹X" in success green with glow
  - If negative: "You owe ₹X" in danger red with glow
  - If zero: "You're all settled up 🎉"
- "Suggested Settlements" section:
  - Each settlement: Avatar → Arrow → Avatar → Amount
  - "Settle Up" button on each row
- "All Balances" section: every member's net balance

### 6.4 Settle Up Flow

1. User clicks "Settle Up" on a suggestion
2. BottomSheet opens with confirmation:
   - "[Person A] paid [Person B] ₹X?"
   - Optional note: "via GPay", "cash", etc.
   - "Confirm Settlement" button
3. On confirm:
   - Write settlement record to Firestore
   - Recalculate balances (subscriptions update automatically)
   - If all balances === 0 → update group status to 'settled'
   - Toast: "Settlement recorded ✓"
4. Settlement history visible in group detail

### 6.5 Settlement Firestore Operations

```ts
// src/lib/firestore.ts — add:

recordSettlement(groupId: string, data: CreateSettlementInput): Promise<void>
// Also check if all balances are zero → update group.status = 'settled'

getSettlements(groupId: string): Promise<Settlement[]>
```

---

### ✅ Phase 6 Sign-off — Manual Test

**This is the most important test checkpoint. Do not skip any of these.**

Using the expenses created in Phase 5:

- [ ] Balances tab loads and shows correct net balance for each member
- [ ] "You owe" / "You are owed" hero card shows correct amount
- [ ] Settlements list shows minimum transactions (not one per expense)
- [ ] Run the edge case: add ₹100 shared between 3 people → verify no float errors
- [ ] Add an expense where payer is also in the split → verify net is correct
- [ ] Click "Settle Up" on one suggestion → confirmation sheet opens
- [ ] Confirm → settlement recorded, balance updates instantly (realtime)
- [ ] Settle all outstanding balances → group transitions to "Settled"
- [ ] Settled group shows on dashboard with a "Settled" badge
- [ ] Run unit tests: `pnpm test` → **all 12 tests must pass**
- [ ] Verify in Firestore: settlement documents exist in `/groups/{id}/settlements/`

---

## Phase 7 — PWA, Performance & Polish

> **Type: CODE**
> Makes SplitMonk installable on phones, adds categories + analytics (P2), performance tune-up, and mobile polish.
> After this phase: it's indistinguishable from a native app.

### 7.1 PWA Setup

**Prerequisites:** `[MANUAL]` — Create app icons before this step:
- Generate icons using [favicon.io](https://favicon.io) or [realfavicongenerator.net](https://realfavicongenerator.net)
- Required sizes: `192x192` and `512x512` PNG
- Save to `public/icons/icon-192.png` and `public/icons/icon-512.png`
- Also create `public/icons/apple-touch-icon.png` (180x180) for iOS

```ts
// next.config.ts
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com/,
      handler: 'NetworkFirst',
      options: { cacheName: 'firestore-cache' },
    },
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
    },
  ],
})

module.exports = withPWA({ /* your next config */ })
```

**Web App Manifest** — `public/manifest.json`:

```json
{
  "name": "SplitMonk",
  "short_name": "SplitMonk",
  "description": "Split bills. Stay friends.",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0A0A0B",
  "theme_color": "#0A0A0B",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

**iOS meta tags** in `layout.tsx`:
```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="SplitMonk" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

### 7.2 Expense Categories

- Add category selector to AddExpense form (P2 feature, Sprint 4)
- Category icons using Lucide React:
  - 🍽️ `Utensils` — Food
  - 🏠 `Hotel` — Stay
  - 🚗 `Car` — Transport
  - 🎯 `Target` — Activity
  - 🛍️ `ShoppingBag` — Shopping
  - `MoreHorizontal` — Other
- Filter expenses by category in expense list
- Color-coded category badges on ExpenseCard

### 7.3 Trip Summary CSV Export

```ts
// src/lib/export.ts
export function exportGroupToCSV(group: Group, expenses: Expense[], users: User[]) {
  const rows = expenses.map(e => ({
    Date:        new Date(e.date).toLocaleDateString('en-IN'),
    Title:       e.title,
    Amount:      toRupees(e.amount),
    'Paid By':   users.find(u => u.uid === e.paidBy)?.displayName ?? '',
    Category:    e.category,
    Notes:       e.notes ?? '',
  }))
  // Convert to CSV string and trigger download
}
```

### 7.4 Spending Analytics

- Simple pie/donut chart using Recharts (dark themed)
- Shows spend breakdown by category
- Lives on a new "Stats" tab in group detail
- Only shown when group has 3+ expenses

### 7.5 Performance Audit

- [ ] Run `pnpm build` → check bundle size, fix any large chunks
- [ ] Add `loading.tsx` files for all routes (skeleton screens)
- [ ] Lazy load Recharts (only used in Stats tab)
- [ ] Lazy load GSAP (only used on landing page)
- [ ] Image optimization: all avatars via `next/image`
- [ ] Run Lighthouse on staging URL → target score 90+ on Performance, 100 on Accessibility

### 7.6 Mobile Polish Checklist

- [ ] All tap targets minimum 44×44px
- [ ] No horizontal scroll on any screen at 375px width
- [ ] Forms don't get hidden by keyboard on iOS (use `dvh` units)
- [ ] BottomSheet handles safe area insets on iPhone with notch
- [ ] Back button works correctly on all screens
- [ ] Haptic feedback on settle-up confirm (if `navigator.vibrate` available)
- [ ] All loading states have skeletons (no blank flashes)
- [ ] Toast notifications visible above keyboard

---

### ✅ Phase 7 Sign-off — Manual Test

On a real phone (both Android and iPhone if possible):

- [ ] Open staging URL in Chrome/Safari
- [ ] Browser shows "Add to Home Screen" / install prompt
- [ ] Install PWA — icon appears on home screen
- [ ] Launch from home screen — opens full screen, no browser chrome
- [ ] Background is `#0A0A0B` (not white flash on startup)
- [ ] Add a new expense — form doesn't get covered by keyboard
- [ ] Check offline: turn off WiFi → open app → balances still visible
- [ ] Go online again → any queued writes sync
- [ ] Run Lighthouse: `pnpm build && vercel --prod` → open in Chrome DevTools
- [ ] Expense categories visible and filterable
- [ ] CSV export downloads correctly
- [ ] All tests pass: `pnpm test`

---

## Phase 8 — Production Deployment & Team Onboarding

> **Type: DEPLOY + MANUAL**
> Final production deploy, domain setup (optional), and team onboarding session.

### 8.1 Pre-Deploy Checklist

- [ ] All Phase 7 tests pass
- [ ] `pnpm build` completes with zero errors and zero TypeScript errors
- [ ] `.env.local` is NOT committed to git (verify with `git log --oneline`)
- [ ] All `NEXT_PUBLIC_FIREBASE_*` env vars are set in Vercel dashboard for production environment
- [ ] Firestore security rules are published (from Phase 2)
- [ ] Firebase Auth authorized domains include production URL

### 8.2 Custom Domain (Optional)

`[MANUAL]` — If you want `splitmonk.shurutech.com`:

- [ ] Go to Vercel dashboard → Project → Settings → Domains
- [ ] Add `splitmonk.shurutech.com`
- [ ] In your DNS provider (wherever `shurutech.com` is managed), add a CNAME record:
  ```
  splitmonk  CNAME  cname.vercel-dns.com
  ```
- [ ] Wait for DNS propagation (5–30 minutes)
- [ ] Go back to Firebase Console → Authentication → Authorized domains → add `splitmonk.shurutech.com`

### 8.3 Production Deploy

```bash
# Final build check
pnpm build
pnpm tsc --noEmit

# Push to main → Vercel auto-deploys
git add .
git commit -m "feat: production ready v1.0"
git push origin main
```

- [ ] Watch Vercel deployment log — confirm green ✓
- [ ] Open production URL — sign in works
- [ ] Create a real group with the whole team
- [ ] Add a real test expense
- [ ] Verify balances calculate correctly
- [ ] Verify Firestore rules block unauthorized access (open an incognito window and try to access a group URL directly)

### 8.4 Firebase Production Config

`[MANUAL]` — Do these in Firebase console for production hygiene:

- [ ] **Firestore indexes**: If you see "index required" errors in console, Firebase will auto-suggest them — click the link in the error to create.
- [ ] **Billing alert**: Go to Google Cloud Console → Billing → Budgets & Alerts → create alert at $5/month
- [ ] **App Check** (optional but recommended): Firebase → App Check → Register your web app with reCAPTCHA v3. Prevents API abuse.

### 8.5 Team Onboarding Session

Run a 15-minute onboarding with the full Shuru team:

1. Show the production URL / send the link
2. Everyone signs in with their `@shurutech.com` account (takes 30 seconds)
3. Create a "SplitMonk Test Run" group with everyone in it
4. Each person adds one dummy expense
5. Show the balances screen — explain "You owe" vs "You are owed"
6. Demo the Settle Up flow
7. Show how to install the PWA on their phone
8. Pin the URL in Slack `#general` or `#team`

### 8.6 Post-Launch Monitoring

For the first 2 weeks:

- [ ] Check Firebase console daily → Auth users, Firestore reads/writes, no billing surprises
- [ ] Watch for any error logs in Vercel → Functions tab
- [ ] Ask team for feedback after the first real trip using SplitMonk
- [ ] Note any V2 requests in a `V2_BACKLOG.md`

---

### ✅ Phase 8 Sign-off — Final Checklist

- [ ] Production URL is live and accessible
- [ ] All team members can sign in
- [ ] Firebase is on Blaze plan with billing alert set
- [ ] Firestore security rules are published and tested
- [ ] PWA is installable on iOS and Android
- [ ] `pnpm test` — all tests pass
- [ ] First real group created by the team
- [ ] URL pinned in Slack

---

## Summary

| Phase | You Need To | Dev Needs To | Gate |
|---|---|---|---|
| **Phase 0** | Create Firebase project, GitHub repo, upgrade to Blaze | — | Manual sign-off |
| **Phase 1** | Add `.env.local` values, add Vercel URL to Firebase Auth | Scaffold project | Staging URL live |
| **Phase 2** | Add JetBrains Mono font file | Auth + Firestore rules | Login works |
| **Phase 3** | — | Landing page + design system | Looks stunning |
| **Phase 4** | — | Groups CRUD + dashboard | Create trips |
| **Phase 5** | — | Expenses + split engine | Add expenses |
| **Phase 6** | — | Balances + settlements + tests | All 12 tests pass |
| **Phase 7** | Create PWA icons (192, 512, 180px) | PWA + polish + perf | Installable on phone |
| **Phase 8** | Set DNS CNAME (if custom domain) | Final deploy | Prod is live |

---

*SplitMonk — Built by Shuru, for Shuru.*
