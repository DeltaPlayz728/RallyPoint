'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Lightweight, free error tracking: catches uncaught client errors and unhandled
// promise rejections and writes them to public.error_log (insert-only for clients;
// read via service role / admin). Capped per session to avoid loops flooding the table.
export default function ErrorLogger() {
  useEffect(() => {
    let sent = 0
    const MAX_PER_SESSION = 10

    const log = async (message: string, stack?: string) => {
      if (sent >= MAX_PER_SESSION) return
      sent++
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('error_log').insert({
          user_id: user?.id ?? null,
          message: String(message).slice(0, 500),
          source: 'client',
          url: typeof location !== 'undefined' ? location.href : null,
          stack: (stack ?? '').slice(0, 2000),
        })
      } catch {
        // never let error logging throw
      }
    }

    const onError = (e: ErrorEvent) => log(e.message, e.error?.stack)
    const onRejection = (e: PromiseRejectionEvent) =>
      log('unhandledrejection: ' + (e.reason?.message ?? String(e.reason)), e.reason?.stack)

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
