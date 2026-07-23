'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// Personal app-wide accent color, independent of light/dark mode. Brand
// orange is the default — anyone who hasn't picked one sees exactly what
// they saw before this feature existed.
export type Accent = 'orange' | 'teal' | 'purple' | 'pink' | 'blue' | 'green'

// Hand-mixed, not stock Tailwind swatches — "Rally" is the exact terracotta
// from the brand mark (Logo.tsx's stroke color), and every other option is
// shifted off its raw Tailwind default (teal-500, purple-500, etc.) toward
// something a little dustier/warmer so the whole picker reads as chosen
// rather than defaulted.
export const ACCENT_PRESETS: { id: Accent; label: string; hex: string }[] = [
  { id: 'orange', label: 'Rally (default)', hex: '#e4572e' },
  { id: 'teal', label: 'Lagoon', hex: '#1fa39a' },
  { id: 'purple', label: 'Plum', hex: '#7c4585' },
  { id: 'pink', label: 'Rose', hex: '#d6456c' },
  { id: 'blue', label: 'Harbor', hex: '#2c6e9b' },
  { id: 'green', label: 'Moss', hex: '#4c7a52' },
]
const DEFAULT_ACCENT_HEX = ACCENT_PRESETS[0].hex

// "Background style" — what renders behind pages instead of a flat single
// color fill. Lives here (not a per-page Supabase fetch) so switching is
// instant and works logged-out, and can reuse the accent hex above to tint
// the mesh/dots to whatever the user already picked.
//   - flat   — the original page fill (soft pastel bubbles)
//   - mesh   — low-poly gradient facets, see components/MeshBackdrop.tsx
//   - dots   — just the dot texture, no color wash
//   - custom — a user-uploaded photo (customBackgroundUrl)
export type BackgroundStyle = 'flat' | 'mesh' | 'dots' | 'custom'

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
  accent: Accent
  setAccent: (accent: Accent) => void
  accentHex: string
  backgroundStyle: BackgroundStyle
  setBackgroundStyle: (style: BackgroundStyle) => void
  customBackgroundUrl: string | null
  setCustomBackgroundUrl: (url: string | null) => void
}>({
  theme: 'light',
  toggleTheme: () => {},
  accent: 'orange',
  setAccent: () => {},
  accentHex: DEFAULT_ACCENT_HEX,
  backgroundStyle: 'mesh',
  setBackgroundStyle: () => {},
  customBackgroundUrl: null,
  setCustomBackgroundUrl: () => {},
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
  const [backgroundStyle, setBackgroundStyleState] = useState<BackgroundStyle>('mesh')
  const [customBackgroundUrl, setCustomBackgroundUrlState] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('rallypoint-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    }
    const storedAccent = localStorage.getItem('rallypoint-accent') as Accent | null
    if (storedAccent && ACCENT_PRESETS.some(p => p.id === storedAccent)) {
      setAccentState(storedAccent)
    }
    const storedBg = localStorage.getItem('rallypoint-background-style') as BackgroundStyle | null
    if (storedBg === 'flat' || storedBg === 'mesh' || storedBg === 'dots' || storedBg === 'custom') {
      setBackgroundStyleState(storedBg)
    }
    const storedCustomUrl = localStorage.getItem('rallypoint-custom-bg-url')
    if (storedCustomUrl) setCustomBackgroundUrlState(storedCustomUrl)
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

  const setBackgroundStyle = (next: BackgroundStyle) => {
    setBackgroundStyleState(next)
    localStorage.setItem('rallypoint-background-style', next)
  }

  const setCustomBackgroundUrl = (url: string | null) => {
    setCustomBackgroundUrlState(url)
    if (url) localStorage.setItem('rallypoint-custom-bg-url', url)
    else localStorage.removeItem('rallypoint-custom-bg-url')
  }

  const accentHex = ACCENT_PRESETS.find(p => p.id === accent)?.hex ?? DEFAULT_ACCENT_HEX

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme, accent, setAccent, accentHex,
      backgroundStyle, setBackgroundStyle, customBackgroundUrl, setCustomBackgroundUrl,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
