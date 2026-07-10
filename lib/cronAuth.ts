import { NextRequest } from 'next/server'

/**
 * Verifies a request came from Vercel Cron (or someone who has the secret).
 * Set CRON_SECRET in Vercel's env vars — Vercel automatically attaches
 * `Authorization: Bearer <CRON_SECRET>` to its own scheduled invocations of
 * routes configured in vercel.json, so this is the standard way to keep
 * these endpoints from being triggerable by anyone who finds the URL.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed if the secret isn't configured yet
  return req.headers.get('authorization') === `Bearer ${secret}`
}
