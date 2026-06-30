// ─── What's New / changelog ─────────────────────────────────────────────────
//
// This drives the Steam-style "What's New" popup that appears on the Feed the
// first time a user opens the app after a new release.
//
// HOW TO PUBLISH AN UPDATE:
//   1. Add a new entry to the TOP of RELEASES (newest first).
//   2. Bump CURRENT_VERSION to that entry's `version`.
// That's it — every user who hasn't seen this version yet gets the popup once,
// then it's marked as read (per-device, via localStorage).
//
// Keep `version` sortable/unique. The date-style "YYYY.MM.DD" works well, but
// any unique string is fine.

export const CURRENT_VERSION = '2026.06.30'

export type ChangeTag = 'New' | 'Update' | 'News'

export type ChangelogEntry = {
  tag: ChangeTag
  title: string
  description: string
}

export type Release = {
  version: string
  date: string // human-readable, shown in the popup header
  headline: string // short hook shown big at the top
  changes: ChangelogEntry[]
}

// Newest release first. The popup always shows RELEASES[0].
export const RELEASES: Release[] = [
  {
    version: '2026.06.30',
    date: 'June 30, 2026',
    headline: "What's new",
    changes: [
      {
        tag: 'New',
        title: 'Events is your home now',
        description:
          'Open the app and you land straight on the live feed — the move is always one tap away.',
      },
      {
        tag: 'Update',
        title: 'A whole new look',
        description:
          'Bolder cards, cleaner type, and soft background colour for a feed that actually feels alive.',
      },
      {
        tag: 'Update',
        title: 'Faster and smoother',
        description:
          'Tidied up the app end to end so everything loads quicker and feels snappier.',
      },
      {
        tag: 'News',
        title: 'Founding Member spots are open',
        description:
          'Early members get in first. Grab your spot from the welcome screen before they fill up.',
      },
    ],
  },
]
