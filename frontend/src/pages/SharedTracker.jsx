import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Share2, Copy, Check, Eye, Bell } from 'lucide-react'
import {
  getSharedTracker, addSharedTrackerRow, updateSharedTrackerRow,
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
  const [showPreview, setShowPreview] = useState(false)
  const [banner, setBanner] = useState(null)
  const prevRowsRef = useRef(null)
  const prevKeyRef = useRef(null)

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getSharedTracker(MONTH, YEAR).then(r => r.data),
    refetchInterval: 15000,
  })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })

  // Notice when a refetch brings in a change this tab didn't make itself
  // (i.e. someone edited via the viewer link) — switching months also
  // changes every entry, so skip the comparison right after that.
  useEffect(() => {
    const key = `${MONTH}-${YEAR}`
    const prev = prevRowsRef.current
    if (prevKeyRef.current === key && prev) {
      for (const row of rows) {
        const prevRow = prev.find(r => r.id === row.id)
        if (!prevRow) continue
        const a = prevRow.entry, b = row.entry
        if (a.amount !== b.amount || a.state !== b.state || a.notes !== b.notes || a.held_by !== b.held_by) {
          setBanner(`Viewer updated "${row.label}"`)
          break
        }
      }
    }
    prevKeyRef.current = key
    prevRowsRef.current = rows
  }, [rows, MONTH, YEAR])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const addMutation = useOptimistic(qc, queryKey, {
    mutationFn: (label) => addSharedTrackerRow(label),
    apply: (rows, label) => [...rows, {
      id: `tmp-${Date.now()}`, label, allowed_holders: [], holders: [],
      entry: { id: `tmp-${Date.now()}`, amount: null, state: 'unpaid', notes: null, held_by: null },
    }],
    onSuccess: () => setNewLabel(''),
  })
  const rowMutation = useOptimistic(qc, queryKey, {
    mutationFn: ({ id, data }) => updateSharedTrackerRow(id, data),
    apply: (rows, { id, data }) => rows.map(r => (r.id === id ? { ...r, ...data } : r)),
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(v => !v)}>
            <Eye className="w-4 h-4 mr-2" />{showPreview ? 'Hide' : 'Preview'}
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />Share
          </Button>
        </div>
      </div>

      {banner && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-2.5 flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4 text-primary shrink-0" />
            {banner}
          </CardContent>
        </Card>
      )}

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

      {showPreview && !isLoading && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">What viewers see</p>
          <div className="pointer-events-none opacity-90">
            <SharedTrackerTable rows={rows} isEditor={false} onEntryChange={() => {}} />
          </div>
        </div>
      )}

      {!isLoading && (
        <SharedTrackerTable
          rows={rows}
          isEditor
          people={people}
          onRenameRow={(id, label) => rowMutation.mutate({ id, data: { label } })}
          onDeleteRow={(id) => deleteMutation.mutate(id)}
          onAllowedHoldersChange={(id, allowed_holders) => rowMutation.mutate({ id, data: { allowed_holders } })}
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
