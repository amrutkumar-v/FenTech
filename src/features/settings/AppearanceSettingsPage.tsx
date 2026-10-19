import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { PageHeader, Card } from '@/ui/Card'
import { applyTheme, getThemePref, type ThemePref } from './theme'

const OPTIONS: { id: ThemePref; label: string; desc: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', desc: 'Always light, regardless of system setting.', icon: Sun },
  { id: 'dark', label: 'Dark', desc: 'Always dark — easier on the eyes at night.', icon: Moon },
  { id: 'system', label: 'System', desc: 'Follow this device light/dark preference automatically.', icon: Monitor },
]

export default function AppearanceSettingsPage() {
  const [pref, setPref] = useState<ThemePref>('system')

  useEffect(() => {
    setPref(getThemePref())
  }, [])

  function choose(p: ThemePref) {
    setPref(p)
    applyTheme(p)
  }

  return (
    <div>
      <PageHeader
        title="Appearance"
        subtitle="Theme preference is stored on this device only (SRS 8.3)."
      />
      <Card className="p-4">
        <fieldset>
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Theme</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {OPTIONS.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  pref === o.id
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-950'
                    : 'border-border-strong hover:bg-ink-50 dark:hover:bg-ink-900'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={o.id}
                  checked={pref === o.id}
                  onChange={() => choose(o.id)}
                  className="mt-1 size-3.5 accent-brand-600"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                    <o.icon className="size-4" aria-hidden />
                    {o.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-muted">{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
    </div>
  )
}
