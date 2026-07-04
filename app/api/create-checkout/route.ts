import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import https from 'https'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'
import { requireMatchingUser } from '@/lib/sessionAuth'

// SSL workaround for Windows dev only — never runs in production
const agent =
  process.env.NODE_ENV !== 'production'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  ...(agent ? { httpAgent: agent } : {}),
})

// Service role — needed to read the authoritative event price server-side.
// The client must never be trusted to tell us how much to charge.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  // Rate limit: 10 checkout attempts per IP per hour
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(`checkout:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { eventId, userId } = await req.json()
    if (!eventId || !userId) {
      return NextResponse.json({ error: 'Missing eventId or userId' }, { status: 400 })
    }
    // userId must match the signed-in session — the webhook trusts this
    // metadata to decide which account gets added as an attendee, so it must
    // be the caller's own id, not an arbitrary one from the body.
    if (!(await requireMatchingUser(req, userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up the event's real price and title ourselves — previously this
    // route trusted a client-supplied `price` field directly, which let
    // anyone tamper with the checkout request (devtools/curl) to pay less
    // than the actual ticket price for a paid event.
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('title, price, status')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (event.status !== 'active') {
      return NextResponse.json({ error: 'Event is not active' }, { status: 409 })
    }
    if (!event.price || event.price <= 0) {
      return NextResponse.json({ error: 'Event is not a paid event' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: event.title,
              description: 'RallyPoint event ticket',
            },
            unit_amount: Math.round(event.price * 100), // cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        eventId,
        userId,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}?payment=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
