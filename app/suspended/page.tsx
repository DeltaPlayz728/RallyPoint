'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SuspendedPage() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-5">🚫</div>
      <h1 className="text-2xl font-bold mb-2">Account Suspended</h1>
      <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-8">
        Your account has been temporarily suspended following reports from other users.
        If you believe this is a mistake, contact us at{' '}
        <a href="mailto:support@rallypoint.app" className="text-orange-400 underline">
          support@rallypoint.app
        </a>
        .
      </p>
      <button
        onClick={handleSignOut}
        className="text-gray-500 text-sm hover:text-gray-300 transition"
      >
        Sign out
      </button>
    </div>
  )
}
