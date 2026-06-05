import { useState, useEffect } from 'react'
import { HelpTip } from '@/components/shared/HelpTip'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, testTelegram, testReminder, exportModule } from '@/api/settings'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { cn } from '@/lib/utils'
import People from '@/pages/People'
import PaymentMethods from '@/pages/PaymentMethods'

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'SGD']
const THEMES = ['system', 'light', 'dark']
const MODULES = ['expenses', 'bills', 'installments', 'loans', 'income']
const TABS = [
  { id: 'general', label: 'General' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'people', label: 'People' },
  { id: 'methods', label: 'Pay Methods' },
]

const REMINDER_DEFAULTS = {
  bill_reminder_enabled: false,
  p1_reminder_day: 1,
  p1_reminder_time: '09:00',
  p2_reminder_day: 16,
  p2_reminder_time: '09:00',
  reminder_utc_offset: 8,
  p1_lead_prev_month: false,
  p2_lead_prev_month: false,
  balance_reminder_enabled: false,
}

function PeriodSchedule({ form, setForm, title, subtitle, dayKey, timeKey, leadKey, maxDay, leadSubject }) {
  const lead = form[leadKey]
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-sm font-semibold">{title} <span className="text-muted-foreground font-normal">{subtitle}</span></p>
      <div className="flex gap-3">
        <div className="space-y-1.5">
          <Label>Day</Label>
          <Input type="number" min="1" max={lead ? 31 : maxDay} value={form[dayKey]}
            onChange={e => setForm(f => ({ ...f, [dayKey]: Number(e.target.value) }))} className="w-20" />
        </div>
        <div className="space-y-1.5">
          <Label>Time</Label>
          <Input type="time" value={form[timeKey]}
            onChange={e => setForm(f => ({ ...f, [timeKey]: e.target.value }))} className="w-32" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form[leadKey]}
          onChange={e => setForm(f => ({ ...f, [leadKey]: e.target.checked }))}
          className="w-4 h-4 rounded border-border" />
        <span className="text-xs">Send in the previous month (advance notice)</span>
      </label>
      <p className="text-xs text-muted-foreground">
        {lead
          ? `Fires on this day of the prior month, about ${leadSubject}. Use 31 for the last day.`
          : 'Fires on this day of the same month.'}
      </p>
    </div>
  )
}

