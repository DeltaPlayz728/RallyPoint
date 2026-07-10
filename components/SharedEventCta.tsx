'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { setPendingRedirect } from '@/lib/postAuthRedirect'

export default function SharedEventCta({ eventId, isFull }: { eventId: string; isFull: boolean }) {
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setLoggedIn(!!data.user)
      setChecking(false)
    })
  }, [])

  const rememberDestination = () => setPendingRedirect(`/events/${eventId}`)

  if (checking) {
    return <div className="h-[52px] bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl animate-pulse" />
  }

  if (loggedIn) {
    return (
      <Link
        href={`/events/${eventId}`}
        className="block w-full text-center bg-accent hover:brightness-110 text-white font-bold py-3.5 rounded-2xl transition"
      >
        {isFull ? 'View event →' : 'View & join →'}
      </Link>
    )
  }

  return (
    <>
      <Link
        href={`/auth/login?redirect=/events/${eventId}`}
        onClick={rememberDestination}
        className="block w-full text-center bg-accent hover:brightness-110 text-white font-bold py-3.5 rounded-2xl transition"
      >
        Log in to see location & join →
      </Link>
      <Link
        href={`/auth/signup?redirect=/events/${eventId}`}
        onClick={rememberDestination}
        className="block w-full text-center border border-gray-300 dark:border-gray-700 hover:border-accent font-semibold py-3 rounded-2xl transition text-sm"
      >
        New here? Create a free account
      </Link>
    </>
  )
}
