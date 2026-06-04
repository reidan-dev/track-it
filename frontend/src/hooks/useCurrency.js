import { formatCurrency, CURRENCY_SYMBOLS } from '@/lib/utils'

export function useCurrency(currency = 'PHP') {
  return {
    currency,
    symbol: CURRENCY_SYMBOLS[currency] || currency,
    format: (amount) => formatCurrency(amount, currency),
  }
}
