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

    // Subscription checkout (Phase 6 — Go Getter / Extrovert / Planner) is a
    // separate flow from the one-off paid-event ticket checkout below; tell
    // them apart by session.mode rather than by which metadata keys exist.
    if (session.mode === 'subscription') {
      const { userId, tier } = session.metadata ?? {}
      if (!userId || !tier) {
        console.error('Webhook: subscription checkout missing metadata', session.metadata)
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
      }

      const { error: subError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_status: 'active',
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
          stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
        })
        .eq('id', userId)

      if (subError) {
        console.error('Webhook: failed to activate subscription', subError)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }

      console.log(`Webhook: subscription activated — user ${userId} → ${tier}`)
      return NextResponse.json({ received: true })
    }

    // Paid-event ticket checkout (Phase 7)
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

  // Subscription renewed, payment failed, plan changed, etc. — keep our
  // cached tier/status in sync without waiting for the user to reopen the app.
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const tier = sub.metadata?.tier
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

    if (!customerId) {
      console.error('Webhook: subscription.updated missing customer id')
      return NextResponse.json({ received: true })
    }

    const status = sub.status === 'active' ? 'active'
      : sub.status === 'past_due' ? 'past_due'
      : sub.status === 'canceled' ? 'canceled'
      : 'incomplete'

    const update: Record<string, unknown> = {
      subscription_status: status,
      stripe_subscription_id: sub.id,
    }
    if (tier) update.subscription_tier = tier

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(update)
      .eq('stripe_customer_id', customerId)

    if (updateError) {
      console.error('Webhook: failed to sync subscription update', updateError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }

  // Cancellation — drop back to free so gated features close immediately.
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

    if (customerId) {
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_tier: 'free', subscription_status: 'canceled' })
        .eq('stripe_customer_id', customerId)
    }
  }

  return NextResponse.json({ received: true })
}
