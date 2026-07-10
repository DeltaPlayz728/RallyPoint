import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { startCronRun, finishCronRun } from '@/lib/cronHeartbeat'

// Daily cron (see vercel.json) — the ONLY place reputation_scores gets
// written (Master Plan §4: "recomputation runs in a daily cron only — never
// inline, so rapid micro-actions can't game it"). Rebuilds every user's
// score from the reputation_events ledger (itself only ever written by DB
// triggers, never app code — see the schema file) plus their current
// profile-completion/tenure state, which are continuous values rather than
// countable events so they're read fresh each run instead of ledgered.
//
// Normalization caps below are the tunable knobs — they're working numbers,
// not locked-in, same spirit as the take-rate/pricing numbers still open in
// the V2 execution plan.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEIGHTS = {
  attended: 0.25,
  positiveRating: 0.20,
  profileCompletion: 0.15,
  hosted: 0.15,
  tenure: 0.10,
  endorsements: 0.10,
}
const CAPS = {
  attended: 20,      // events attended to hit 100% of this signal
  positiveRating: 15,
  hosted: 10,
  tenureDays: 365,
  endorsements: 25,
}
const REPORTS_PENALTY_CAP = 5 // −5% max, per the master plan

function displayTier(score: number): string {
  if (score <= 20) return 'New Explorer'
  if (score <= 40) return 'Active Participant'
  if (score <= 60) return 'Trusted Member'
  if (score <= 80) return 'Community Anchor'
  return 'Platform Veteran'
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun(supabaseAdmin, 'reputation-recompute')
  try {
    const [{ data: profiles }, { data: events }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, created_at, full_name, bio, avatar_url, interests, city'),
      supabaseAdmin.from('reputation_events').select('user_id, signal_type'),
    ])

    const counts: Record<string, Record<string, number>> = {}
    for (const e of events ?? []) {
      counts[e.user_id] ??= {}
      counts[e.user_id][e.signal_type] = (counts[e.user_id][e.signal_type] ?? 0) + 1
    }

    const now = Date.now()
    let updated = 0

    for (const p of profiles ?? []) {
      const c = counts[p.id] ?? {}
      const attendedNorm = Math.min((c.event_attended ?? 0) / CAPS.attended, 1) * 100
      const ratingNorm = Math.min((c.positive_rating ?? 0) / CAPS.positiveRating, 1) * 100
      const hostedNorm = Math.min((c.event_hosted ?? 0) / CAPS.hosted, 1) * 100
      const endorsementsNorm = Math.min((c.endorsement_received ?? 0) / CAPS.endorsements, 1) * 100

      const tenureDays = p.created_at ? (now - new Date(p.created_at).getTime()) / 86_400_000 : 0
      const tenureNorm = Math.min(Math.max(tenureDays, 0) / CAPS.tenureDays, 1) * 100

      const filledFields = [p.full_name, p.bio, p.avatar_url, p.city, (p.interests?.length ?? 0) > 0]
      const profileCompletionNorm = (filledFields.filter(Boolean).length / filledFields.length) * 100

      const reportsPenalty = Math.min((c.report_upheld ?? 0) * 5, REPORTS_PENALTY_CAP)

      const rawScore =
        attendedNorm * WEIGHTS.attended +
        ratingNorm * WEIGHTS.positiveRating +
        profileCompletionNorm * WEIGHTS.profileCompletion +
        hostedNorm * WEIGHTS.hosted +
        tenureNorm * WEIGHTS.tenure +
        endorsementsNorm * WEIGHTS.endorsements -
        reportsPenalty

      const clamped = Math.max(0, Math.min(100, rawScore))

      const { error } = await supabaseAdmin.from('reputation_scores').upsert({
        user_id: p.id,
        raw_score: clamped,
        display_tier: displayTier(clamped),
        last_computed_at: new Date().toISOString(),
      })
      if (!error) updated++
    }

    await finishCronRun(supabaseAdmin, runId, updated)
    return NextResponse.json({ ok: true, updated })
  } catch (err: any) {
    await finishCronRun(supabaseAdmin, runId, 0, err?.message ?? 'unknown error')
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
