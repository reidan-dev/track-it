import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Share2, Copy, Check } from 'lucide-react'
import {
  getSharedTracker, addSharedTrackerRow, renameSharedTrackerRow,
  deleteSharedTrackerRow, updateSharedTrackerEntry, getShareLink,
} from '@/api/sharedTracker'
import { getPeople } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { HelpTip } from '@/components/shared/HelpTip'
import { SharedTrackerTable } from '@/components/shared/SharedTrackerTable'
import { SkeletonList } from '@/components/shared/Loading'
import { usePeriod } from '@/contexts/PeriodContext'
import { useOptimistic } from '@/lib/optimistic'

export default function SharedTracker() {
  const qc = useQueryClient()
  const { month: MONTH, year: YEAR } = usePeriod()
  const queryKey = ['shared-tracker', MONTH, YEAR]
  const [newLabel, setNewLabel] = useState('')
  const [shareLink, setShareLink] = useState(null)
  const [copied, setCopied] = useState(false)

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getSharedTracker(MONTH, YEAR).then(r => r.data),
  })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })

  const addMutation = useOptimistic(qc, queryKey, {
    mutationFn: (label) => addSharedTrackerRow(label),
    apply: (rows, label) => [...rows, { id: `tmp-${Date.now()}`, label, entry: { id: `tmp-${Date.now()}`, amount: null, state: 'unpaid', notes: null, held_by: null } }],
    onSuccess: () => setNewLabel(''),
  })
  const renameMutation = useOptimistic(qc, queryKey, {
    mutationFn: ({ id, label }) => renameSharedTrackerRow(id, label),
    apply: (rows, { id, label }) => rows.map(r => (r.id === id ? { ...r, label } : r)),
  })
  const deleteMutation = useOptimistic(qc, queryKey, {
    mutationFn: (id) => deleteSharedTrackerRow(id),
    apply: (rows, id) => rows.filter(r => r.id !== id),
  })
  const entryMutation = useOptimistic(qc, queryKey, {
    mutationFn: ({ entryId, data }) => updateSharedTrackerEntry(entryId, data),
    apply: (rows, { entryId, data }) => rows.map(r => (r.entry.id === entryId ? { ...r, entry: { ...r.entry, ...data } } : r)),
  })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!newLabel.trim()) return
    addMutation.mutate(newLabel.trim())
  }

  const handleShare = async () => {
    const { data } = await getShareLink()
    setShareLink(`${window.location.origin}/shared/${data.token}`)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-1.5">
          Shared Tracker
          <HelpTip text="A list anyone with the link can view and update — amounts, Paid/Unpaid, and notes. Only you can add or remove rows here." />
        </h1>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-2" />Share
        </Button>
      </div>

      {shareLink && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2">
            <Input readOnly value={shareLink} className="flex-1 text-xs" onFocus={e => e.target.select()} />
            <Button size="icon" variant="outline" onClick={handleCopy} aria-label="Copy link">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Card><CardContent className="py-2"><SkeletonList rows={3} /></CardContent></Card>}

      {!isLoading && (
        <SharedTrackerTable
          rows={rows}
          isEditor
          people={people}
          onRenameRow={(id, label) => renameMutation.mutate({ id, label })}
          onDeleteRow={(id) => deleteMutation.mutate(id)}
          onEntryChange={(entryId, data) => entryMutation.mutate({ entryId, data })}
        />
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="New row label" className="flex-1" />
        <Button type="submit" disabled={addMutation.isPending}>
          <Plus className="w-4 h-4 mr-2" />Add
        </Button>
      </form>
    </div>
  )
}
