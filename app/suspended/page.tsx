'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'

export default function SuspendedPage() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] flex flex-col items-center justify-center px-6 text-center">
      <Ban size={44} className="mb-5 text-red-600" />
      <h1 className="text-2xl font-bold mb-2">Account Suspended</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm leading-relaxed mb-8">
        Your account has been temporarily suspended following reports from other users.
        If you believe this is a mistake, contact us at{' '}
        <a href="mailto:support@rallypoint.app" className="text-accent underline">
          support@rallypoint.app
        </a>
        .
      </p>
      <button
        onClick={handleSignOut}
        className="text-gray-500 dark:text-gray-400 text-sm hover:text-black dark:hover:text-white transition"
      >
        Sign out
      </button>
    </div>
  )
}
