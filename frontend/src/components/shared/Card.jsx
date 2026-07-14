import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-lg border border-border/60 bg-card text-card-foreground shadow-sm shadow-black/[0.03] dark:shadow-black/20', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 p-4 sm:p-6', className)} {...props}>{children}</div>
}

export function CardTitle({ className, children, ...props }) {
  return <h3 className={cn('font-semibold leading-none tracking-tight', className)} {...props}>{children}</h3>
}

export function CardContent({ className, children, ...props }) {
  return <div className={cn('p-4 sm:p-6 pt-0', className)} {...props}>{children}</div>
}
