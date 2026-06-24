// RallyPoint brand mark — "Sticker Badge" (Concept E from the brand board).
// Tilted, hand-felt circle with three converging dots meeting at a point —
// literal "rally point" + the playful, slightly-imperfect 2026 trend the
// brand board called out. Used as the temp logo across the app.
export default function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="RallyPoint"
    >
      <g transform="rotate(-8 60 60)">
        <circle cx="60" cy="60" r="46" fill="#fff7ec" stroke="#e4572e" strokeWidth="5" />
        <circle cx="44" cy="50" r="7" fill="#e4572e" />
        <circle cx="76" cy="50" r="7" fill="#3ad6c4" />
        <circle cx="60" cy="76" r="7" fill="#ffb454" />
        <path
          d="M44 50 L60 76 L76 50"
          stroke="#0d0d0d"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
