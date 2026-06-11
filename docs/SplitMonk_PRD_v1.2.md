# SplitMonk — Product Requirements Document

> **Version:** 1.2 | **Date:** June 2026 | **Author:** Sahil / Shuru Tech | **Status:** Draft

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas & Use Cases](#2-user-personas--use-cases)
3. [Feature Specifications](#3-feature-specifications)
4. [Data Architecture](#4-data-architecture)
5. [UI / UX Specifications](#5-ui--ux-specifications)
6. [Technical Architecture](#6-technical-architecture)
7. [Development Action Plan](#7-development-action-plan)
8. [Risks, Assumptions & Open Questions](#8-risks-assumptions--open-questions)
9. [Success Metrics](#9-success-metrics)

---

## 1. Product Overview

### 1.1 Problem Statement

The Shuru team frequently travels together for workations and team vacations. Currently there is no dedicated, private tool to track shared expenses — resulting in confusion around who paid what, manual calculations over WhatsApp, and awkward settlement conversations. Public tools like Splitwise are fine but have premium paywalls, unneeded social features, and no domain-level access control.

### 1.2 Solution

**SplitMonk** is a private, internal expense-splitting web application built exclusively for the Shuru team. It uses Google OAuth restricted to `@shurutech.com` accounts — meaning every team member is automatically authenticated with their existing Google Workspace identity. Zero signup, zero friction, zero strangers.

### 1.3 Goals

- Give the Shuru team a fast, private way to track shared expenses on trips
- Eliminate manual WhatsApp calculations entirely
- Make settlements transparent so nobody feels awkward asking
- Ship an MVP within 8 weeks covering 100% of the team's core use cases
- Keep infra costs near zero using Firebase free tier

### 1.4 Non-Goals (V1)

- No native mobile app — Next.js PWA covers mobile in V1
- No public signups — internal `@shurutech.com` team only
- No actual payment gateway integration — settlements are marked manually
- No multi-currency support in V1
- No recurring expense tracking
- No guest/shared links — V2
- No Slack notifications — V2
- No expense locking — V2
- No receipt photo uploads — V2
- No admin panel UI — Firebase console is sufficient for V1

### 1.5 Product Metadata

| Field | Value |
|---|---|
| **Product Name** | SplitMonk |
| **Target Users** | Shuru Tech team members (`@shurutech.com`) |
| **Platform** | Web (responsive, mobile-friendly) |
| **Auth Method** | Google OAuth — restricted to `@shurutech.com` domain |
| **Tech Stack** | Next.js 14, Firebase Auth, Firestore, Vercel, PWA |
| **Target Launch** | 8 weeks from kickoff |
| **Repo** | `github.com/shurutech/splitmonk` (private) |

---

## 2. User Personas & Use Cases

### 2.1 Primary User: Shuru Team Member

Every user of SplitMonk is a Shuru team member authenticated via Google. There are no external users. However within the team, there are soft behavioral roles:

| Role | Behavior | Needs |
|---|---|---|
| **Trip Organizer** | Creates the trip group, adds members, sets up the group | Easy group creation, invite by name, quick overview |
| **Expense Payer** | Pays for things and logs expenses in real time | Fast expense entry, receipt notes, split control |
| **Passive Member** | Checks balances, settles up, occasionally adds an expense | Clear "what do I owe" view, easy settlement confirmation |

### 2.2 Core Use Cases

#### UC-01: Jibhi Workation Trip
Team of 6 travels to Jibhi for 3 days. Sahil books the stay (₹18,000), Arun pays for the van (₹4,500), various people buy meals and groceries. At the end, everyone wants a clean breakdown and a minimal-transaction settlement plan.

#### UC-02: Daily Office Lunches
A subset of the team orders lunch together. Someone pays UPI and wants to quickly split between those who participated — not the entire team.

#### UC-03: Mid-Trip Balance Check
On day 2 of a trip, a team member wonders how much they currently owe. They open SplitMonk and see a live running balance without waiting for the trip to end.

---

## 3. Feature Specifications

### 3.1 Feature Priority Matrix

| Feature | Description | Priority | Sprint |
|---|---|:---:|:---:|
| Google OAuth Login | Sign in with Google, restricted to `@shurutech.com` | **P0** | S1 |
| User Profiles | Auto-populated from Google account (name, photo) | **P0** | S1 |
| Create Group | Named groups with member selection from team list | **P0** | S1 |
| Add Expense | Amount, description, payer, split type, members | **P0** | S2 |
| Equal Split | Divide amount equally among selected members | **P0** | S2 |
| Exact Split | Specify exact amount per person | **P0** | S2 |
| Percentage Split | Assign percentages that must total 100% | P1 | S2 |
| Balance Dashboard | See who owes whom, net balance per person | **P0** | S2 |
| Settle Up | Mark a payment as settled between two people | **P0** | S3 |
| Expense History | Full list of all expenses in a group with filters | **P0** | S3 |
| Edit / Delete Expense | Correct or remove an expense with audit trail | P1 | S3 |
| Optimal Settlement | Minimize transactions to settle all debts | P1 | S3 |
| Trip Summary Export | Export group expenses as CSV or PDF summary | P2 | S4 |
| Push Notifications | In-app alerts when someone adds an expense | P2 | S4 |
| Expense Categories | Tag expenses (Food, Transport, Stay, etc.) | P2 | S4 |
| Spending Analytics | Charts showing spend by category, by person | P2 | S4 |

> **Priority Key:** P0 = Must-have for launch · P1 = Should-have in V1 · P2 = Nice-to-have / V2

---

### 3.2 Authentication Flow

#### Sign In
1. User lands on SplitMonk homepage (unauthenticated state)
2. User clicks **"Sign in with Google"**
3. Google OAuth popup opens — user selects their `@shurutech.com` account
4. Firebase Auth validates the token and returns user object
5. App checks email domain: if not `@shurutech.com` → sign out + error toast
6. If valid: Firestore checks if user doc exists in `/users/{uid}`
7. If new user: create user document with `name`, `email`, `photoURL`, `createdAt`
8. Redirect to `/dashboard`

#### Sign Out
1. User clicks profile avatar → dropdown → **"Sign Out"**
2. Firebase `signOut()` called, local session cleared
3. Redirect to landing page

#### Auth Guard
All routes except `/` are protected via a Firebase auth listener. Unauthenticated users attempting to access any `/dashboard`, `/groups`, `/expenses` route are redirected to the landing page automatically.

---

### 3.3 Group Management

#### Create Group — Fields
- **Group name** — required, max 50 chars
- **Description** — optional, max 200 chars
- **Trip dates** — start and end date (optional but recommended)
- **Members** — multi-select from all `@shurutech.com` users in Firestore, creator auto-added
- **Cover color** — group emoji or color for visual identity on dashboard

#### Group States

| State | Description |
|---|---|
| **Active** | Expenses can be added, balances are live. Default on creation. |
| **Settled** | All balances are zero. Group is archived but still readable. |
| **Archived** | Manually archived by creator. Hidden from dashboard, accessible via Archived tab. |

---

### 3.4 Expense Management

#### Add Expense — Fields

| Field | Type | Rules |
|---|---|---|
| **Title** | Text | Required. Max 80 chars. e.g. `Dinner at Cafe Himachal` |
| **Amount** | Number | Required. Positive. INR only in V1. Max ₹1,00,000 |
| **Paid By** | Select | Required. Defaults to logged-in user. Changeable to any group member |
| **Split Type** | Radio | `Equal` (default) · `Exact` · `Percentage` |
| **Split Among** | Multi-select | Required. Defaults to all group members. Min 2 people |
| **Category** | Select | P2 — Food · Stay · Transport · Activity · Shopping · Other |
| **Date** | Date | Required. Defaults to today. Can backdate |
| **Notes** | Textarea | Optional. Max 300 chars. For receipts, context |

#### Split Type Behaviors

**Equal Split** — `Amount ÷ number of members`. Fractional remainders go to the payer.

**Exact Split** — User enters exact amount per person. App validates they sum to total amount. Shows running difference in real time.

**Percentage Split** — User enters % per person. App validates they sum to 100%. Converts to exact INR amounts on save.

---

### 3.5 Balance & Settlement Engine

#### Balance Calculation
For each group, the app maintains a live debt graph. For every expense:
- Payer is **credited** the full amount
- Each split member is **debited** their share
- Net balance per user = `sum of credits − sum of debits` across all expenses in the group

#### Optimal Settlement Algorithm
Rather than showing every individual debt pair, SplitMonk calculates the **minimum number of transactions** needed to fully settle all balances using a greedy algorithm:

1. Calculate net balance for each member
2. Separate into **creditors** (positive balance) and **debtors** (negative balance)
3. Match largest creditor with largest debtor
4. Record the transaction, reduce both balances
5. Repeat until all balances are zero

> **Example:** If A owes B ₹500 and B owes C ₹500, the optimal solution is A pays C ₹500 directly — the middleman is eliminated.

#### Settle Up Flow
1. User opens group → **Balances** tab
2. Sees list of suggested settlements (who pays whom, how much)
3. Clicks **"Mark as Settled"** on a transaction
4. Confirmation modal: `"Confirm that [Person A] paid [Person B] ₹X?"`
5. On confirm: settlement record written to Firestore, balances recalculated live
6. If all balances reach zero: group auto-transitions to **Settled** state

---

## 4. Data Architecture

### 4.1 Firestore Collections

#### `/users/{uid}`

| Field | Type | Description |
|---|---|---|
| `uid` | `string` | Firebase Auth UID — document ID |
| `email` | `string` | `@shurutech.com` email |
| `displayName` | `string` | From Google profile |
| `photoURL` | `string` | Google avatar URL |
| `createdAt` | `timestamp` | First login timestamp |
| `lastActiveAt` | `timestamp` | Updated on each login |

---

#### `/groups/{groupId}`

| Field | Type | Description |
|---|---|---|
| `groupId` | `string` | Auto-generated Firestore ID |
| `name` | `string` | Group name e.g. `Jibhi June 2026` |
| `description` | `string` | Optional trip description |
| `createdBy` | `string` | UID of creator |
| `members` | `string[]` | Array of UIDs of all members |
| `startDate` | `timestamp` | Optional trip start date |
| `endDate` | `timestamp` | Optional trip end date |
| `status` | `string` | `active` · `settled` · `archived` |
| `totalSpend` | `number` | Denormalized — updated on each expense write |
| `createdAt` | `timestamp` | Group creation timestamp |
| `coverColor` | `string` | Hex color for card UI |

---

#### `/groups/{groupId}/expenses/{expenseId}`

| Field | Type | Description |
|---|---|---|
| `expenseId` | `string` | Auto-generated |
| `title` | `string` | Expense name |
| `amount` | `number` | Total amount in INR |
| `paidBy` | `string` | UID of the payer |
| `splitType` | `string` | `equal` · `exact` · `percentage` |
| `splits` | `map` | `{uid: amount}` — each person's exact share |
| `date` | `timestamp` | Date of the expense |
| `notes` | `string` | Optional notes |
| `category` | `string` | `food` · `stay` · `transport` · `activity` · `other` |
| `createdBy` | `string` | UID of the person who logged it |
| `createdAt` | `timestamp` | Log timestamp |
| `updatedAt` | `timestamp` | Last edit timestamp |
| `isDeleted` | `boolean` | Soft delete flag |

---

#### `/groups/{groupId}/settlements/{settlementId}`

| Field | Type | Description |
|---|---|---|
| `from` | `string` | UID of payer |
| `to` | `string` | UID of receiver |
| `amount` | `number` | Amount settled |
| `settledAt` | `timestamp` | When it was marked settled |
| `settledBy` | `string` | UID of who confirmed it |
| `note` | `string` | Optional e.g. `via GPay` |

---

### 4.2 Firestore Security Rules

All rules are enforced server-side — no client-side trust:

- Any read/write requires `request.auth != null`
- Users can only read/write their own `/users/{uid}` document
- Groups can only be read by UIDs listed in the `members` array
- Expenses can only be written by group members
- Settlements can only be written by the `from` or `to` participant

---

## 5. UI / UX Specifications

### 5.1 Design Philosophy

SplitMonk's UI is inspired by [reminderly.in](https://reminderly.in) — dark, premium, modern. Not another boring fintech dashboard with blue navbars and white cards. This is a tool the Shuru team will actually *enjoy* opening.

**Design principles:**
- **Dark-first** — deep `#0A0A0B` base, like reminderly. Easy on the eyes mid-trip in low light.
- **Mobile-first responsive** — team uses this on phones, often on bad signal, often in the mountains
- **Fast to log** — adding an expense must take under 30 seconds on mobile
- **Glanceable balances** — the number that matters (what you owe / are owed) is the first thing you see
- **One primary action per screen** — no cognitive overload, no feature soup
- **Feels native** — PWA + smooth animations = indistinguishable from a native app

---

### 5.2 Design System

#### 5.2.1 Color Palette

Derived from reminderly.in's dark aesthetic. Every color has one job.

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0A0A0B` | Page background — the deepest dark |
| `--bg-surface` | `#111113` | Cards, modals, bottom sheets |
| `--bg-elevated` | `#1A1A1F` | Hover states, selected rows, input backgrounds |
| `--bg-border` | `#2A2A32` | Subtle borders, dividers |
| `--text-primary` | `#F2F2F7` | Headlines, primary content |
| `--text-secondary` | `#8E8E9A` | Labels, captions, metadata |
| `--text-muted` | `#4A4A56` | Disabled states, placeholders |
| `--accent-violet` | `#7C6BF8` | Primary CTA, active states, focus rings — the signature color |
| `--accent-violet-dim` | `#7C6BF820` | Accent backgrounds, glows |
| `--accent-violet-border` | `#7C6BF840` | Subtle accent borders |
| `--success` | `#34D399` | "You are owed" — green, money coming to you |
| `--success-dim` | `#34D39915` | Success backgrounds |
| `--danger` | `#F87171` | "You owe" — red, money going out |
| `--danger-dim` | `#F8717115` | Danger backgrounds |
| `--warning` | `#FBBF24` | Pending settlements, unsettled indicators |
| `--gradient-hero` | `linear-gradient(135deg, #7C6BF8 0%, #A78BFA 50%, #C4B5FD 100%)` | Hero text gradient, logo mark |
| `--gradient-card` | `linear-gradient(135deg, #1A1A1F 0%, #111113 100%)` | Premium card feel |

> **Why violet?** Reminderly uses a dark base with a single vivid accent. We go with deep violet (`#7C6BF8`) — it reads as "premium fintech", pairs beautifully with both the red/green semantic colors, and doesn't clash with either. Teal would clash with green. Blue is boring. Violet is the call.

---

#### 5.2.2 Typography

| Role | Font | Weight | Size | Usage |
|---|---|---|---|---|
| **Display** | `Syne` | 700–800 | `48–72px` | Landing page hero headline |
| **Heading** | `Syne` | 600–700 | `20–32px` | Section headings, group names |
| **Body** | `Inter` | 400–500 | `14–16px` | All UI text, descriptions |
| **Mono / Data** | `JetBrains Mono` | 400–500 | `13–15px` | Amounts (₹), IDs, code |
| **Label / Caption** | `Inter` | 400 | `11–12px` | Tags, timestamps, metadata |

```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

**Type scale:**
```
72px  — Hero display (landing page only)
48px  — Page hero (landing sections)
32px  — H1 (dashboard section titles)
24px  — H2 (group names, card headings)
20px  — H3 (expense titles)
16px  — Body large
14px  — Body default (most UI copy)
13px  — Mono amounts (₹1,200)
12px  — Caption, timestamp
11px  — Badge labels
```

**Amount rendering rule:** All rupee amounts rendered in `JetBrains Mono`. Positive amounts (owed to you) in `--success`. Negative (you owe) in `--danger`. Net zero in `--text-secondary`.

```tsx
// Amount component
<span className="font-mono text-success">+₹1,200</span>
<span className="font-mono text-danger">-₹450</span>
```

---

#### 5.2.3 Spacing & Layout

```
Base unit: 4px
Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
```

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `8px` | Inputs, tags, small buttons |
| `--radius-md` | `12px` | Cards, dropdowns |
| `--radius-lg` | `16px` | Modals, bottom sheets |
| `--radius-xl` | `24px` | Hero cards, feature cards |
| `--radius-full` | `9999px` | Avatars, badges, pill buttons |

---

#### 5.2.4 Shadows & Depth

Dark UIs use glow-based depth, not drop shadows.

```css
--shadow-sm:    0 0 0 1px var(--bg-border);
--shadow-md:    0 0 0 1px var(--bg-border), 0 4px 16px rgba(0,0,0,0.4);
--shadow-lg:    0 0 0 1px var(--bg-border), 0 8px 32px rgba(0,0,0,0.6);
--shadow-glow:  0 0 24px rgba(124, 107, 248, 0.15);  /* accent glow on focus */
--shadow-glow-success: 0 0 16px rgba(52, 211, 153, 0.1);
--shadow-glow-danger:  0 0 16px rgba(248, 113, 113, 0.1);
```

---

#### 5.2.5 Component Specs

**Cards**
```css
background: var(--bg-surface);
border: 1px solid var(--bg-border);
border-radius: var(--radius-md);  /* 12px */
padding: 20px;
transition: border-color 150ms ease, box-shadow 150ms ease;

/* Hover */
border-color: var(--accent-violet-border);
box-shadow: var(--shadow-glow);
```

**Buttons**

| Variant | Background | Text | Border |
|---|---|---|---|
| Primary | `--accent-violet` | `white` | none |
| Secondary | `--bg-elevated` | `--text-primary` | `--bg-border` |
| Ghost | transparent | `--text-secondary` | none |
| Danger | `--danger-dim` | `--danger` | `1px solid --danger` at 30% opacity |
| Success | `--success-dim` | `--success` | `1px solid --success` at 30% opacity |

All buttons: `border-radius: 8px`, `font: Inter 500`, `padding: 10px 18px`, `transition: all 150ms ease`

**Inputs**
```css
background: var(--bg-elevated);
border: 1px solid var(--bg-border);
border-radius: 8px;
color: var(--text-primary);
padding: 12px 16px;

/* Focus */
border-color: var(--accent-violet);
box-shadow: 0 0 0 3px var(--accent-violet-dim);
outline: none;
```

**Badges / Pills**

| Type | Background | Text |
|---|---|---|
| Owed to you | `--success-dim` | `--success` |
| You owe | `--danger-dim` | `--danger` |
| Pending | `rgba(251,191,36,0.1)` | `--warning` |
| Neutral | `--bg-elevated` | `--text-secondary` |

**Avatars**
- Circle, `border-radius: 9999px`
- Google photo if available, else initials on `--accent-violet-dim` background
- Sizes: `24px` (inline), `32px` (list), `40px` (card), `48px` (profile)

---

### 5.3 Animation & Motion

#### Landing Page — GSAP powered

The landing page gets the full treatment. App screens stay subtle.

**Library stack:**
```json
"gsap": "^3.12.x",
"@gsap/react": "^2.x",
"lenis": "^1.x"         // smooth scroll
```

**Landing page animation sequence:**

```
1. Page load  → Hero headline word-by-word stagger (GSAP TextPlugin or SplitText)
2. Scroll S1  → Features grid cards fade+slide up with stagger (ScrollTrigger)
3. Scroll S2  → Balance mockup floats in with parallax (y offset on scroll)
4. Scroll S3  → "How it works" steps animate in sequentially
5. CTA section → Subtle ambient gradient pulse (GSAP timeline loop)
6. Throughout  → Lenis smooth scroll (replaces native scroll, 60fps silky)
```

**Parallax setup with Lenis + GSAP:**
```tsx
// app/layout.tsx — Lenis smooth scroll init
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

**Scroll-triggered section reveal (reusable):**
```tsx
// components/animations/RevealOnScroll.tsx
gsap.fromTo(element, 
  { opacity: 0, y: 40 },
  { 
    opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: element, start: 'top 85%' }
  }
);
```

#### App Screens — Framer Motion

The actual app (dashboard, groups, expenses) uses **Framer Motion** for micro-interactions — not GSAP. Framer is React-native and perfect for component-level animation.

```json
"framer-motion": "^11.x"
```

| Interaction | Animation |
|---|---|
| Page transition | `opacity: 0→1`, `y: 8→0`, `duration: 0.2` |
| Card appear | Stagger `0.05s` per card, `y: 16→0` fade |
| FAB press | Scale `1→0.94→1` spring |
| Bottom sheet open | `y: 100%→0` spring with damping |
| Toast notification | Slide in from bottom-right, auto-dismiss |
| Balance number update | Counter animation on value change |
| Settlement confirm | Checkmark lottie or CSS draw animation |

**Reduced motion — always respect:**
```tsx
const prefersReducedMotion = 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Pass as `animate` prop — Framer handles this natively
```

---

### 5.4 UI Library Stack

These are the exact tools. No mix-and-matching, no DIY component reinvention.

| Tool | Version | Purpose |
|---|---|---|
| **shadcn/ui** | latest | Base component library — buttons, inputs, modals, dropdowns, toasts. Built on Radix primitives. Copy-paste into codebase, full control. |
| **Radix UI** | via shadcn | Accessible headless primitives — no accessibility debt |
| **Tailwind CSS** | v3.4+ | Utility styling. All design tokens set as Tailwind config extensions. |
| **Framer Motion** | v11 | App screen transitions and micro-interactions |
| **GSAP** | v3.12 | Landing page scroll animations, parallax, hero sequences |
| **Lenis** | v1 | Silky smooth scroll (replaces native scroll on landing page) |
| **Lucide React** | latest | Icon set — consistent, clean, MIT licensed |
| **Recharts** | v2 | Spending analytics charts (Sprint 4) — dark theme compatible |
| **next-pwa** | v5 | PWA service worker, manifest, offline support |
| **clsx + tailwind-merge** | latest | Clean conditional className merging |

**shadcn/ui theme config** (mapped to our design tokens):
```ts
// tailwind.config.ts
extend: {
  colors: {
    background:  '#0A0A0B',
    surface:     '#111113',
    elevated:    '#1A1A1F',
    border:      '#2A2A32',
    accent:      { DEFAULT: '#7C6BF8', dim: '#7C6BF820' },
    success:     { DEFAULT: '#34D399', dim: '#34D39915' },
    danger:      { DEFAULT: '#F87171',  dim: '#F8717115' },
    warning:     '#FBBF24',
    foreground:  '#F2F2F7',
    muted:       '#8E8E9A',
  },
  fontFamily: {
    display: ['Syne', 'sans-serif'],
    body:    ['Inter', 'sans-serif'],
    mono:    ['JetBrains Mono', 'monospace'],
  },
  borderRadius: {
    sm: '8px', md: '12px', lg: '16px', xl: '24px',
  },
}
```

---

### 5.5 App Screens

| Screen | Route | Key Elements |
|---|---|---|
| **Landing / Login** | `/` | GSAP hero, parallax sections, Google Sign-in CTA |
| **Dashboard** | `/dashboard` | Active groups grid, your net balance hero number, recent activity |
| **Group Detail** | `/groups/[id]` | Expense feed, Balances tab, Members tab, + FAB |
| **Add Expense** | `/groups/[id]/add` | Bottom sheet form with dynamic split UI |
| **Expense Detail** | `/groups/[id]/expenses/[eid]` | Full breakdown, split visualization, edit/delete |
| **Balances** | `/groups/[id]/balances` | Simplified debt list, settle up flow |
| **Profile** | `/profile` | Google avatar, stats, sign out |
| **Archived Groups** | `/groups/archived` | Settled/archived, read-only |

---

### 5.6 Landing Page Structure

The landing page is the first impression. It gets the full GSAP + Lenis treatment.

```
SECTION 1 — Hero
  - Full viewport height
  - "Split bills. Stay friends." — Syne 700, gradient text
  - Subheadline in Inter muted
  - "Sign in with Google" CTA button (accent violet)
  - Floating expense card mockup with GSAP float animation
  - Ambient gradient blur orbs in background

SECTION 2 — Social proof strip
  - "Built for Shuru Team · @shurutech.com only"
  - Avatars of team members (or placeholder AAs)

SECTION 3 — Problem / Solution
  - ScrollTrigger reveal
  - "No more WhatsApp math" headline
  - 3-column pain points

SECTION 4 — Feature highlights
  - Staggered card grid, scroll-triggered
  - Each card has icon + headline + 1-line description

SECTION 5 — How it works
  - 3-step sequence with step numbers
  - Animated connector line between steps (GSAP DrawSVG or CSS)

SECTION 6 — CTA
  - "Ready for your next trip?"
  - Big Google Sign-in button
  - Subtle ambient glow pulsing behind it
```

---

## 6. Technical Architecture

### 6.1 Stack Overview

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | SSR for auth guards, API routes, file-based routing, Vercel-native, PWA-ready via `next-pwa` |
| **Auth** | Firebase Auth (Google Provider) | 1-line Google OAuth, same token works for Firestore rules — no NextAuth juggling |
| **Database** | Firestore | Realtime updates, no separate backend, offline support, free tier is generous |
| **Hosting** | Vercel | Git-push deploy, preview URLs, free for internal tools |
| **Styling** | Tailwind CSS v3.4 + shadcn/ui | Utility-first + accessible Radix-based components, fully dark-theme compatible |
| **Animation** | GSAP v3 (landing) + Framer Motion v11 (app) | GSAP for scroll/parallax magic on landing, Framer for React component micro-interactions |
| **Smooth Scroll** | Lenis v1 | 60fps silky scroll, replaces native on landing page |
| **State** | React Context + Firestore `onSnapshot` | Live balance updates without polling |
| **CI/CD** | GitHub Actions + Vercel | Auto-deploy on merge to `main` |

### 6.2 Project Structure

```
splitmonk/
├── app/
│   ├── (auth)/
│   │   └── page.tsx                  # Landing / login
│   └── (app)/
│       ├── dashboard/
│       │   └── page.tsx              # Dashboard
│       ├── groups/
│       │   ├── [id]/
│       │   │   ├── page.tsx          # Group detail
│       │   │   ├── add/page.tsx      # Add expense
│       │   │   ├── balances/page.tsx # Balances + settle up
│       │   │   └── expenses/
│       │   │       └── [eid]/page.tsx
│       │   └── archived/page.tsx
│       └── profile/page.tsx
├── components/
│   ├── ui/                           # Button, Input, Modal, Toast, Badge
│   ├── expenses/                     # ExpenseCard, ExpenseForm, SplitInput
│   └── groups/                       # GroupCard, GroupForm, MemberList
├── lib/
│   ├── firebase.ts                   # Firebase app init + exports
│   ├── firestore.ts                  # All Firestore read/write helpers
│   ├── auth.ts                       # Auth helpers, domain check
│   └── calculations.ts              # Balance calc + settlement algorithm
├── hooks/
│   ├── useAuth.ts                    # Firebase auth state hook
│   ├── useGroup.ts                   # Realtime group data hook
│   └── useExpenses.ts               # Realtime expenses hook
└── types/
    └── index.ts                      # TypeScript interfaces for all entities
```

### 6.3 Key Implementation Notes

**Domain restriction** — enforced at auth time, not just UI:
```ts
if (!user.email?.endsWith('@shurutech.com')) {
  await signOut(auth);
  throw new Error('Access restricted to Shuru team');
}
```

**Realtime balance listener** — group balance recalculates live as expenses are added:
```ts
onSnapshot(
  collection(db, `groups/${groupId}/expenses`),
  (snapshot) => recalculateBalances(snapshot.docs)
);
```

**Offline support** — Firestore's `enableIndexedDbPersistence` ensures the app works even on spotty hill station Wi-Fi. Writes queue locally and sync when connection resumes.

---

## 7. Development Action Plan

### 7.1 Sprint Overview

| Sprint | Duration | Focus | End Goal |
|---|---|---|---|
| **Sprint 1** | Weeks 1–2 | Foundation + Auth | Anyone on the team can sign in with Google and land on a live dashboard |
| **Sprint 2** | Weeks 3–4 | Groups + Expenses | Team can create a trip, add expenses, and see live balances |
| **Sprint 3** | Weeks 5–6 | Settlements + Polish | Full end-to-end Splitwise flow works for a real trip |
| **Sprint 4** | Weeks 7–8 | P2 Features + Ship | Polished, production-ready tool onboarded to the full team |

---

### Sprint 1 — Foundation & Auth (Weeks 1–2)

- [ ] Firebase project setup (Auth, Firestore, Storage configured)
- [ ] Next.js 14 project scaffold with Tailwind CSS
- [ ] Google OAuth login flow end-to-end
- [ ] Domain restriction: block non-`@shurutech.com` with clear error
- [ ] User profile auto-creation in Firestore on first login
- [ ] Protected routes via auth guard middleware
- [ ] Deploy to Vercel (staging URL shared with team)
- [ ] Landing page + dashboard shell (empty state)

**Exit criteria:** Any team member can sign in with their Shuru Google account and land on a dashboard.

---

### Sprint 2 — Groups & Expenses (Weeks 3–4)

- [ ] Create / edit / archive group flow
- [ ] Member selection (auto-populated from `/users` collection)
- [ ] Add Expense form — equal split working
- [ ] Exact split with real-time validation
- [ ] Percentage split with 100% validation
- [ ] Firestore security rules (members-only group access)
- [ ] Realtime expense list with `onSnapshot`
- [ ] Balance calculation (net per user) displayed on group detail

**Exit criteria:** Team can create a trip group, add multiple expenses with different splits, and see live running balances per member.

---

### Sprint 3 — Settlements & Polish (Weeks 5–6)

- [ ] Optimal settlement algorithm implemented and unit tested
- [ ] Settle Up flow with confirmation modal
- [ ] Settlement history view
- [ ] Edit expense (with edit history)
- [ ] Delete expense (soft delete with `isDeleted` flag)
- [ ] Expense detail screen
- [ ] Activity feed — recent expenses in a group
- [ ] Mobile UI polish and responsive QA across devices
- [ ] Group auto-transition to Settled when all balances hit zero

**Exit criteria:** Full end-to-end Splitwise experience is functional. Run it on a test trip with real data.

---

### Sprint 4 — P2 Features & Production (Weeks 7–8)

- [ ] Expense categories with filter in expense list
- [ ] Trip summary export as CSV
- [ ] Spending analytics — basic pie chart by category
- [ ] In-app notifications when someone adds an expense
- [ ] **PWA setup** — `next-pwa` config, `manifest.json`, service worker, install prompt
- [ ] **PWA icons** — all sizes (192x192, 512x512) for Android + iOS home screen
- [ ] **Offline support** — cached balance views work without internet
- [ ] Performance audit (Firestore read optimization)
- [ ] Full team QA session on staging — test PWA install on iOS and Android
- [ ] Bug bash and fixes
- [ ] Production deploy + team onboarding session (show everyone how to install PWA)

**Exit criteria:** Tool is live on production, installable as PWA on all team devices, first real trip tracked on SplitMonk.

---

### 7.2 Milestone Checklist

| Week | Milestone | Status |
|:---:|---|:---:|
| W1 | Firebase project + Next.js scaffold done | `[ ]` |
| W1 | Google OAuth working end-to-end | `[ ]` |
| W1 | Firebase upgraded to **Blaze plan** | `[ ]` |
| W2 | Domain restriction + user profile creation | `[ ]` |
| W2 | Staging deploy live on Vercel | `[ ]` |
| W3 | Group creation and member management done | `[ ]` |
| W3 | Add Expense form with equal split functional | `[ ]` |
| W4 | All 3 split types working | `[ ]` |
| W4 | Live balance view functional | `[ ]` |
| W5 | Settlement algorithm implemented + all unit tests passing | `[ ]` |
| W5 | Settle Up flow complete | `[ ]` |
| W6 | Edit/delete expense done | `[ ]` |
| W6 | Mobile responsive polish complete | `[ ]` |
| W7 | Categories + CSV export done | `[ ]` |
| W7 | PWA installable on iOS and Android | `[ ]` |
| W8 | Full team QA, bugs fixed, prod deploy | `[ ]` |

---

## 8. Risks, Assumptions & Open Questions

### 8.1 Risks

| Risk | Severity | Mitigation |
|---|:---:|---|
| Balance calculation bug leading to wrong splits | 🔴 High | See §8.1.1 — zero tolerance, full detail below |
| Someone accidentally deletes an expense | 🟡 Medium | Soft delete with `isDeleted` flag — show in audit trail, allow restore |
| Google OAuth fails on spotty hill station Wi-Fi | 🟡 Medium | Firebase Auth tokens persist locally. Firestore offline persistence queues writes and syncs on reconnect. |
| Firestore free tier limits hit | 🟢 Resolved | Proactively switch to **Blaze pay-as-you-go** before launch. Cost is negligible for team size. |
| Team member leaves company mid-trip | 🟢 Low | Expenses and balances persist. Creator can archive the group. No auto-cleanup needed. |

#### 8.1.1 Balance Calculation — Zero Tolerance Policy

This is a **production financial application used with real money**. A wrong calculation is not a UX bug — it's a trust-breaking incident. We treat this with the same rigor as a payments system.

**Proven Algorithm: Net Balance + Debt Simplification**

We use the well-established approach used by Splitwise, Tricount, and all serious expense splitting apps:

```
For each expense:
  credit[paidBy] += amount
  for each member in splits:
    debit[member] += splits[member]

Net balance per user = credit[user] - debit[user]
// Positive = owed money, Negative = owes money
```

For settlement, we use the **greedy min-transactions algorithm**:

```
1. Compute net balance for every member
2. While any non-zero balance exists:
   a. Pick max creditor (highest positive) and max debtor (highest negative)
   b. settle = min(creditor_balance, abs(debtor_balance))
   c. Record: debtor pays creditor `settle` amount
   d. creditor_balance -= settle, debtor_balance += settle
3. Result: minimum number of transactions to zero all debts
```

This is `O(n log n)` and provably correct.

**Edge Cases — Every Single One Must Be Handled**

| Edge Case | Handling |
|---|---|
| Floating point precision | **Never use float for money.** Store all amounts as integers in **paise** (₹1 = 100 paise). Display as `amount / 100`. |
| Unequal remainder in equal split | Remainder paise go to the payer. e.g. ₹100 ÷ 3 = ₹33 each → payer absorbs extra ₹1 |
| Percentage split rounding | Last member in the list absorbs any rounding diff. Always validate: `sum(computed shares) === total amount` |
| Exact split doesn't sum to total | **Hard block on save.** Show exact shortfall/overage to user. Do not allow submission. |
| Member added after expenses exist | Their balance starts at 0. Old expenses are not retroactively modified. |
| Payer is also in the split | Correct and expected — payer is credited full amount, debited their share. Net = `amount - their_share`. |
| Single-member group | Block at group creation — minimum 2 members enforced. |
| Zero or negative amount | Block — minimum ₹1. |
| Settlement recorded, expense later deleted | Settlement record persists in audit trail. Balances recalculate from remaining live expenses only. |
| Two members mutually owe each other | Net correctly cancels. e.g. A owes B ₹200 and B owes A ₹300 → B owes A ₹100 net. |
| All members equally owe each other (circular debt) | Greedy algorithm resolves correctly. e.g. A→B ₹100, B→C ₹100, C→A ₹100 → net balance is 0 for all, no settlements needed. |

**Mandatory Testing Requirements (Sprint 3 sign-off blocked until all pass)**

- [ ] Unit tests for `calculateBalances()` covering every edge case in the table above
- [ ] Unit tests for `getOptimalSettlements()` with known input/output pairs
- [ ] Property test: for any set of expenses, `sum(all net balances) === 0`
- [ ] Property test: after applying all settlements, every member's balance === 0
- [ ] Integration test: 10 expenses, 6 members, mixed split types → verify full round trip
- [ ] Regression suite runs automatically on every PR touching `lib/calculations.ts`
- [ ] Manual QA with real-world data before production launch

### 8.2 Assumptions

- All Shuru team members have a `@shurutech.com` Google Workspace account
- Team size will not exceed 25–30 people (Firestore free tier is safe)
- All expenses are in INR — no multi-currency in V1
- Actual money transfers happen outside the app (UPI, cash) — SplitMonk only tracks confirmation
- No legal or compliance requirements apply to an internal tool of this nature

### 8.3 Open Questions — Resolved ✅

All questions below were reviewed and decided. Deferred items are locked to V2.

| # | Question | Decision |
|---|---|---|
| 1 | Guest view via shared link? | **V2** — V1 is members-only |
| 2 | WhatsApp / Slack notifications? | **V2** — Slack workspace integration when ready |
| 3 | Expense locking by organizer? | **V2** |
| 4 | Receipt photo uploads? | **V2** — notes field is sufficient for V1 |
| 5 | Admin panel UI? | **V2** — Firebase console handles V1 needs |

---

## 9. Success Metrics

SplitMonk is an internal tool, not a growth product. Success metrics focus on **utility, accuracy, and adoption** within the team.

### Launch Success (Week 8)
- 100% of Shuru team members can sign in without manual setup
- First real trip fully tracked end-to-end on SplitMonk
- **Zero settlement disputes due to calculation errors** — this is non-negotiable. Every edge case is handled, every split is mathematically verified. We ship when the calculation engine is bulletproof, not before.
- Time to log an expense: **under 45 seconds on mobile**
- App is installable as a **PWA** — team members can add SplitMonk to their home screen and use it like a native app, with offline support for viewing balances mid-trip

### 3-Month Health Metrics
- Every team trip uses SplitMonk — WhatsApp split calculations eliminated
- Zero critical bugs (any balance calculation error = P0 critical, immediate hotfix)
- Positive feedback from 80%+ of the team
- Firebase Blaze plan running with negligible cost

### V2 Scope (trigger when team requests)
- Slack workspace notifications when someone adds an expense
- Guest view via shareable read-only link
- Expense locking by trip organizer
- Receipt photo uploads
- Admin panel UI for user management
- Multi-currency support for international trips
- Native mobile app (React Native) if mobile web PWA isn't enough

---

*SplitMonk — Built by Shuru, for Shuru. Internal use only. v1.1*
