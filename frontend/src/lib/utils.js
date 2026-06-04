import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const CURRENCY_SYMBOLS = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  SGD: 'S$',
}

export function formatCurrency(amount, currency = 'PHP') {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  return `${symbol}${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function getBillingPeriod(day) {
  return day <= 15 ? 1 : 2
}

export const EXPENSE_CATEGORIES = [
  'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Other',
]

export const INCOME_TYPES = ['Salary', 'Freelance', 'Other']

export const RELATIONSHIP_TYPES = ['Partner', 'Family', 'Friend', 'Colleague', 'Acquaintance', 'Other']

export const PAYMENT_METHODS = [
  { value: 'Cash',          icon: '💵' },
  { value: 'GCash',         icon: '📱' },
  { value: 'Maya',          icon: '💜' },
  { value: 'Credit Card',   icon: '💳' },
  { value: 'Debit Card',    icon: '🏧' },
  { value: 'Bank Transfer', icon: '🏦' },
  { value: 'Other',         icon: '🔄' },
]

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
