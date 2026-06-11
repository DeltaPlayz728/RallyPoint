import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import https from 'https'
import { createClient } from '@supabase/supabase-js'

// SSL workaround for Windows dev only
const agent =
  process.env.NODE_ENV !== 'production'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  ...(agent ? { httpAgent: agent } : {}),
})

// Service role client — bypasses RLS for trusted server-side writes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    // ✅ Cryptographic signature check — rejects any request not from Stripe
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  // ── Handle events ────────────────────────────────────────────────────────────

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { eventId, userId } = session.metadata ?? {}

    if (!eventId || !userId) {
      console.error('Webhook: missing metadata', session.metadata)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    // Add attendee
    const { error: attendeeError } = await supabaseAdmin
      .from('event_attendees')
      .upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id' })

    if (attendeeError) {
      console.error('Webhook: failed to add attendee', attendeeError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Ensure chat room exists
    await supabaseAdmin
      .from('event_chats')
      .upsert({ event_id: eventId }, { onConflict: 'event_id' })

    // Record payment
    await supabaseAdmin.from('payments').insert({
      user_id: userId,
      event_id: eventId,
      stripe_session_id: session.id,
      amount: (session.amount_total ?? 0) / 100,
      currency: session.currency ?? 'eur',
      status: 'paid',
    })

    console.log(`Webhook: payment confirmed — user ${userId} joined event ${eventId}`)
  }

  return NextResponse.json({ received: true })
}
