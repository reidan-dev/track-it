import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPeople, createPerson, updatePerson, deletePerson, getPersonSummary } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, RELATIONSHIP_TYPES } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Trash2, ChevronRight, Smile, Pencil } from 'lucide-react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { HexColorPicker, HexColorInput } from 'react-colorful'

function Avatar({ person, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-2xl' : 'w-9 h-9 text-base'
  const initials = (person.name || '?').charAt(0).toUpperCase()
  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-semibold text-white shrink-0', sizeClass)}
      style={{ backgroundColor: person.color || '#64748b' }}
    >
      {person.emoji || initials}
    </div>
  )
}

function EmojiPickerPopover({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent text-sm transition-colors"
      >
        {value
          ? <span className="text-xl leading-none">{value}</span>
          : <Smile className="w-4 h-4 text-muted-foreground" />
        }
        <span className="text-muted-foreground">{value ? 'Change emoji' : 'Pick emoji'}</span>
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="ml-2 text-xs text-muted-foreground hover:text-foreground"
        >
          clear
        </button>
      )}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0">
          <Picker
            data={data}
            onEmojiSelect={(e) => { onChange(e.native); setOpen(false) }}
            theme="auto"
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}
    </div>
  )
}

function ColorPickerPopover({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent text-sm transition-colors"
      >
        <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: value }} />
        <span className="text-muted-foreground font-mono text-xs">{value}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg p-3 space-y-2">
          <HexColorPicker color={value} onChange={onChange} style={{ width: '200px' }} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">#</span>
            <HexColorInput
              color={value}
              onChange={onChange}
              prefixed
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  name: '', nickname: '', relationship_type: 'Friend',
  contact_info: '', notes: '', emoji: '', color: '#3b82f6',
}

export default function People({ embedded = false }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })
  const { data: summary } = useQuery({
    queryKey: ['person-summary', selected],
    queryFn: () => getPersonSummary(selected).then(r => r.data),
    enabled: !!selected,
  })

  const addMutation = useMutation({
    mutationFn: createPerson,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['people'] }); setShowAdd(false); setForm(EMPTY_FORM) },
  })
  const editMutation = useMutation({
    mutationFn: ({ id, data }) => updatePerson(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['person-summary', editingId] })
      setEditingId(null)
      setForm(EMPTY_FORM)
    },
  })
  const delMutation = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })

  const openEdit = (e, person) => {
    e.stopPropagation()
    setForm({
      name: person.name || '',
      nickname: person.nickname || '',
      relationship_type: person.relationship_type || 'Friend',
      contact_info: person.contact_info || '',
      notes: person.notes || '',
      emoji: person.emoji || '',
      color: person.color || '#3b82f6',
    })
    setEditingId(person.id)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingId) {
      editMutation.mutate({ id: editingId, data: form })
    } else {
      addMutation.mutate(form)
    }
  }

  const closeForm = () => {
    setShowAdd(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const selectedPerson = people.find(p => p.id === selected)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {embedded
          ? <p className="text-sm text-muted-foreground">People you split bills with and track balances against.</p>
          : <h1 className="text-2xl font-bold">People</h1>
        }
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add Person</Button>
      </div>

      {people.length === 0 && <p className="text-sm text-muted-foreground">No people added yet.</p>}

      <div className="space-y-2">
        {people.map(p => (
          <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelected(p.id)}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar person={p} />
                <div>
                  <p className="font-medium text-sm">
                    {p.name}
                    {p.nickname && <span className="text-muted-foreground ml-1.5">"{p.nickname}"</span>}
                  </p>
                  <Badge variant="muted" className="mt-0.5">{p.relationship_type}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => openEdit(e, p)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-accent"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); delMutation.mutate(p.id) }}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-accent"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary modal */}
      <Modal open={!!selected && !!summary} onClose={() => setSelected(null)} title="" className="sm:max-w-sm">
        {summary && selectedPerson && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar person={selectedPerson} size="lg" />
              <div>
                <p className="font-semibold text-lg">{summary.name}</p>
                {summary.nickname && <p className="text-sm text-muted-foreground">"{summary.nickname}"</p>}
                <Badge variant="muted" className="mt-1">{summary.relationship_type}</Badge>
              </div>
            </div>
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
            {summary.contact_info && <p className="text-sm text-muted-foreground">📞 {summary.contact_info}</p>}
            {summary.notes && <p className="text-sm text-muted-foreground">{summary.notes}</p>}
          </div>
        )}
      </Modal>

      {/* Add / Edit person modal */}
      <Modal open={showAdd || !!editingId} onClose={closeForm} title={editingId ? 'Edit Person' : 'Add Person'} className="sm:max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="person-form" disabled={addMutation.isPending || editMutation.isPending}>
              {editingId ? 'Save changes' : 'Add person'}
            </Button>
          </div>
        }
      >
        <form id="person-form" onSubmit={handleSubmit} className="space-y-4 pb-1">

          {/* Live preview */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
            <Avatar person={{ name: form.name || '?', emoji: form.emoji, color: form.color }} size="lg" />
            <div>
              <p className="font-medium">{form.name || 'Name preview'}</p>
              {form.nickname && <p className="text-sm text-muted-foreground">"{form.nickname}"</p>}
            </div>
          </div>

          {/* Emoji + color row */}
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <EmojiPickerPopover value={form.emoji} onChange={v => setForm(f => ({ ...f, emoji: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <ColorPickerPopover value={form.color} onChange={v => setForm(f => ({ ...f, color: v }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nickname</Label>
              <Input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Select value={form.relationship_type} onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}>
                {RELATIONSHIP_TYPES.map(r => <option key={r}>{r}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Input value={form.contact_info} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

        </form>
      </Modal>
    </div>
  )
}
