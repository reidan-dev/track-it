import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '@/api/paymentMethods'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label } from '@/components/shared/Input'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Pencil, Star } from 'lucide-react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { HexColorPicker, HexColorInput } from 'react-colorful'

const DEFAULT_COLORS = ['#6b7280','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899']

const EMPTY_FORM = { name: '', icon: '', color: '#6b7280', is_default: false }

function MethodIcon({ method, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-10 h-10 text-xl' : 'w-8 h-8 text-sm'
  return (
    <div
      className={cn('rounded-lg flex items-center justify-center font-bold text-white shrink-0', sizeClass)}
      style={{ backgroundColor: method.color || '#6b7280' }}
    >
      {method.icon || method.name.charAt(0).toUpperCase()}
    </div>
  )
}

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent text-sm">
        {value ? <span className="text-xl">{value}</span> : <span className="text-muted-foreground">Pick icon</span>}
      </button>
      {value && <button type="button" onClick={() => onChange('')} className="ml-2 text-xs text-muted-foreground hover:text-foreground">clear</button>}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0">
          <Picker data={data} onEmojiSelect={e => { onChange(e.native); setOpen(false) }} previewPosition="none" skinTonePosition="none" theme="auto" />
        </div>
      )}
    </div>
  )
}

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 flex-wrap">
        {DEFAULT_COLORS.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={cn('w-6 h-6 rounded-full transition-transform hover:scale-110', value === c && 'ring-2 ring-offset-2 ring-foreground scale-110')}
            style={{ backgroundColor: c }} />
        ))}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-input bg-background text-xs hover:bg-accent">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: value }} />
          Custom
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg p-3 space-y-2" ref={ref}>
          <HexColorPicker color={value} onChange={onChange} style={{ width: '200px' }} />
          <HexColorInput color={value} onChange={onChange} prefixed
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
      )}
    </div>
  )
}

export default function PaymentMethods({ embedded = false }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => getPaymentMethods().then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['payment-methods'] })
  const addMutation = useMutation({ mutationFn: createPaymentMethod, onSuccess: () => { invalidate(); closeForm() } })
  const editMutation = useMutation({ mutationFn: ({ id, data }) => updatePaymentMethod(id, data), onSuccess: () => { invalidate(); closeForm() } })
  const delMutation = useMutation({ mutationFn: deletePaymentMethod, onSuccess: invalidate })

  const openEdit = (m) => {
    setForm({ name: m.name, icon: m.icon || '', color: m.color || '#6b7280', is_default: m.is_default })
    setEditingId(m.id)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingId) editMutation.mutate({ id: editingId, data: form })
    else addMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {!embedded && <h1 className="text-2xl font-bold">Payment Methods</h1>}
          <p className="text-sm text-muted-foreground mt-0.5">Your methods appear when adding bills, expenses, and installments.</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Method
        </Button>
      </div>

      {methods.length === 0 && (
        <p className="text-sm text-muted-foreground">No payment methods yet. Add one to use it across your entries.</p>
      )}

      <div className="space-y-2">
        {methods.map(m => (
          <Card key={m.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MethodIcon method={m} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{m.name}</p>
                    {m.is_default && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                        <Star className="w-3 h-3 fill-current" />default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{m.color}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(m)} className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-accent">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => delMutation.mutate(m.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-accent">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Payment Method' : 'Add Payment Method'} className="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="pm-form" disabled={addMutation.isPending || editMutation.isPending}>
              {editingId ? 'Save changes' : 'Add'}
            </Button>
          </div>
        }
      >
        <form id="pm-form" onSubmit={handleSubmit} className="space-y-4 pb-1">

          {/* Live preview */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
            <MethodIcon method={{ name: form.name || '?', icon: form.icon, color: form.color }} size="lg" />
            <p className="font-medium">{form.name || 'Preview'}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. GCash, BDO Credit" required />
          </div>

          <div className="space-y-1.5">
            <Label>Icon (emoji)</Label>
            <EmojiPicker value={form.icon} onChange={v => setForm(f => ({ ...f, icon: v }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorPicker value={form.color} onChange={v => setForm(f => ({ ...f, color: v }))} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
              className="w-4 h-4 rounded border-border" />
            <span className="text-sm">Set as default</span>
          </label>

        </form>
      </Modal>
    </div>
  )
}
