import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { Input, Textarea, Select } from '@/components/shared/Input'
import { cn } from '@/lib/utils'

function Row({ row, isEditor, holderOptions, onLabelChange, onDelete, onEntryChange }) {
  const [label, setLabel] = useState(row.label)
  const [amount, setAmount] = useState(row.entry.amount ?? '')
  const [notes, setNotes] = useState(row.entry.notes ?? '')

  useEffect(() => { setLabel(row.label) }, [row.label])
  useEffect(() => {
    setAmount(row.entry.amount ?? '')
    setNotes(row.entry.notes ?? '')
  }, [row.entry.id, row.entry.amount, row.entry.notes])

  const paid = row.entry.state === 'paid'

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-2">
          {isEditor ? (
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              onBlur={() => { if (label.trim() && label.trim() !== row.label) onLabelChange(label.trim()) }}
              className="font-medium text-sm h-8 flex-1"
            />
          ) : (
            <p className="font-medium text-sm flex-1 truncate">{row.label}</p>
          )}
          {isEditor && (
            <button onClick={onDelete} aria-label="Delete row"
              className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-accent shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number" inputMode="decimal" step="0.01" placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onBlur={() => onEntryChange({ amount: amount === '' ? null : parseFloat(amount) })}
            className="h-8 text-sm flex-1"
          />
          <button onClick={() => onEntryChange({ state: paid ? 'unpaid' : 'paid' })} className="shrink-0">
            <Badge variant={paid ? 'success' : 'warning'} className={cn('cursor-pointer select-none')}>
              {paid ? 'Paid' : 'Unpaid'}
            </Badge>
          </button>
        </div>

        <Select
          value={row.entry.held_by ?? ''}
          onChange={e => onEntryChange({ held_by: e.target.value ? parseInt(e.target.value) : null })}
          className="h-8 text-xs"
        >
          <option value="">Held by — none —</option>
          {holderOptions.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>

        <Textarea
          placeholder="Notes" rows={1} value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => onEntryChange({ notes: notes.trim() === '' ? null : notes.trim() })}
          className="text-xs min-h-0 h-8 py-1.5"
        />
      </CardContent>
    </Card>
  )
}

export function SharedTrackerTable({ rows, isEditor, people = [], holders = [], onRenameRow, onDeleteRow, onEntryChange }) {
  const holderOptions = isEditor ? people.map(p => ({ id: p.id, name: p.nickname || p.name })) : holders

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No rows yet{isEditor ? ' — add one below.' : '.'}</p>
  }
  return (
    <div className="space-y-2">
      {rows.map(row => (
        <Row
          key={row.id}
          row={row}
          isEditor={isEditor}
          holderOptions={holderOptions}
          onLabelChange={(label) => onRenameRow(row.id, label)}
          onDelete={() => onDeleteRow(row.id)}
          onEntryChange={(data) => onEntryChange(row.entry.id, data)}
        />
      ))}
    </div>
  )
}