export default function Settings() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('general')
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => getSettings().then(r => r.data) })
  const [form, setForm] = useState({ currency: 'PHP', theme: 'system', telegram_bot_token: '', telegram_chat_id: '', telegram_enabled: false, ...REMINDER_DEFAULTS })
  const [testMsg, setTestMsg] = useState('')
  const [reminderMsg, setReminderMsg] = useState('')
  const [exportStatus, setExportStatus] = useState('')

  useEffect(() => {
    if (settings) {
      setForm({
        currency: settings.currency || 'PHP',
        theme: settings.theme || 'system',
        telegram_bot_token: settings.telegram_bot_token || '',
        telegram_chat_id: settings.telegram_chat_id || '',
        telegram_enabled: settings.telegram_enabled || false,
        bill_reminder_enabled: settings.bill_reminder_enabled || false,
        p1_reminder_day: settings.p1_reminder_day || 1,
        p1_reminder_time: settings.p1_reminder_time || '09:00',
        p2_reminder_day: settings.p2_reminder_day || 16,
        p2_reminder_time: settings.p2_reminder_time || '09:00',
        reminder_utc_offset: settings.reminder_utc_offset ?? 8,
        p1_lead_prev_month: settings.p1_lead_prev_month || false,
        p2_lead_prev_month: settings.p2_lead_prev_month || false,
        balance_reminder_enabled: settings.balance_reminder_enabled || false,
      })
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      const theme = data.data.theme || form.theme
      document.documentElement.classList.remove('dark', 'light')
      if (theme === 'dark') document.documentElement.classList.add('dark')
      else if (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark')
      localStorage.setItem('theme', theme)
    },
  })

  const testMutation = useMutation({
    mutationFn: testTelegram,
    onSuccess: () => setTestMsg('Test message sent!'),
    onError: () => setTestMsg('Failed to send. Check your token and chat ID.'),
  })

  const reminderTestMutation = useMutation({
    mutationFn: testReminder,
    onSuccess: (res) => setReminderMsg(res.data?.message ? `${res.data.message} — check Telegram.` : 'Sent!'),
    onError: () => setReminderMsg('Failed. Make sure Telegram is configured and Saved first.'),
  })

  const handleExport = async (module) => {
    try {
      const res = await exportModule(module)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `trackit_${module}_${new Date().toISOString().slice(0, 7)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus(`Exported ${module}!`)
    } catch {
      setExportStatus('Export failed.')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-1.5">Settings <HelpTip text="Preferences, Telegram reminders, data export, plus managing People and payment methods." /></h1>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'people' && <People embedded />}
      {tab === 'methods' && <PaymentMethods embedded />}

      {tab === 'reminders' && (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Reminders</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              At each scheduled time below you'll get a Telegram message for whichever reminders you turn on. Configure your bot token & chat ID under the{' '}
              <button onClick={() => setTab('general')} className="text-primary hover:underline">General</button> tab first.
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.bill_reminder_enabled}
                  onChange={e => setForm(f => ({ ...f, bill_reminder_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded border-border" />
                <span className="text-sm font-medium">Bill & installment reminders <span className="text-muted-foreground font-normal">— what's unpaid each period</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.balance_reminder_enabled}
                  onChange={e => setForm(f => ({ ...f, balance_reminder_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded border-border" />
                <span className="text-sm font-medium">Balance summary <span className="text-muted-foreground font-normal">— who owes you / whom you owe</span></span>
              </label>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Schedule</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <PeriodSchedule form={form} setForm={setForm} title="1st–15th" subtitle=""
                  dayKey="p1_reminder_day" timeKey="p1_reminder_time" leadKey="p1_lead_prev_month" maxDay={15} leadSubject="next month" />
                <PeriodSchedule form={form} setForm={setForm} title="16th–end" subtitle=""
                  dayKey="p2_reminder_day" timeKey="p2_reminder_time" leadKey="p2_lead_prev_month" maxDay={31} leadSubject="next month" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Both enabled reminders are sent (as separate messages) at each period's time. Any day past the month's length fires on the last day.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Your timezone <span className="text-muted-foreground text-xs">(UTC offset, hours)</span></Label>
              <Input type="number" min="-12" max="14" value={form.reminder_utc_offset}
                onChange={e => setForm(f => ({ ...f, reminder_utc_offset: Number(e.target.value) }))} className="w-24" />
              <p className="text-xs text-muted-foreground">Philippines is +8. Schedule times above are in this timezone.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save Reminders'}
              </Button>
              {saveMutation.isSuccess && <Badge variant="success">Saved!</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Send a Test</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Sends both reminders for a period right now — the bills/installments message and the balance summary, as separate messages (uses your saved Telegram settings).</p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" size="sm" disabled={reminderTestMutation.isPending}
                onClick={() => reminderTestMutation.mutate(1)}>Test 1st–15th</Button>
              <Button variant="secondary" size="sm" disabled={reminderTestMutation.isPending}
                onClick={() => reminderTestMutation.mutate(2)}>Test 16th–end</Button>
            </div>
            {reminderMsg && <p className="text-sm text-muted-foreground">{reminderMsg}</p>}
          </CardContent>
        </Card>
      </div>
      )}

      {tab === 'general' && (
      <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-40">
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} className="w-40">
              {THEMES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </div>
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Preferences'}
          </Button>
          {saveMutation.isSuccess && <Badge variant="success">Saved!</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Telegram Reminders</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bot Token</Label>
            <Input type="password" value={form.telegram_bot_token} onChange={e => setForm(f => ({ ...f, telegram_bot_token: e.target.value }))} placeholder="123456:ABC..." />
          </div>
          <div className="space-y-1.5">
            <Label>Chat ID</Label>
            <Input value={form.telegram_chat_id} onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))} placeholder="Your Telegram chat ID" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate(form)} variant="outline">Save</Button>
            <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending} variant="secondary">
              {testMutation.isPending ? 'Sending…' : 'Test Connection'}
            </Button>
          </div>
          {testMsg && <p className="text-sm text-muted-foreground">{testMsg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Export Data</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {MODULES.map(m => (
              <Button key={m} variant="outline" size="sm" onClick={() => handleExport(m)}>
                Export {m}
              </Button>
            ))}
          </div>
          {exportStatus && <p className="text-sm text-muted-foreground mt-2">{exportStatus}</p>}
        </CardContent>
      </Card>
      </div>
      )}
    </div>
  )
}
