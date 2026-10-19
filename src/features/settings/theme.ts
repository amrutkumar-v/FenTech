/** Theme handling: light / dark / system. Stored in localStorage. */
export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'fms.theme'

export function applyStoredTheme(): void {
  const pref = (localStorage.getItem(KEY) as ThemePref | null) ?? 'system'
  applyTheme(pref)
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = pref === 'dark' || (pref === 'system' && prefersDark)
  root.classList.toggle('dark', dark)
  localStorage.setItem(KEY, pref)
}

export function getThemePref(): ThemePref {
  return (localStorage.getItem(KEY) as ThemePref | null) ?? 'system'
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const pref = getThemePref()
  if (pref === 'system') applyTheme('system')
})
