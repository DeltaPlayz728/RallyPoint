import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BOT_EMAIL = 'assistant@rallypoint.app'

// One-time setup: creates the RallyPoint Assistant auth user + profile.
// Protected by ADMIN_SETUP_SECRET — call once, then you can ignore this route.
// GET /api/admin/bot?secret=YOUR_SECRET
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.ADMIN_SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Already exists?
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, username')
    .eq('is_bot', true)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ message: 'Bot already exists', profile: existing })
  }

  // Create the auth user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: BOT_EMAIL,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { is_bot: true },
  })

  if (userError || !userData.user) {
    return NextResponse.json({ error: userError?.message ?? 'Failed to create bot user' }, { status: 500 })
  }

  const botId = userData.user.id

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: botId,
    full_name: 'RallyPoint Assistant',
    username: 'rallypoint',
    is_bot: true,
    date_of_birth: '2000-01-01',
    is_minor: false,
  })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Bot created', botId })
}
