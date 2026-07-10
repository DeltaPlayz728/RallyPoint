import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUserId } from '@/lib/sessionAuth'
import { isRateLimited } from '@/lib/rateLimit'
import { sendNotification } from '@/lib/notify'

// Server-side only. Service-role key: conversion writes (converted_at,
// reward_issued, referral_count, milestone rows) are deliberately excluded
// from the client-facing RLS policies on invite_tokens/referral_milestones —
// this route is the only place they're allowed to happen. See
// supabase/invite_tokens_schema.sql for the policy comments.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MILESTONES = [5, 25, 100]

// Successful-conversion counter, separate from the generic request-rate
// limiter below. Spec calls for "max 3 conversions per IP per 24h" as an
// abuse control — that's a cap on successes, not on attempts (a user
// mistyping/retrying a valid token shouldn't burn their own cap). In-memory
// like lib/rateLimit.ts; fine for MVP scale, resets on server restart.
const conversionsByIp = new Map<string, { count: number; resetAt: number }>()
const CONVERSIONS_PER_IP_LIMIT = 3
const CONVERSIONS_WINDOW_MS = 24 * 60 * 60 * 1000

function tooManyConversionsForIp(ip: string): boolean {
  const now = Date.now()
  const entry = conversionsByIp.get(ip)
  if (!entry || now > entry.resetAt) {
    conversionsByIp.set(ip, { count: 0, resetAt: now + CONVERSIONS_WINDOW_MS })
    return false
  }
  return entry.count >= CONVERSIONS_PER_IP_LIMIT
}

function recordConversionForIp(ip: string) {
  const entry = conversionsByIp.get(ip)
  if (entry) entry.count++
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'

  // Generic attempt throttle (brute-forcing token guesses etc.) — separate
  // from the success-based cap above.
  if (isRateLimited(`referral-convert-attempt:${ip}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const recipientId = await getSessionUserId(req)
  if (!recipientId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const token = body?.token
  const action = body?.action // 'signup' | 'join' — logged for future loop-phase telemetry, not branched on today
  if (!token || typeof token !== 'string' || (action !== 'signup' && action !== 'join')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (tooManyConversionsForIp(ip)) {
    return NextResponse.json({ error: 'Too many conversions from this network' }, { status: 429 })
  }

  const { data: inviteToken } = await supabaseAdmin
    .from('invite_tokens')
    .select('id, created_by, event_id, converted_at')
    .eq('token', token)
    .maybeSingle()

  if (!inviteToken) {
    return NextResponse.json({ error: 'Unknown token' }, { status: 404 })
  }

  // One conversion per token, ever.
  if (inviteToken.converted_at) {
    return NextResponse.json({ ok: true, alreadyConverted: true })
  }

  // Can't refer yourself — the most obvious self-credit path (share your own
  // link, "convert" on it from your own second account). A full IP+device
  // fingerprint cross-check (as the spec also calls for) isn't implemented —
  // no fingerprinting infra exists in this app yet — so this is the one
  // guard actually in place today; flagged as a follow-up.
  if (inviteToken.created_by === recipientId) {
    return NextResponse.json({ error: 'Cannot convert your own invite' }, { status: 403 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('invite_tokens')
    .update({ converted_at: new Date().toISOString() })
    .eq('id', inviteToken.id)
    .is('converted_at', null) // guards against a concurrent double-conversion race

  if (updateError) {
    return NextResponse.json({ error: 'Could not record conversion' }, { status: 500 })
  }

  recordConversionForIp(ip)

  // Atomic increment (see increment_referral_count in the schema file) —
  // avoids a read-then-write race if two of this referrer's invites convert
  // at the same moment.
  const { data: newCount } = await supabaseAdmin.rpc('increment_referral_count', {
    p_user_id: inviteToken.created_by,
  })

  if (typeof newCount === 'number') {
    const crossedMilestones = MILESTONES.filter(m => newCount >= m)
    for (const milestone of crossedMilestones) {
      // Unique(user_id, milestone) makes this idempotent even if this ever
      // runs concurrently for the same user — no cron needed for this part
      // (see schema file comment for the reasoning).
      await supabaseAdmin
        .from('referral_milestones')
        .upsert({ user_id: inviteToken.created_by, milestone }, { onConflict: 'user_id,milestone', ignoreDuplicates: true })
    }
  }

  const { data: recipientProfile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, username')
    .eq('id', recipientId)
    .maybeSingle()
  const friendName = recipientProfile?.username ? `@${recipientProfile.username}` : recipientProfile?.full_name ?? 'Someone'

  await sendNotification(supabaseAdmin, {
    userId: inviteToken.created_by,
    type: 'invite_converted',
    vars: { friend_name: friendName },
  })

  return NextResponse.json({ ok: true })
}
