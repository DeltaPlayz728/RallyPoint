import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isRateLimited } from '@/lib/rateLimit'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'

  // API routes handle their own auth (requireMatchingUser / getAdminUser / Stripe
  // signature verification) and must stay reachable without a Supabase session
  // cookie — e.g. Stripe's webhook and the public waitlist form never carry one.
  // Without this bypass, this cookie-based gate below redirects every such
  // request to /auth/login before the route handler ever runs, which silently
  // broke the Stripe webhook (payments never get recorded) and the waitlist
  // signup form (anonymous visitors can't join) since the original app build.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  // Rate limit only actual auth *submissions* (POST) — not GET page loads,
  // redirects, or <Link> prefetches. Those are normal browsing and were
  // tripping the 429 for real users (especially several behind one shared/
  // CGNAT IP). Brute force is still capped here, and Supabase Auth's own
  // Turnstile attack-protection remains the primary gate on credentials.
  if (pathname.startsWith('/auth/') && request.method === 'POST') {
    if (await isRateLimited(`auth:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })) {
      return new NextResponse('Too many requests. Please wait before trying again.', {
        status: 429,
        headers: { 'Retry-After': '900' },
      })
    }
  }
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Every app page is personalized (per-user greeting, theme accent, live
  // data) and rendered client-side after hydration, so it must never be
  // served from Vercel's edge cache or a browser's disk/back-forward cache.
  // Without this, navigating away and back (or reopening after a deploy)
  // can restore a stale cached HTML shell from an older deploy — this is
  // what caused the "reverts to the old design" bug reported 2026-06-29.
  supabaseResponse.headers.set('Cache-Control', 'private, no-store, must-revalidate')

  // Logged-in users opening the app at the root marketing page go straight to
  // their home/event screen (the Feed) instead of the public landing page.
  if (pathname === '/' && user) {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  // Public routes — no auth needed
  const publicRoutes = ['/auth/login', '/auth/signup', '/welcome', '/', '/onboarding', '/tos', '/privacy', '/suspended', '/early-access']
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return supabaseResponse
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Check suspension (skip for auth/logout routes to avoid infinite loop)
  if (!pathname.startsWith('/auth/') && !pathname.startsWith('/suspended')) {
    const { data: suspension } = await supabase
      .from('user_suspensions')
      .select('id')
      .eq('user_id', user.id)
      .is('lifted_at', null)
      .maybeSingle()

    if (suspension) {
      return NextResponse.redirect(new URL('/suspended', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
