import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPeople, createPerson, deletePerson, getPersonSummary } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, RELATIONSHIP_TYPES } from '@/lib/utils'
import { Plus, Trash2, ChevronRight } from 'lucide-react'

export default function People() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', nickname: '', relationship_type: 'Friend', contact_info: '', notes: '' })

  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })
  const { data: summary } = useQuery({
    queryKey: ['person-summary', selected],
    queryFn: () => getPersonSummary(selected).then(r => r.data),
    enabled: !!selected,
  })

  const addMutation = useMutation({ mutationFn: createPerson, onSuccess: () => { qc.invalidateQueries({ queryKey: ['people'] }); setShowAdd(false) } })
  const delMutation = useMutation({ mutationFn: deletePerson, onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }) })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">People</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add Person</Button>
      </div>

      {people.length === 0 && <p className="text-sm text-muted-foreground">No people added yet.</p>}

      <div className="space-y-2">
        {people.map(p => (
          <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelected(p.id)}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{p.name}{p.nickname && <span className="text-muted-foreground ml-1">"{p.nickname}"</span>}</p>
                <Badge variant="muted" className="mt-0.5">{p.relationship_type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button onClick={e => { e.stopPropagation(); delMutation.mutate(p.id) }} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Person summary modal */}
      <Modal open={!!selected && !!summary} onClose={() => setSelected(null)} title={summary?.name || ''}>
        {summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-md p-3">
                <p className="text-xs text-muted-foreground">Net Balance</p>
                <p className={`text-lg font-bold ${parseFloat(summary.net_balance) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(summary.net_balance)}
                </p>
              </div>
              <div className="bg-muted rounded-md p-3">
                <p className="text-xs text-muted-foreground">Active Loans</p>
                <p className="text-lg font-bold">{summary.active_loan_count}</p>
              </div>
            </div>
            {summary.contact_info && <p className="text-sm text-muted-foreground">Contact: {summary.contact_info}</p>}
            {summary.notes && <p className="text-sm text-muted-foreground">{summary.notes}</p>}
          </div>
        )}
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Person">
        <form onSubmit={e => { e.preventDefault(); addMutation.mutate(form) }} className="space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Nickname</Label><Input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Relationship</Label><Select value={form.relationship_type} onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}>{RELATIONSHIP_TYPES.map(r => <option key={r}>{r}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Contact</Label><Input value={form.contact_info} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={addMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
