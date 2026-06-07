import { useState, useEffect } from 'react'
import { HelpTip } from '@/components/shared/HelpTip'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, testTelegram, connectTelegram, disconnectTelegram, testReminder, exportModule } from '@/api/settings'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { cn } from '@/lib/utils'
import People from '@/pages/People'
import PaymentMethods from '@/pages/PaymentMethods'
import { SecuritySettings } from '@/components/shared/SecuritySettings'

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'SGD']
const THEMES = ['system', 'light', 'dark']
const PALETTES = [
  { id: 'blue', label: 'Blue', color: 'hsl(221 83% 53%)' },
  { id: 'emerald', label: 'Emerald', color: 'hsl(160 84% 39%)' },
  { id: 'violet', label: 'Violet', color: 'hsl(262 83% 58%)' },
  { id: 'rose', label: 'Rose', color: 'hsl(347 77% 50%)' },
  { id: 'amber', label: 'Amber', color: 'hsl(38 92% 50%)' },
  { id: 'cyan', label: 'Cyan', color: 'hsl(192 91% 42%)' },
]

function applyPalette(p) {
  const el = document.documentElement
  el.className = el.className.replace(/\bpalette-\S+/g, '').replace(/\s+/g, ' ').trim()
  if (p && p !== 'blue') el.classList.add('palette-' + p)
  localStorage.setItem('palette', p)
}
const MODULES = ['expenses', 'bills', 'installments', 'loans', 'income']
const TABS = [
  { id: 'general', label: 'General' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'security', label: 'Security' },
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
  const [form, setForm] = useState({ currency: 'PHP', theme: 'system', palette: 'blue', telegram_bot_token: '', telegram_chat_id: '', telegram_enabled: false, ...REMINDER_DEFAULTS })
  const [testMsg, setTestMsg] = useState('')
  const [reminderMsg, setReminderMsg] = useState('')
  const [exportStatus, setExportStatus] = useState('')

  useEffect(() => {
    if (settings) {
      setForm({
        currency: settings.currency || 'PHP',
        theme: settings.theme || 'system',
        palette: settings.palette || 'blue',
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
        digest_enabled: settings.digest_enabled || false,
        digest_frequency: settings.digest_frequency || 'daily',
        digest_time: settings.digest_time || '08:00',
        digest_weekday: settings.digest_weekday ?? 0,
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
      applyPalette(data.data.palette || form.palette)
    },
  })

  const testMutation = useMutation({
    mutationFn: testTelegram,
    onSuccess: () => setTestMsg('Test message sent!'),
    onError: () => setTestMsg('Failed to send. Check your token and chat ID.'),
  })

  const [botMsg, setBotMsg] = useState('')
  const [botLink, setBotLink] = useState('')
  const connectMutation = useMutation({
    mutationFn: connectTelegram,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setBotLink(res.data?.deep_link || '')
      setBotMsg(res.data?.message || 'Bot connected.')
    },
    onError: (err) => setBotMsg(err.response?.data?.detail || 'Connect failed. Save a valid bot token first.'),
  })
  const disconnectMutation = useMutation({
    mutationFn: disconnectTelegram,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setBotLink(''); setBotMsg('Bot disconnected.') },
    onError: () => setBotMsg('Disconnect failed.'),
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

      <div className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors whitespace-nowrap shrink-0',
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
      {tab === 'security' && <SecuritySettings />}

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
          <div className="space-y-1.5">
            <Label>Color palette</Label>
            <div className="flex flex-wrap gap-2.5 pt-1">
              {PALETTES.map(p => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={form.palette === p.id}
                  onClick={() => { setForm(f => ({ ...f, palette: p.id })); applyPalette(p.id) }}
                  className={cn(
                    'w-8 h-8 rounded-full ring-offset-2 ring-offset-background transition-transform active:scale-95',
                    form.palette === p.id ? 'ring-2 ring-foreground scale-110' : 'ring-1 ring-border'
                  )}
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Tap to preview; Save to keep it across devices.</p>
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

          {/* ── Interactive bot (F10) ─────────────────────────────────── */}
          <div className="border-t pt-4 space-y-2">
            <Label>Interactive bot</Label>
            <p className="text-sm text-muted-foreground">
              Connect to send commands <em>to</em> the bot — add expenses, mark bills paid, check balances right from Telegram.
              Save your bot token first, then Connect and tap <strong>Start</strong> in the chat to link it (auto-fills your Chat ID).
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} variant="secondary">
                {connectMutation.isPending ? 'Connecting…' : (settings?.telegram_enabled ? 'Reconnect Bot' : 'Connect Bot')}
              </Button>
              {settings?.telegram_enabled && (
                <Button onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} variant="ghost">
                  Disconnect
                </Button>
              )}
            </div>
            {botLink && (
              <p className="text-sm">
                Open your bot: <a href={botLink} target="_blank" rel="noreferrer" className="text-primary underline">{botLink}</a>
              </p>
            )}
            {botMsg && <p className="text-sm text-muted-foreground">{botMsg}</p>}
          </div>

          {/* ── Digest (F6) ───────────────────────────────────────────── */}
          <div className="border-t pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.digest_enabled}
                onChange={e => setForm(f => ({ ...f, digest_enabled: e.target.checked }))} />
              Spending digest
            </label>
            <p className="text-sm text-muted-foreground">A scheduled summary of spending, top categories and what's due soon, with quick action buttons.</p>
            {form.digest_enabled && (
              <div className="flex gap-3 flex-wrap items-end">
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={form.digest_frequency} onChange={e => setForm(f => ({ ...f, digest_frequency: e.target.value }))}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </Select>
                </div>
                {form.digest_frequency === 'weekly' && (
                  <div className="space-y-1.5">
                    <Label>Day</Label>
                    <Select value={form.digest_weekday} onChange={e => setForm(f => ({ ...f, digest_weekday: Number(e.target.value) }))}>
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <Input type="time" value={form.digest_time} onChange={e => setForm(f => ({ ...f, digest_time: e.target.value }))} className="w-32" />
                </div>
              </div>
            )}
            <Button onClick={() => saveMutation.mutate(form)} variant="outline" size="sm">Save digest</Button>
          </div>
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
