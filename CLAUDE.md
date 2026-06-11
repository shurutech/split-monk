@AGENTS.md

# SplitMonk

Private expense-splitting web app for the Shuru team. Google OAuth restricted to `@shurutech.com`.

## Stack
- **Next.js 16** (App Router, Turbopack in dev)
- **Firebase** — Auth (Google OAuth) + Firestore (realtime) — project: `splitmonk-007`
- **Tailwind CSS v4** + shadcn/ui (base-ui variant)
- **GSAP** (landing page) + **Framer Motion** (app micro-interactions)
- **Vitest** for unit tests

## Key rules
- All money stored in **paise** (never rupees/floats). `toPaise()` / `formatINR()` in `src/lib/calculations.ts`
- Balance invariant: `sum(all net balances) === 0` — enforced in `calculateBalances()`
- Soft deletes only on expenses (`isDeleted: true`) — never hard delete
- Domain check in `src/lib/auth.ts` — non-`@shurutech.com` accounts are signed out immediately

## Run
```bash
npm run dev     # localhost:3000
npm test        # vitest unit tests (14 tests)
npm run build   # production build
firebase deploy --only firestore:rules,firestore:indexes  # deploy rules
```

## Structure
```
src/
  app/(auth)/          # Landing page (unauthenticated)
  app/(app)/           # Auth-guarded app shell
  components/
    auth/              # AuthProvider, GoogleSignInButton
    groups/            # GroupCard, GroupForm, MemberList, SpendingAnalytics
    expenses/          # ExpenseCard, ExpenseList
    balances/          # BalancesTab
    layout/            # Navbar, BottomNav
    ui/                # Shared: UserAvatar, AmountDisplay, EmptyState, etc.
  lib/
    firebase.ts        # Firebase init + offline persistence
    auth.ts            # signInWithGoogle, signOut, domain check
    firestore.ts       # All Firestore CRUD helpers
    calculations.ts    # Split calc + balance engine + settlement algorithm
    export.ts          # CSV export
  hooks/               # useAuth, useGroup, useUserGroups, useExpenses
  types/index.ts       # All TypeScript interfaces
  constants/index.ts   # Colors, categories, limits
```

## Firestore collections
- `/users/{uid}` — user profiles (auto-created on first login)
- `/groups/{groupId}` — groups with members array
- `/groups/{groupId}/expenses/{expenseId}` — expenses (soft-deleted with isDeleted)
- `/groups/{groupId}/settlements/{settlementId}` — recorded settlements
