'use client'

/**
 * Low-poly gradient backdrop — sharp-edged triangular facets (SVG polygons,
 * not blurred blobs) plus one soft diagonal seam/crease, matching the
 * faceted-crystal reference wallpaper directly rather than approximating it
 * with blurred circles. Colors are the app's purple/magenta/red/orange
 * family so it stays on-brand; `accent` swaps in for the top facet so a
 * community/profile color still shows through.
 *
 * Rendered as one SVG with preserveAspectRatio="xMidYMid slice" so it always
 * fully covers the viewport (cropping overflow) regardless of screen size,
 * the same way a CSS `background-size: cover` image would.
 */
export default function MeshBackdrop({ accent = '#f97316' }: { accent?: string }) {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg
        className="w-full h-full"
        viewBox="0 0 100 175"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Base fill so any hairline gaps between polygons land on-brand. */}
        <rect x="0" y="0" width="100" height="175" fill={accent} opacity="0.9" />

        <polygon points="0,0 62,0 22,46" fill={accent} />
        <polygon points="0,0 20,0 0,18" fill="#c4b5fd" opacity="0.55" />
        <polygon points="62,0 100,0 100,40 22,46" fill="#7c3aed" />
        <polygon points="100,40 100,78 50,62 22,46" fill="#be185d" />
        <polygon points="100,78 100,120 68,102 50,62" fill="#dc2626" />
        <polygon points="0,46 22,46 50,62 48,110 16,120 0,110" fill="#a21caf" />
        <polygon points="50,62 68,102 45,120 48,110" fill="#ea580c" />
        <polygon points="0,110 16,120 48,110 45,120 20,175 0,175" fill="#7c3aed" />
        <polygon points="48,110 45,120 68,102 100,120 100,175 55,175 20,175" fill="#be185d" />
        <polygon points="68,102 100,78 100,120" fill="#f97316" opacity="0.85" />

        {/* Diagonal crease — a translucent dark band crossing the whole
            canvas, softened, the way a real faceted wallpaper reads as
            "folded" along one seam. */}
        <polygon
          points="12,30 30,20 88,95 70,108"
          fill="#000000"
          opacity="0.28"
          style={{ filter: 'blur(6px)' }}
        />
      </svg>

      {/* Same dot texture used on chat surfaces, kept faint, so the whole
          app shares one "material" language. */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
    </div>
  )
}
