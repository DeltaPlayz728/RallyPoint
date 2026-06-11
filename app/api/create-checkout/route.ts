import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import https from 'https'
import { isRateLimited } from '@/lib/rateLimit'

// SSL workaround for Windows dev only — never runs in production
const agent =
  process.env.NODE_ENV !== 'production'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  ...(agent ? { httpAgent: agent } : {}),
})

export async function POST(req: NextRequest) {
  // Rate limit: 10 checkout attempts per IP per hour
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(`checkout:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { eventId, eventTitle, price, userId } = await req.json()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: eventTitle,
              description: 'RallyPoint event ticket',
            },
            unit_amount: price * 100, // cents
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
