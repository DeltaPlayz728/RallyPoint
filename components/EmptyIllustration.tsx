// Hand-felt illustration set for empty states — built to match Logo.tsx's
// "Sticker Badge" language (tilted circle, thick rounded ink strokes, the
// terracotta/teal/amber brand triad) instead of the generic Lucide-icon-in-a-
// tinted-circle pattern every AI-scaffolded app defaults to. Every variant
// shares the same tilted badge frame so the set reads as one considered
// system rather than five unrelated icons.
const INK = '#0d0d0d'
const CREAM = '#fff7ec'
const TERRACOTTA = '#e4572e'
const TEAL = '#3ad6c4'
const AMBER = '#ffb454'

type Variant = 'friends' | 'community' | 'caughtup' | 'events' | 'search'

function Badge({ rotate, children }: { rotate: number; children: React.ReactNode }) {
  return (
    <g transform={`rotate(${rotate} 60 60)`}>
      <circle cx="60" cy="60" r="46" fill={CREAM} stroke={TERRACOTTA} strokeWidth="5" />
      {children}
    </g>
  )
}

export default function EmptyIllustration({ variant, size = 96 }: { variant: Variant; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-hidden="true">
      {variant === 'friends' && (
        <Badge rotate={-6}>
          {/* Two people not yet rallied — dotted line waiting to connect, echoing
              the logo's converging-dots motif but "unfinished" on purpose. */}
          <circle cx="44" cy="54" r="10" fill={TERRACOTTA} />
          <circle cx="78" cy="60" r="8" fill={TEAL} />
          <path d="M54 54 L68 58" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" />
          <path d="M40 68 Q44 78 52 78" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M72 72 Q78 80 86 78" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </Badge>
      )}
      {variant === 'community' && (
        <Badge rotate={5}>
          {/* A little roof over three converging dots — "community" as a
              gathering place, not a generic people-outline icon. */}
          <path d="M40 66 L60 46 L80 66" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="48" cy="76" r="7" fill={TERRACOTTA} />
          <circle cx="72" cy="76" r="7" fill={TEAL} />
          <circle cx="60" cy="86" r="7" fill={AMBER} />
        </Badge>
      )}
      {variant === 'caughtup' && (
        <Badge rotate={-4}>
          {/* Hand-drawn check, slightly overshooting like a marker stroke —
              not a stock checkmark glyph. */}
          <path
            d="M40 62 L54 76 L82 44"
            stroke={TERRACOTTA}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Badge>
      )}
      {variant === 'events' && (
        <Badge rotate={6}>
          {/* A single pin with a soft ping ring — "ready for something to be
              dropped here" rather than a crossed-out calendar. */}
          <circle cx="60" cy="58" r="20" fill="none" stroke={TEAL} strokeWidth="3" opacity="0.5" />
          <path
            d="M60 40 C70 40 76 48 76 56 C76 66 60 82 60 82 C60 82 44 66 44 56 C44 48 50 40 60 40 Z"
            fill={TERRACOTTA}
          />
          <circle cx="60" cy="56" r="6" fill={CREAM} />
        </Badge>
      )}
      {variant === 'search' && (
        <Badge rotate={-5}>
          {/* Magnifying glass over an empty dotted pin outline. */}
          <circle cx="52" cy="52" r="14" fill="none" stroke={INK} strokeWidth="5" />
          <path d="M62 62 L76 76" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <circle cx="52" cy="52" r="5" fill={AMBER} />
        </Badge>
      )}
    </svg>
  )
}
