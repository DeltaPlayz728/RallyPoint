'use client'

import { useEffect } from 'react'
import { captureReferralFromUrl } from '@/lib/referral'

// Mounted once in the root layout. Reads window.location directly (not
// next/navigation's useSearchParams) specifically to avoid needing a
// Suspense boundary at the root layout level — this bit us on the login
// page (see the "wrap useSearchParams in Suspense" build fix); reading
// window.location in a plain useEffect sidesteps that entirely and is fine
// here since we don't need this to be part of the server-rendered HTML.
export default function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl()
  }, [])

  return null
}
