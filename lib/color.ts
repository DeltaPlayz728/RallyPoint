/**
 * Small color utilities for per-surface accent tinting (WhatsApp-style
 * "custom background" emulation — see RallyPoint_UIUX_Panel.md, WhatsApp
 * section: "keep it subtle and let it tint per community accent").
 */

/** App-wide default accent, matches --color-accent in globals.css. */
export const DEFAULT_ACCENT = '#f97316'

/**
 * Converts a hex color (#rgb or #rrggbb) to an "r, g, b" string usable inside
 * an rgba(...) CSS function. Falls back to a neutral gray if parsing fails,
 * so a bad/missing color never breaks the background render.
 */
export function hexToRgbTriplet(hex: string | null | undefined): string {
  if (!hex) return '128, 128, 128'
  let h = hex.trim().replace('#', '')
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return '128, 128, 128'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return '128, 128, 128'
  return `${r}, ${g}, ${b}`
}

/**
 * Builds the subtle dot-texture background (WhatsApp wallpaper emulation),
 * tinted to the given accent color at a low, unobtrusive alpha.
 */
export function dotTextureBackground(accentHex: string | null | undefined) {
  const triplet = hexToRgbTriplet(accentHex || DEFAULT_ACCENT)
  return {
    backgroundImage: `radial-gradient(rgba(${triplet}, 0.18) 1px, transparent 1px)`,
    backgroundSize: '22px 22px',
  }
}
