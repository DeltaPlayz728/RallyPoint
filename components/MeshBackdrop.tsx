'use client'

/**
 * Toned-down "mesh gradient" backdrop — a subtle, faceted wash of soft color
 * blobs behind page content, meant to replace a dead-flat single-color page
 * background on screens with a lot of empty space (Events tab was the first
 * complaint, but this is meant to be reused anywhere that looks flat).
 *
 * Inspired by low-poly gradient-mesh wallpapers, but pulled way back in
 * saturation/opacity so it reads as depth/texture rather than a loud
 * wallpaper — text and cards on top stay fully legible. Renders as a fixed,
 * pointer-events-none layer so it never intercepts clicks or scrolls with
 * content.
 *
 * `accent` lets a page tint the wash toward a community/profile color
 * (same idea as the chat wallpaper tinting in lib/color.ts) — defaults to
 * the app's own orange accent.
 */
export default function MeshBackdrop({ accent = '#f97316' }: { accent?: string }) {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Faint directional wash — gives the flat page a light source instead
          of looking like a solid fill. */}
      <div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.09]"
        style={{
          backgroundImage: `linear-gradient(135deg, ${accent} 0%, transparent 45%, transparent 60%, #7c3aed 100%)`,
        }}
      />

      {/* Large soft blobs, heavily blurred — the "facets" of the mesh, minus
          the hard edges, so they still feel 3D/layered without competing
          with cards. Sizes/positions vary so no two screens read identical. */}
      <div
        className="absolute -top-24 -left-20 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-30 dark:opacity-20"
        style={{ background: accent }}
      />
      <div
        className="absolute top-[38%] -right-28 w-96 h-96 rounded-full blur-3xl opacity-25 dark:opacity-[0.18]"
        style={{ background: '#7c3aed' }}
      />
      <div
        className="absolute -bottom-28 left-[8%] w-[22rem] h-[22rem] rounded-full blur-3xl opacity-25 dark:opacity-[0.16]"
        style={{ background: '#e11d48' }}
      />
      <div
        className="absolute bottom-[10%] right-[18%] w-56 h-56 rounded-full blur-3xl opacity-20 dark:opacity-[0.14]"
        style={{ background: '#14b8a6' }}
      />

      {/* Same subtle dot texture used on chat surfaces, kept very sparse, so
          the whole app shares one "material" language instead of flat color
          vs. dotted chat feeling like two different apps. */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.5]"
        style={{
          backgroundImage: 'radial-gradient(rgba(128,128,128,0.15) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />
    </div>
  )
}
