import type { SupabaseClient } from '@supabase/supabase-js'

/** Ops guard (Master Plan/Game Plan §6/3.2): every cron writes a heartbeat row
 * on start and finish. A missing/stale heartbeat is how a silently-dead cron
 * gets noticed instead of just... not running for weeks. */

export async function startCronRun(client: SupabaseClient, job: string): Promise<string | null> {
  const { data } = await client.from('cron_runs').insert({ job }).select('id').single()
  return data?.id ?? null
}

export async function finishCronRun(client: SupabaseClient, runId: string | null, rowsAffected: number, error?: string) {
  if (!runId) return
  await client.from('cron_runs').update({
    finished_at: new Date().toISOString(),
    rows_affected: rowsAffected,
    error: error ?? null,
  }).eq('id', runId)
}
