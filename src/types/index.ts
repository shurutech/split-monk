export interface User {
  uid: string
  email: string
  displayName: string
  photoURL: string
  upiId?: string
  createdAt: Date
  lastActiveAt: Date
}

export interface Group {
  id: string
  name: string
  description?: string
  createdBy: string
  members: string[]           // resolved UIDs
  pendingInvites: string[]    // emails awaiting first sign-in
  startDate?: Date
  endDate?: Date
  status: 'active' | 'settled' | 'archived'
  totalSpend: number
  createdAt: Date
  coverColor: string
  contributionAmount?: number // paise per person; set by organiser for advance pool
}

// Top-level /invites/{encodedEmail} — resolved on first sign-in
export interface Invite {
  email: string
  groupIds: string[]
}

export interface Split {
  [uid: string]: number // amount in PAISE
}

export interface Expense {
  id: string
  title: string
  amount: number // in PAISE (₹1 = 100 paise)
  paidBy: string // uid for single payer, 'multiple' sentinel for multi-payer
  payments?: Record<string, number> // multi-payer only: uid → paise paid. absent on old expenses
  splitType: 'equal' | 'exact' | 'percentage'
  splits: Split
  date: Date
  notes?: string
  category: 'food' | 'stay' | 'transport' | 'activity' | 'shopping' | 'other' | 'contribution'
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isDeleted: boolean
  isContribution?: boolean // true for advance pool contribution expenses
}

export interface Settlement {
  id: string
  from: string
  to: string
  amount: number // in PAISE
  settledAt: Date
  settledBy: string
  note?: string
}

export interface Balance {
  uid: string
  net: number // positive = owed to you, negative = you owe
}

export interface SettlementSuggestion {
  from: string
  to: string
  amount: number
}

export interface CreateGroupInput {
  name: string
  description?: string
  members: string[]        // resolved UIDs
  pendingInvites: string[] // emails not yet in Firestore
  startDate?: Date
  endDate?: Date
  coverColor: string
}

export interface AddExpenseInput {
  title: string
  amount: number // in PAISE
  paidBy: string // uid or 'multiple'
  payments?: Record<string, number> // multi-payer only
  splitType: 'equal' | 'exact' | 'percentage'
  splits: Split
  date: Date
  notes?: string
  category: 'food' | 'stay' | 'transport' | 'activity' | 'shopping' | 'other' | 'contribution'
  createdBy: string
  isContribution?: boolean
}

export interface CreateSettlementInput {
  from: string
  to: string
  amount: number
  settledBy: string
  note?: string
}
