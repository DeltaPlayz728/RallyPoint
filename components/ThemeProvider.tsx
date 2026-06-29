'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// Personal app-wide accent color, independent of light/dark mode. Brand
// orange is the default — anyone who hasn't picked one sees exactly what
// they saw before this feature existed.
export type Accent = 'orange' | 'teal' | 'purple' | 'pink' | 'blue' | 'green'

export const ACCENT_PRESETS: { id: Accent; label: string; hex: string }[] = [
  { id: 'orange', label: 'Rally (default)', hex: '#f97316' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
]
const DEFAULT_ACCENT_HEX = ACCENT_PRESETS[0].hex

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
  accent: Accent
  setAccent: (accent: Accent) => void
}>({
  theme: 'light',
  toggleTheme: () => {},
  accent: 'orange',
  setAccent: () => {},
})

// Inline script injected into <head> so the `dark` class and --accent
// variable are applied before first paint — avoids a flash of the wrong
// theme/accent on every page load.
export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('rallypoint-theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    }
    var accents = ${JSON.stringify(
      ACCENT_PRESETS.reduce((acc, p) => ({ ...acc, [p.id]: p.hex }), {} as Record<string, string>)
    )};
    var storedAccent = localStorage.getItem('rallypoint-accent');
    var hex = accents[storedAccent] || '${DEFAULT_ACCENT_HEX}';
    document.documentElement.style.setProperty('--accent', hex);
  } catch (e) {}
})();
`

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [accent, setAccentState] = useState<Accent>('orange')

  useEffect(() => {
    const stored = localStorage.getItem('rallypoint-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    }
    const storedAccent = localStorage.getItem('rallypoint-accent') as Accent | null
    if (storedAccent && ACCENT_PRESETS.some(p => p.id === storedAccent)) {
      setAccentState(storedAccent)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const hex = ACCENT_PRESETS.find(p => p.id === accent)?.hex ?? DEFAULT_ACCENT_HEX
    document.documentElement.style.setProperty('--accent', hex)
  }, [accent])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('rallypoint-theme', next)
  }

  const setAccent = (next: Accent) => {
    setAccentState(next)
    localStorage.setItem('rallypoint-accent', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
