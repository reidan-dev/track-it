import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, testTelegram, exportModule } from '@/api/settings'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'SGD']
const THEMES = ['system', 'light', 'dark']
const MODULES = ['expenses', 'bills', 'installments', 'loans', 'income']

export default function Settings() {
  const qc = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => getSettings().then(r => r.data) })
  const [form, setForm] = useState({ currency: 'PHP', theme: 'system', telegram_bot_token: '', telegram_chat_id: '', telegram_enabled: false })
  const [testMsg, setTestMsg] = useState('')
  const [exportStatus, setExportStatus] = useState('')

  useEffect(() => {
    if (settings) {
      setForm({
        currency: settings.currency || 'PHP',
        theme: settings.theme || 'system',
        telegram_bot_token: settings.telegram_bot_token || '',
        telegram_chat_id: settings.telegram_chat_id || '',
        telegram_enabled: settings.telegram_enabled || false,
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
      <h1 className="text-2xl font-bold">Settings</h1>

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
  )
}
