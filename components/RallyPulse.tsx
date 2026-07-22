'use client'

import { useEffect } from 'react'

// Signature "Rally Pulse" — three dots converging to a point (the same
// gesture as Logo.tsx's mark: three colored dots meeting where paths cross)
// with a soft expanding ring behind them. Played once, briefly, the moment
// someone actually commits to "Going" on an event — this is the one motion
// in the whole app that's ownably RallyPoint's rather than a generic
// checkmark tick or confetti burst borrowed from every other app.
const DOTS = [
  { color: '#e4572e', dx: -26, dy: -18 },
  { color: '#3ad6c4', dx: 26, dy: -18 },
  { color: '#ffb454', dx: 0, dy: 26 },
]

export default function RallyPulse({ show, onDone }: { show: boolean; onDone?: () => void }) {
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => onDone?.(), 650)
    return () => clearTimeout(t)
  }, [show, onDone])

  if (!show) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 rounded-full border-2 border-accent rally-pulse-ring" />
        {DOTS.map((d, i) => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full rally-pulse-dot"
            style={{
              backgroundColor: d.color,
              left: '50%',
              top: '50%',
              marginLeft: '-5px',
              marginTop: '-5px',
              ['--dx0' as string]: `${d.dx}px`,
              ['--dy0' as string]: `${d.dy}px`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
