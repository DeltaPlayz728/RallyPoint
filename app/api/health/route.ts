import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// No uptime monitoring existed for this app at all — if something breaks at
// 2am, the first signal was a user complaint. This is a minimal health
// check meant to be pointed at a free external monitor (UptimeRobot,
// Better Uptime, etc.): it does a real round-trip to Supabase rather than
// just returning 200 unconditionally, so it actually catches "the app is up
// but the database is unreachable" too.
export async function GET() {
  const start = Date.now()

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await supabase.from('profiles').select('id').limit(1)
    const latencyMs = Date.now() - start

    if (error) {
      return NextResponse.json(
        { status: 'error', database: 'unreachable', error: error.message, latencyMs },
        { status: 503 }
      )
    }

    return NextResponse.json({ status: 'ok', database: 'reachable', latencyMs })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: err instanceof Error ? err.message : 'unknown error' },
      { status: 503 }
    )
  }
}
