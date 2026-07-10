// Share/referral engine (V2 Pillar 1). See RallyPoint_V2_Master_Plan_RECONCILED.md §2
// and RallyPoint_V2_EXECUTION_PLAN.md for the spec this implements.
//
// Flow: mintReferralLink() mints an invite_tokens row (client-side insert,
// RLS-scoped to auth.uid() = created_by) and returns a shareable URL with
// ?ref=<token>. captureReferralFromUrl() runs on landing and stores that
// token in localStorage with a 30-day TTL (last-click-wins — a fresh ?ref=
// always overwrites whatever was stored). The actual conversion write
// (converted_at, referral_count++, milestone badges) happens server-side via
// /api/referral/convert — never from the client, per the spec's abuse-control
// requirement.

import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'rp_ref_token'
const STORAGE_TS_KEY = 'rp_ref_stored_at'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const appUrl = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'https://rally-point-eb1q.vercel.app')

/**
 * Call once on app load (mounted in root layout). Reads ?ref=<token> off the
 * current URL and stores it, overwriting any previously stored token
 * (last-click-wins, matches the spec).
 */
export function captureReferralFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (!ref) return
    localStorage.setItem(STORAGE_KEY, ref)
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()))
  } catch {
    // localStorage unavailable — referral just doesn't get attributed, non-fatal
  }
}

/** Returns the stored referral token if it exists and hasn't passed its 30-day TTL. */
export function getStoredReferralToken(): string | null {
  try {
    const token = localStorage.getItem(STORAGE_KEY)
    const storedAt = Number(localStorage.getItem(STORAGE_TS_KEY) ?? 0)
    if (!token || !storedAt) return null
    if (Date.now() - storedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_TS_KEY)
      return null
    }
    return token
  } catch {
    return null
  }
}

export function clearStoredReferralToken() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_TS_KEY)
  } catch {
    // ignore
  }
}

/**
 * Call after a meaningful action (account creation or event join) to report
 * a pending referral conversion, if one is stored. No-op if there's nothing
 * stored. Safe to call unconditionally — swallows errors so a referral hiccup
 * never blocks the actual signup/join flow it's piggybacking on.
 */
export async function reportConversionIfPending(action: 'signup' | 'join') {
  const token = getStoredReferralToken()
  if (!token) return
  try {
    const res = await fetch('/api/referral/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action }),
    })
    if (res.ok) clearStoredReferralToken()
  } catch {
    // Network hiccup — leave the token stored, it's still within its 30-day
    // TTL and a later action (e.g. joining an event after signing up) will
    // retry it.
  }
}

/**
 * Mints a new invite_tokens row attributed to the current user and returns a
 * shareable URL carrying it. Pass eventId when sharing a specific event (the
 * link points at the public /e/[id] teaser); omit it for a general referral
 * link (points at the homepage).
 */
export async function mintReferralLink(opts?: { eventId?: string }): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const token = crypto.randomUUID()

  const { error } = await supabase.from('invite_tokens').insert({
    created_by: user.id,
    event_id: opts?.eventId ?? null,
    token,
  })
  if (error) return null

  const destination = opts?.eventId ? `/e/${opts.eventId}` : '/'
  return `${appUrl}${destination}?ref=${token}`
}
