/**
 * Basic keyword-based content moderation.
 * Catches the most obvious harmful content without a paid API.
 * Upgrade to OpenAI moderation endpoint or Perspective API before scaling.
 */

// Words that trigger immediate hold for admin review
const FLAGGED_TERMS = [
  // Sexual / exploitation
  'sex', 'nude', 'naked', 'escort', 'onlyfans', 'porn',
  // Drugs
  'weed', 'cocaine', 'mdma', 'ecstasy', 'pills', 'ketamine',
  // Violence / weapons
  'gun', 'knife', 'weapon', 'fight',
  // Scam signals
  'free money', 'guaranteed', 'earn cash', 'whatsapp me', 'telegram me',
]

// Words that are always blocked outright (no review — immediate rejection)
const BLOCKED_TERMS = [
  'child', 'minor', 'underage', 'teen', '13 year', '14 year', '15 year',
]

type ModerationResult =
  | { allowed: true }
  | { allowed: false; action: 'block' | 'hold'; reason: string }

export function moderateContent(text: string): ModerationResult {
  const lower = text.toLowerCase()

  for (const term of BLOCKED_TERMS) {
    if (lower.includes(term)) {
      return {
        allowed: false,
        action: 'block',
        reason: `Content contains prohibited term: "${term}"`,
      }
    }
  }

  for (const term of FLAGGED_TERMS) {
    if (lower.includes(term)) {
      return {
        allowed: false,
        action: 'hold',
        reason: `Content flagged for review: "${term}"`,
      }
    }
  }

  return { allowed: true }
}

/** Check title + description together */
export function moderateEvent(title: string, description: string): ModerationResult {
  const combined = `${title} ${description}`
  return moderateContent(combined)
}
