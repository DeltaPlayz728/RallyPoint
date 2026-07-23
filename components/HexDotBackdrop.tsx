'use client'

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
 */
export default function HexDotBackdrop({ accent = '#f97316' }: { accent?: string }) {
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
          {/* Bright at both ends, faint mid-way — hexagon edges converge
              brightly at shared vertices in the reference image. */}
          <linearGradient id="hexEdgeGrad">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accent} stopOpacity="1" />
          </linearGradient>
          {/* Faint at center, bright at the vertex end. */}
          <linearGradient id="hexSpokeGrad">
            <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accent} stopOpacity="1" />
          </linearGradient>
        </defs>
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.kind === 'edge' ? 'url(#hexEdgeGrad)' : 'url(#hexSpokeGrad)'}
            strokeWidth={3.5}
            strokeLinecap="round"
            /* Near-zero dash length + round cap draws actual circular
               dots (not hairline dashes) spaced along each line — this is
               what was too thin to see before. */
            strokeDasharray="0.01 6"
          />
        ))}
      </svg>
    </div>
  )
}
