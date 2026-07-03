// No domain restriction — any Google account can sign in and be invited
export const ALLOWED_DOMAIN = ''

export const GROUP_COLORS = [
  { name: 'Violet', value: '#7C6BF8' },
  { name: 'Teal',   value: '#2DD4BF' },
  { name: 'Rose',   value: '#FB7185' },
  { name: 'Amber',  value: '#FBBF24' },
  { name: 'Blue',   value: '#60A5FA' },
  { name: 'Green',  value: '#34D399' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'food',         label: 'Food',         icon: 'Utensils' },
  { value: 'stay',         label: 'Stay',         icon: 'Hotel' },
  { value: 'transport',    label: 'Transport',    icon: 'Car' },
  { value: 'activity',     label: 'Activity',     icon: 'Target' },
  { value: 'shopping',     label: 'Shopping',     icon: 'ShoppingBag' },
  { value: 'other',        label: 'Other',        icon: 'MoreHorizontal' },
  { value: 'contribution', label: 'Contribution', icon: 'Wallet' },
] as const

export const MAX_GROUP_NAME_LENGTH = 50
export const MAX_DESCRIPTION_LENGTH = 200
export const MAX_EXPENSE_TITLE_LENGTH = 80
export const MAX_EXPENSE_AMOUNT_PAISE = 10_000_000 // ₹1,00,000 in paise
export const MIN_EXPENSE_AMOUNT_PAISE = 100        // ₹1 in paise
export const MIN_GROUP_MEMBERS = 2
