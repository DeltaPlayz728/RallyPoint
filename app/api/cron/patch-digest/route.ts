import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { startCronRun, finishCronRun } from '@/lib/cronHeartbeat'

// Weekly patch-note email digest (Pillar 10, Master Plan §11).
//
// This is a DORMANT scaffold: no email provider (Resend/Postmark/etc.) key
// is configured yet, so `deliverEmail()` below just logs what it would have
// sent instead of calling a provider API. When a key is added, replace the
// body of `deliverEmail()` with the real API call — everything upstream of
// it (recipient selection, opt-out respect, dedup window, heartbeat) is
// already correct and doesn't need to change.
//
// Respects `profiles.patch_email_opt_out` — this is the ONLY channel that
// setting controls; the critical in-app banner (CriticalPatchBanner.tsx)
// ignores it entirely, per spec.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deliverEmail(to: string, notes: { version: string; title: string; body_markdown: string; severity: string }[]) {
  // TODO: wire up a real provider once one is configured. Until then this is
  // a no-op that only logs, so the cron can be turned on early (heartbeat +
  // recipient logic gets exercised) without ever actually emailing anyone.
  console.log(`[patch-digest] would send digest to ${to} with ${notes.length} note(s)`)
  return true
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun(supabaseAdmin, 'patch-digest')
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()

    const { data: notes } = await supabaseAdmin
      .from('patch_notes')
      .select('version, title, body_markdown, severity, published_at')
      .eq('notify_email', true)
      .gte('published_at', since)
      .order('published_at', { ascending: false })

    if (!notes || notes.length === 0) {
      await finishCronRun(supabaseAdmin, runId, 0)
      return NextResponse.json({ ok: true, sent: 0, reason: 'no_notes_this_week' })
    }

    // profiles has no email column (email lives on auth.users), so opt-outs
    // are looked up as a set and cross-referenced against the auth admin
    // user list rather than joined in SQL.
    const { data: optedOutRows } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('patch_email_opt_out', true)
    const optedOut = new Set((optedOutRows ?? []).map(r => r.id))

    let sent = 0
    let page = 1
    const perPage = 200
    while (true) {
      const { data: page_data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error || !page_data || page_data.users.length === 0) break

      for (const u of page_data.users) {
        if (!u.email || optedOut.has(u.id)) continue
        const ok = await deliverEmail(u.email, notes)
        if (ok) sent++
      }

      if (page_data.users.length < perPage) break
      page++
    }

    await finishCronRun(supabaseAdmin, runId, sent)
    return NextResponse.json({ ok: true, sent, notesThisWeek: notes.length })
  } catch (err: any) {
    await finishCronRun(supabaseAdmin, runId, 0, err?.message ?? 'unknown error')
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
