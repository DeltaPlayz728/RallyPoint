import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import https from 'https'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rateLimit'
import { TIER_PRICE_ENV, SubscriptionTier } from '@/lib/subscription'
import { requireMatchingUser } from '@/lib/sessionAuth'

// SSL workaround for Windows dev only — never runs in production
const agent =
  process.env.NODE_ENV !== 'production'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  ...(agent ? { httpAgent: agent } : {}),
})

// Service role — needed to read/write the authoritative profile server-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  // Rate limit: 10 checkout attempts per IP per hour
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(`sub-checkout:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { userId, tier } = await req.json()

    if (!userId || !tier) {
      return NextResponse.json({ error: 'Missing userId or tier' }, { status: 400 })
    }
    if (tier === 'free' || !(tier in TIER_PRICE_ENV)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }
    // userId must match the signed-in session — otherwise the checkout (and the
    // resulting subscription/customer binding via metadata) could be attributed
    // to, or attached onto, another user's account.
    if (!(await requireMatchingUser(req, userId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const priceId = TIER_PRICE_ENV[tier as Exclude<SubscriptionTier, 'free'>]
    if (!priceId) {
      // John hasn't created this Stripe Price yet — fail clearly rather than
      // silently charging the wrong amount.
      return NextResponse.json(
        { error: 'This plan is not available for purchase yet' },
        { status: 503 },
      )
    }

    // Look up the profile ourselves — never trust the client to assert who it is.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Email lives on the auth user, not the profiles row.
    let customerEmail: string | undefined
    if (!profile.stripe_customer_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      customerEmail = authUser?.user?.email ?? undefined
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: profile.stripe_customer_id ?? undefined,
      customer_email: profile.stripe_customer_id ? undefined : customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, tier },
      subscription_data: {
        metadata: { userId, tier },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/upgrade?subscription=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
