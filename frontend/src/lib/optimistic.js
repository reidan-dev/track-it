import { useMutation } from '@tanstack/react-query'

/**
 * Optimistic list mutation. Applies `apply(list, vars)` to the cached array at
 * `key` immediately (instant UI), rolls back on error, and reconciles with the
 * server in the background on settle.
 *
 *   useOptimistic(qc, ['bills'], {
 *     mutationFn: deleteBill,
 *     apply: (bills, id) => bills.filter(b => b.id !== id),
 *     onSuccess: closeForm,            // optional
 *     also: [['dashboard']],           // optional extra keys to invalidate
 *   })
 */
export function useOptimistic(qc, key, { mutationFn, apply, onSuccess, also = [] }) {
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => (Array.isArray(old) ? apply(old, vars) : old))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx && ctx.prev !== undefined) qc.setQueryData(key, ctx.prev)
    },
    onSuccess,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      also.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
  })
}

// Unique-enough temp id for optimistically-created rows.
export const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
