'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Admin-only page — uses service role on client only for this page.
// In production, this should be a server component or behind a separate admin auth.
// For MVP: gate by checking if user is the owner account.

const ADMIN_EMAIL = 'rallypoint.admin@gmail.com' // change to your email

type Report = {
  id: string
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
}

type Suspension = {
  id: string
  user_id: string
  reason: string
  suspended_at: string
  lifted_at: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [reports, setReports]       = useState<Report[]>([])
  const [suspensions, setSuspensions] = useState<Suspension[]>([])
  const [tab, setTab]               = useState<'reports' | 'suspensions'>('reports')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Check if admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle()

      if (user.email !== ADMIN_EMAIL) {
        router.push('/feed')
        return
      }

      setAuthorized(true)

      // Fetch reports and suspensions via service role API
      const [rRes, sRes] = await Promise.all([
        fetch('/api/admin/reports'),
        fetch('/api/admin/suspensions'),
      ])
      if (rRes.ok) setReports(await rRes.json())
      if (sRes.ok) setSuspensions(await sRes.json())
      setLoading(false)
    }
    init()
  }, [])

  const updateReport = async (id: string, status: string) => {
    const res = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) {
      alert('Failed to update report. Please try again.')
      return
    }
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const liftSuspension = async (userId: string) => {
    const res = await fetch('/api/admin/suspensions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) {
      alert('Failed to lift suspension. Please try again.')
      return
    }
    setSuspensions(prev => prev.filter(s => s.user_id !== userId))
  }

  if (!authorized || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pendingReports = reports.filter(r => r.status === 'pending')

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Admin Queue</h1>
          <p className="text-gray-500 text-sm">{pendingReports.length} pending reports</p>
        </div>
        <span className="text-xs bg-orange-950 text-orange-400 border border-orange-900 px-3 py-1 rounded-full">
          Admin
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['reports', 'suspensions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition capitalize ${
              tab === t
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-transparent border-gray-800 text-gray-400'
            }`}
          >
            {t}
            {t === 'reports' && pendingReports.length > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingReports.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 && (
            <p className="text-gray-600 text-center py-12">No reports</p>
          )}
          {reports.map(r => (
            <div key={r.id} className="bg-[#111] border border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    r.status === 'pending'
                      ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/40'
                      : r.status === 'actioned'
                      ? 'bg-red-950/60 text-red-400 border border-red-900/40'
                      : 'bg-gray-900 text-gray-500 border border-gray-800'
                  }`}>
                    {r.status}
                  </span>
                  <span className="ml-2 text-xs text-gray-600">{r.target_type}</span>
                </div>
                <span className="text-[10px] text-gray-700">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-white text-sm font-medium mb-1">{r.reason}</p>
              {r.details && <p className="text-gray-500 text-xs mb-3">{r.details}</p>}
              <p className="text-gray-700 text-[10px] mb-3">
                Target ID: {r.target_id}
              </p>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateReport(r.id, 'actioned')}
                    className="flex-1 text-xs bg-red-900/40 border border-red-900 text-red-400 py-2 rounded-xl hover:bg-red-900/60 transition"
                  >
                    Take Action
                  </button>
                  <button
                    onClick={() => updateReport(r.id, 'dismissed')}
                    className="flex-1 text-xs bg-gray-900 border border-gray-800 text-gray-500 py-2 rounded-xl hover:border-gray-600 transition"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suspensions tab */}
      {tab === 'suspensions' && (
        <div className="space-y-3">
          {suspensions.length === 0 && (
            <p className="text-gray-600 text-center py-12">No active suspensions</p>
          )}
          {suspensions.map(s => (
            <div key={s.id} className="bg-[#111] border border-gray-800 rounded-2xl p-4">
              <p className="text-white text-sm font-medium mb-1">User {s.user_id.slice(0, 8)}…</p>
              <p className="text-gray-500 text-xs mb-1">{s.reason}</p>
              <p className="text-gray-700 text-[10px] mb-3">
                Suspended {new Date(s.suspended_at).toLocaleDateString()}
              </p>
              <button
                onClick={() => liftSuspension(s.user_id)}
                className="w-full text-xs bg-green-950/40 border border-green-900 text-green-400 py-2 rounded-xl hover:bg-green-950/60 transition"
              >
                Lift Suspension
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
