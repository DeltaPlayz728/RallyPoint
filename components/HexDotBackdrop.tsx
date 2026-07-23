'use client'

import { useTheme } from '@/components/ThemeProvider'

/**
 * Isometric-cube hex grid, drawn with actual hexagon geometry — not a flat
 * dot grid. Each hexagon is split into 3 facets by spokes from its center to
 * alternating vertices (the classic "isometric cubes" tiling), and every
 * edge/spoke is stroked as a dotted line whose brightness peaks at the
 * hexagon vertices and fades toward the midpoints — matching the reference
 * wallpaper where light seems to pool at each corner.
 *
 * Built as a single generated SVG (grid computed in JS, not hand-placed)
 * so it correctly tiles the full backdrop at any screen size via
 * preserveAspectRatio="xMidYMid slice".
 *
 * Dark mode was confirmed to look right as-is; light mode needed its own
 * pass — the same saturated colors read as a muddy pastel wash against
 * cream instead of popping the way they do against navy, so the underlying
 * solid lines go bolder/higher-opacity in light mode specifically.
 */
export default function HexDotBackdrop({ accent = '#f97316' }: { accent?: string }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const W = 480
  const H = 800
  const R = 58 // hex circumradius — bigger cells read clearly on a phone screen

  const hexW = R * Math.sqrt(3)
  const hexH = R * 1.5

  const cols = Math.ceil(W / hexW) + 2
  const rows = Math.ceil(H / hexH) + 2

  const lines: { x1: number; y1: number; x2: number; y2: number; kind: 'edge' | 'spoke' }[] = []

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const cx = hexW * (c + (r % 2 !== 0 ? 0.5 : 0))
      const cy = hexH * r
      const angles = [270, 330, 30, 90, 150, 210].map((d) => (d * Math.PI) / 180)
      const verts = angles.map((a) => ({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }))

      // Hexagon outline (all 6 edges — shared edges get drawn twice by
      // neighboring hexes, which just reads as a hair brighter, not broken).
      for (let i = 0; i < 6; i++) {
        const a = verts[i]
        const b = verts[(i + 1) % 6]
        lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind: 'edge' })
      }
      // 3 spokes from center to alternating vertices — the lines that make
      // each hex read as a cube rather than a flat hexagon.
      ;[0, 2, 4].forEach((i) => {
        lines.push({ x1: cx, y1: cy, x2: verts[i].x, y2: verts[i].y, kind: 'spoke' })
      })
    }
  }

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-[#fdf6ec] dark:bg-[#0d1524]" />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Edges use the accent color; spokes use a purple/pink mix — two
              tones instead of one flat hue, closer to the reference's
              varied palette and less "unfinished"-looking. Bright at the
              vertex end(s), faint mid-way/at center. */}
          <linearGradient id="hexEdgeGrad">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="50%" stopColor="#c026d3" stopOpacity="0.25" />
            <stop offset="100%" stopColor={accent} stopOpacity="1" />
          </linearGradient>
          <linearGradient id="hexSpokeGrad">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Straight solid lines — no dashes/dots. Every edge and spoke is
            one continuous stroke, colored via the same two-tone gradient
            (accent on edges, purple/pink on spokes) so it still reads as
            faceted/varied rather than a single flat hue. */}
        {lines.map((l, i) => (
          <line
            key={`line-${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.kind === 'edge' ? 'url(#hexEdgeGrad)' : 'url(#hexSpokeGrad)'}
            strokeWidth={isDark ? 1.75 : 2.25}
            strokeOpacity={isDark ? 0.65 : 0.8}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  )
}
