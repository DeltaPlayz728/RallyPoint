import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'
import { generateAssistantReply } from '@/lib/assistant'
import { requireMatchingUser } from '@/lib/sessionAuth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function getBotId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('is_bot', true)
    .maybeSingle()
  return data?.id ?? null
}

// Returns the dm_threads row between userId and the bot, creating it if needed.
// dm_threads enforces user_a < user_b, so the pair must always be sorted before insert/query.
async function getOrCreateBotThread(userId: string, botId: string) {
  const userA = userId < botId ? userId : botId
  const userB = userId < botId ? botId : userId

  const { data: existing } = await supabaseAdmin
    .from('dm_threads')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabaseAdmin
    .from('dm_threads')
    .insert({ user_a: userA, user_b: userB })
    .select('id')
    .single()

  if (error) throw error
  return created.id
}

// POST — send a message to the RallyPoint Assistant, get a reply
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(`assistant:${ip}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { userId, message } = await req.json()
  if (!userId || !message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }
  // userId must match the actual signed-in session — otherwise anyone could
  // read/send DMs in someone else's bot conversation just by knowing their id.
  if (!(await requireMatchingUser(req, userId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botId = await getBotId()
  if (!botId) {
    return NextResponse.json(
      { error: 'Assistant is not set up yet. Run the bot bootstrap route first.' },
      { status: 503 }
    )
  }

  let threadId: string
  try {
    threadId = await getOrCreateBotThread(userId, botId)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to start conversation' }, { status: 500 })
  }

  // Store the user's message
  const { error: userMsgError } = await supabaseAdmin.from('dm_messages').insert({
    thread_id: threadId,
    sender_id: userId,
    content: message.trim(),
  })
  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 })
  }

  // Pull recent history for context (last 10 messages, oldest first)
  const { data: recent } = await supabaseAdmin
    .from('dm_messages')
    .select('sender_id, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(10)

  const history = (recent ?? [])
    .reverse()
    .slice(0, -1) // drop the message we just inserted, it's passed separately
    .map((m) => ({
      role: (m.sender_id === botId ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content as string,
    }))

  const reply = await generateAssistantReply(message.trim(), history)

  const { data: botMsg, error: botMsgError } = await supabaseAdmin
    .from('dm_messages')
    .insert({ thread_id: threadId, sender_id: botId, content: reply })
    .select()
    .single()

  if (botMsgError) {
    return NextResponse.json({ error: botMsgError.message }, { status: 500 })
  }

  return NextResponse.json({ reply, threadId, message: botMsg })
}
