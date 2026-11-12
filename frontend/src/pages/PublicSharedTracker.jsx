import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPublicSharedTracker, updatePublicSharedTrackerEntry } from '@/api/sharedTracker'
import { SharedTrackerTable } from '@/components/shared/SharedTrackerTable'
import { SkeletonList } from '@/components/shared/Loading'
import { Card, CardContent } from '@/components/shared/Card'
import { MonthNavigator } from '@/components/layout/MonthNavigator'
import { usePeriod } from '@/contexts/PeriodContext'

export default function PublicSharedTracker() {
  const { token } = useParams()
  const qc = useQueryClient()
  const { month: MONTH, year: YEAR } = usePeriod()
  const queryKey = ['public-shared-tracker', token, MONTH, YEAR]

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getPublicSharedTracker(token, MONTH, YEAR).then(r => r.data),
    enabled: !!token,
    retry: false,
  })
  const rows = data?.rows ?? []
  const holders = data?.holders ?? []

  // Rows/holders come wrapped in one payload, so the shared useOptimistic
  // helper (which expects a bare array) doesn't fit — apply the patch to
  // `rows` within that payload by hand.
  const entryMutation = useMutation({
    mutationFn: ({ entryId, data }) => updatePublicSharedTrackerEntry(token, entryId, data),
    onMutate: async ({ entryId, data: patch }) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData(queryKey)
      qc.setQueryData(queryKey, (old) => old && {
        ...old,
        rows: old.rows.map(r => (r.entry.id === entryId ? { ...r, entry: { ...r.entry, ...patch } } : r)),
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev !== undefined) qc.setQueryData(queryKey, ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey }),
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
            holders={holders}
            onEntryChange={(entryId, data) => entryMutation.mutate({ entryId, data })}
          />
        )}
      </div>
    </div>
  )
}
