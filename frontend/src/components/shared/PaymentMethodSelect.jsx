import { useQuery } from '@tanstack/react-query'
import { getPaymentMethods } from '@/api/paymentMethods'
import { cn } from '@/lib/utils'

function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => getPaymentMethods().then(r => r.data),
    staleTime: 60_000,
  })
}

export function PaymentMethodSelect({ value, onChange }) {
  const { data: methods = [] } = usePaymentMethods()

  if (methods.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No payment methods set up. <a href="/payment-methods" className="underline hover:text-foreground">Add some →</a>
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {methods.map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(value === m.name ? '' : m.name)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            value === m.name
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:border-primary/40'
          )}
        >
          {m.icon && <span>{m.icon}</span>}
          {!m.icon && (
            <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: m.color || '#6b7280' }} />
          )}
          {m.name}
        </button>
      ))}
    </div>
  )
}

export function PaymentMethodBadge({ value }) {
  const { data: methods = [] } = usePaymentMethods()
  if (!value) return null
  const method = methods.find(m => m.name === value)
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {method?.icon
        ? method.icon
        : method?.color
          ? <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: method.color }} />
          : null
      }
      {value}
    </span>
  )
}
