import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPublicSharedTracker, updatePublicSharedTrackerEntry } from '@/api/sharedTracker'
import { SharedTrackerTable } from '@/components/shared/SharedTrackerTable'
import { SkeletonList } from '@/components/shared/Loading'
import { Card, CardContent } from '@/components/shared/Card'
import { MonthNavigator } from '@/components/layout/MonthNavigator'
import { usePeriod } from '@/contexts/PeriodContext'
import { useOptimistic } from '@/lib/optimistic'

export default function PublicSharedTracker() {
  const { token } = useParams()
  const qc = useQueryClient()
  const { month: MONTH, year: YEAR } = usePeriod()
  const queryKey = ['public-shared-tracker', token, MONTH, YEAR]

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getPublicSharedTracker(token, MONTH, YEAR).then(r => r.data),
    enabled: !!token,
    retry: false,
  })

  const entryMutation = useOptimistic(qc, queryKey, {
    mutationFn: ({ entryId, data }) => updatePublicSharedTrackerEntry(token, entryId, data),
    apply: (rows, { entryId, data }) => rows.map(r => (r.entry.id === entryId ? { ...r, entry: { ...r.entry, ...data } } : r)),
  })

  return (
    <div className="min-h-screen-safe bg-background flex items-start justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Shared Tracker</h1>
          <MonthNavigator />
        </div>

        {isLoading && <Card><CardContent className="py-2"><SkeletonList rows={3} /></CardContent></Card>}
        {isError && <p className="text-sm text-destructive">This link isn't valid.</p>}

        {!isLoading && !isError && (
          <SharedTrackerTable
            rows={rows}
            isEditor={false}
            onEntryChange={(entryId, data) => entryMutation.mutate({ entryId, data })}
          />
        )}
      </div>
    </div>
  )
}
