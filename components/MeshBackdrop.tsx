'use client'

/**
 * Low-poly "mesh gradient" backdrop — actual faceted triangles (via
 * clip-path), each filled with its own mini gradient so it reads as lit
 * from one direction, the way real gradient-mesh wallpapers do. Replaces
 * a dead-flat single-color page background on screens with a lot of
 * empty space (Events tab was the first complaint).
 *
 * This is the "turn it up" pass — the first version was blurred pastel
 * blobs at ~20% opacity and read as barely-there. This version keeps the
 * same brand palette (accent + purple/rose/teal) but as bold, visible
 * facets like the reference wallpaper, while still sitting at z-0 behind
 * every card/panel in the app (which are all opaque), so text and content
 * are never actually behind it.
 *
 * `accent` lets a page tint the mesh toward a community/profile color
 * (same idea as the chat wallpaper tinting in lib/color.ts) — defaults to
 * the app's own orange accent.
 */
export default function MeshBackdrop({ accent = '#f97316' }: { accent?: string }) {
  // Each facet is a triangle (clip-path polygon, in viewport %) filled with
  // its own two-tone gradient for a faceted "light hits it from one side"
  // look instead of a flat color wedge.
  const facets: { clipPath: string; gradient: string; opacity: number; darkOpacity: number }[] = [
    {
      clipPath: 'polygon(0% 0%, 55% 0%, 20% 40%)',
      gradient: `linear-gradient(135deg, ${accent}, #fb923c)`,
      opacity: 0.55,
      darkOpacity: 0.4,
    },
    {
      clipPath: 'polygon(55% 0%, 100% 0%, 100% 35%, 20% 40%)',
      gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      opacity: 0.5,
      darkOpacity: 0.36,
    },
    {
      clipPath: 'polygon(100% 35%, 100% 70%, 45% 55%, 20% 40%)',
      gradient: 'linear-gradient(160deg, #e11d48, #fb7185)',
      opacity: 0.45,
      darkOpacity: 0.32,
    },
    {
      clipPath: 'polygon(0% 40%, 20% 40%, 45% 55%, 15% 100%, 0% 100%)',
      gradient: `linear-gradient(160deg, ${accent}, #7c3aed)`,
      opacity: 0.4,
      darkOpacity: 0.28,
    },
    {
      clipPath: 'polygon(45% 55%, 100% 70%, 100% 100%, 15% 100%)',
      gradient: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
      opacity: 0.4,
      darkOpacity: 0.28,
    },
    {
      clipPath: 'polygon(100% 70%, 100% 100%, 60% 100%)',
      gradient: 'linear-gradient(135deg, #a855f7, #e11d48)',
      opacity: 0.35,
      darkOpacity: 0.24,
    },
  ]

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Warm page base underneath the facets, so gaps between triangles
          (and the dark-mode blend) still land on-brand. */}
      <div className="absolute inset-0 bg-[#fdf6ec] dark:bg-[#15110d]" />

      {facets.map((f, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            clipPath: f.clipPath,
            backgroundImage: f.gradient,
            opacity: f.opacity,
          }}
        />
      ))}
      {/* Dark-mode opacities are lower (facets would otherwise blow out a
          dark page) — layered as a second pass that only shows in dark. */}
      <div className="absolute inset-0 hidden dark:block bg-[#15110d]/45" />

      {/* Soft blur pass on top of the hard facet edges — keeps the "faceted"
          read but takes the harshness off the seams so it doesn't look like
          clip-art. */}
      <div className="absolute inset-0 backdrop-blur-2xl" />

      {/* Same dot texture used on chat surfaces, so the whole app shares one
          "material" language instead of flat color vs. dotted chat feeling
          like two different apps. */}
      <div
        className="absolute inset-0 opacity-[0.25] dark:opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />
    </div>
  )
}
