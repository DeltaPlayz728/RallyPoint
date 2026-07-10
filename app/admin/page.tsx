'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'

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

type FoundingCandidate = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  is_founding_member: boolean
  subscription_tier: string | null
}

type Feedback = {
  id: string
  user_id: string
  message: string
  page_url: string | null
  status: string
  created_at: string
  profiles: { username: string | null; full_name: string | null } | null
}

type PatchNote = {
  id: string
  version: string
  title: string
  body_markdown: string
  severity: 'minor' | 'standard' | 'critical'
  published_at: string
}

type BannerSubmission = {
  id: string
  community_id: string
  asset_type: 'banner' | 'icon'
  asset_url: string
  submitted_at: string
  communities: { name: string } | null
  profiles: { username: string | null; full_name: string | null } | null
}

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [reports, setReports]       = useState<Report[]>([])
  const [suspensions, setSuspensions] = useState<Suspension[]>([])
  const [feedback, setFeedback]     = useState<Feedback[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [tab, setTab]               = useState<'reports' | 'suspensions' | 'founding' | 'feedback' | 'communities' | 'patchnotes'>('reports')
  const [bannerSubmissions, setBannerSubmissions] = useState<BannerSubmission[]>([])
  const [bannerBusyId, setBannerBusyId] = useState<string | null>(null)
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([])
  const [patchVersion, setPatchVersion] = useState('')
  const [patchTitle, setPatchTitle] = useState('')
  const [patchBody, setPatchBody] = useState('')
  const [patchSeverity, setPatchSeverity] = useState<'minor' | 'standard' | 'critical'>('standard')
  const [publishingPatch, setPublishingPatch] = useState(false)
  const [loading, setLoading]       = useState(true)

  // Founding members tab state
  const [foundingMembers, setFoundingMembers] = useState<FoundingCandidate[]>([])
  const [foundingSearch, setFoundingSearch] = useState('')
  const [foundingResults, setFoundingResults] = useState<FoundingCandidate[]>([])
  const [foundingSearching, setFoundingSearching] = useState(false)
  const [foundingBusyId, setFoundingBusyId] = useState<string | null>(null)

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
      const [rRes, sRes, fRes, fbRes, cbRes, pnRes] = await Promise.all([
        fetch('/api/admin/reports'),
        fetch('/api/admin/suspensions'),
        fetch('/api/admin/founding-member'),
        fetch('/api/feedback'),
        fetch('/api/admin/community-banners'),
        fetch('/api/admin/patch-notes'),
      ])
      if (rRes.ok) setReports(await rRes.json())
      if (sRes.ok) setSuspensions(await sRes.json())
      if (fRes.ok) setFoundingMembers(await fRes.json())
      if (fbRes.ok) setFeedback(await fbRes.json())
      if (cbRes.ok) setBannerSubmissions(await cbRes.json())
      if (pnRes.ok) setPatchNotes(await pnRes.json())
      setLoading(false)
    }
    init()
  }, [])

  const refreshFeedback = async () => {
    setFeedbackLoading(true)
    const res = await fetch('/api/feedback')
    if (res.ok) setFeedback(await res.json())
    setFeedbackLoading(false)
  }

  const markFeedback = async (id: string, status: 'new' | 'reviewed') => {
    const res = await fetch('/api/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) {
      alert('Failed to update feedback. Please try again.')
      return
    }
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f))
  }

  const searchFounding = async (q: string) => {
    setFoundingSearch(q)
    if (!q.trim()) { setFoundingResults([]); return }
    setFoundingSearching(true)
    const res = await fetch(`/api/admin/founding-member?q=${encodeURIComponent(q.trim())}`)
    if (res.ok) setFoundingResults(await res.json())
    setFoundingSearching(false)
  }

  const setFounding = async (userId: string, grant: boolean) => {
    setFoundingBusyId(userId)
    const res = await fetch('/api/admin/founding-member', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, grant }),
    })
    if (!res.ok) {
      alert('Something went wrong. Please try again.')
      setFoundingBusyId(null)
      return
    }
    setFoundingResults(prev => prev.map(u => u.id === userId ? { ...u, is_founding_member: grant } : u))
    if (grant) {
      setFoundingMembers(prev => {
        const fromResults = foundingResults.find(u => u.id === userId)
        if (prev.some(u => u.id === userId)) return prev
        return fromResults ? [...prev, { ...fromResults, is_founding_member: true }] : prev
      })
    } else {
      setFoundingMembers(prev => prev.filter(u => u.id !== userId))
    }
    setFoundingBusyId(null)
  }

  const decideBanner = async (id: string, decision: 'approve' | 'reject') => {
    setBannerBusyId(id)
    const res = await fetch('/api/admin/community-banners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, decision }),
    })
    if (!res.ok) {
      alert('Failed to record decision. Please try again.')
      setBannerBusyId(null)
      return
    }
    setBannerSubmissions(prev => prev.filter(b => b.id !== id))
    setBannerBusyId(null)
  }

  const publishPatchNote = async () => {
    if (!patchVersion.trim() || !patchTitle.trim() || !patchBody.trim()) return
    setPublishingPatch(true)
    const res = await fetch('/api/admin/patch-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: patchVersion.trim(), title: patchTitle.trim(), body_markdown: patchBody.trim(), severity: patchSeverity }),
    })
    if (!res.ok) {
      alert('Failed to publish. Please try again.')
      setPublishingPatch(false)
      return
    }
    const { patch } = await res.json()
    setPatchNotes(prev => [patch, ...prev])
    setPatchVersion(''); setPatchTitle(''); setPatchBody(''); setPatchSeverity('standard')
    setPublishingPatch(false)
  }

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
      <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pendingReports = reports.filter(r => r.status === 'pending')
  const newFeedback = feedback.filter(f => f.status === 'new')

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] px-4 py-6 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Admin Queue</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{pendingReports.length} pending reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-xs bg-accent text-white border border-black px-3 py-1 rounded-full">
            Admin
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['reports', 'suspensions', 'founding', 'feedback', 'communities', 'patchnotes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition capitalize ${
              tab === t
                ? 'bg-accent border-accent text-white'
                : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {t === 'patchnotes' ? 'Patch notes' : t}
            {t === 'reports' && pendingReports.length > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingReports.length}
              </span>
            )}
            {t === 'feedback' && newFeedback.length > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {newFeedback.length}
              </span>
            )}
            {t === 'communities' && bannerSubmissions.length > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {bannerSubmissions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Community banner/icon approvals tab */}
      {tab === 'communities' && (
        <div className="space-y-3">
          {bannerSubmissions.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400 text-center py-12">No pending banner/icon submissions</p>
          )}
          {bannerSubmissions.map(b => {
            const submitterName = b.profiles?.username ? `@${b.profiles.username}` : b.profiles?.full_name ?? 'Someone'
            return (
              <div key={b.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300 capitalize">
                      {b.asset_type}
                    </span>
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{b.communities?.name ?? 'Unknown community'}</span>
                  </div>
                  <span className="text-[10px] text-gray-700 dark:text-gray-300 dark:text-gray-400">
                    {new Date(b.submitted_at).toLocaleDateString()}
                  </span>
                </div>
                <img src={b.asset_url} alt="" className="w-full max-h-40 object-cover rounded-xl mb-2 border border-gray-200 dark:border-gray-700" />
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">Submitted by {submitterName}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => decideBanner(b.id, 'approve')}
                    disabled={bannerBusyId === b.id}
                    className="flex-1 text-xs bg-green-100 border border-green-300 text-green-700 py-2 rounded-xl hover:bg-green-200 transition disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decideBanner(b.id, 'reject')}
                    disabled={bannerBusyId === b.id}
                    className="flex-1 text-xs bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 py-2 rounded-xl hover:border-gray-600 transition disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Patch notes tab */}
      {tab === 'patchnotes' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold">Publish a patch note</p>
            <input
              value={patchVersion}
              onChange={e => setPatchVersion(e.target.value)}
              placeholder="Version, e.g. 2026.07.15"
              className="w-full bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <input
              value={patchTitle}
              onChange={e => setPatchTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <textarea
              value={patchBody}
              onChange={e => setPatchBody(e.target.value)}
              rows={4}
              placeholder="What changed (markdown supported)"
              className="w-full bg-[#fdf6ec] dark:bg-[#15110d] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              {(['minor', 'standard', 'critical'] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => setPatchSeverity(sev)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border capitalize transition ${
                    patchSeverity === sev
                      ? 'bg-accent border-accent text-white'
                      : 'bg-[#fdf6ec] dark:bg-[#15110d] border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
            {patchSeverity === 'critical' && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Critical shows a banner every user sees until they acknowledge it — use sparingly.
              </p>
            )}
            <button
              onClick={publishPatchNote}
              disabled={publishingPatch || !patchVersion.trim() || !patchTitle.trim() || !patchBody.trim()}
              className="w-full bg-accent text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {publishingPatch ? 'Publishing…' : 'Publish to everyone'}
            </button>
          </div>

          <div className="space-y-3">
            {patchNotes.map(p => (
              <div key={p.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                    p.severity === 'critical'
                      ? 'bg-red-100 text-red-600 border border-red-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                  }`}>
                    {p.severity}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{p.version} · {new Date(p.published_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-medium text-[#15110d] dark:text-[#fdf6ec]">{p.title}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 whitespace-pre-wrap">{p.body_markdown}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports tab */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400 text-center py-12">No reports</p>
          )}
          {reports.map(r => (
            <div key={r.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    r.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                      : r.status === 'actioned'
                      ? 'bg-red-100 text-red-600 border border-red-300'
                      : 'bg-white dark:bg-[#221c16] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  }`}>
                    {r.status}
                  </span>
                  <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{r.target_type}</span>
                </div>
                <span className="text-[10px] text-gray-700 dark:text-gray-300 dark:text-gray-400">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[#15110d] dark:text-[#fdf6ec] text-sm font-medium mb-1">{r.reason}</p>
              {r.details && <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">{r.details}</p>}
              <p className="text-gray-700 dark:text-gray-300 dark:text-gray-400 text-[10px] mb-3">
                Target ID: {r.target_id}
              </p>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateReport(r.id, 'actioned')}
                    className="flex-1 text-xs bg-red-100 border border-red-300 text-red-600 py-2 rounded-xl hover:bg-red-200 transition"
                  >
                    Take Action
                  </button>
                  <button
                    onClick={() => updateReport(r.id, 'dismissed')}
                    className="flex-1 text-xs bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 py-2 rounded-xl hover:border-gray-600 transition"
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
            <p className="text-gray-600 dark:text-gray-400 text-center py-12">No active suspensions</p>
          )}
          {suspensions.map(s => (
            <div key={s.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <p className="text-[#15110d] dark:text-[#fdf6ec] text-sm font-medium mb-1">User {s.user_id.slice(0, 8)}…</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">{s.reason}</p>
              <p className="text-gray-700 dark:text-gray-300 dark:text-gray-400 text-[10px] mb-3">
                Suspended {new Date(s.suspended_at).toLocaleDateString()}
              </p>
              <button
                onClick={() => liftSuspension(s.user_id)}
                className="w-full text-xs bg-purple-500 border border-black text-white py-2 rounded-xl hover:bg-purple-500 transition"
              >
                Lift Suspension
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Founding members tab */}
      {tab === 'founding' && (
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
            Founding members get the Planner tier free, forever — no Stripe subscription needed.
          </p>

          <input
            value={foundingSearch}
            onChange={(e) => searchFounding(e.target.value)}
            placeholder="Search by username or name..."
            className="w-full bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none"
          />

          {foundingSearch.trim() && (
            <div className="space-y-2 mb-6">
              {foundingSearching ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Searching…</p>
              ) : foundingResults.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No matches</p>
              ) : (
                foundingResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                        {(u.username ?? u.full_name ?? '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#15110d] dark:text-[#fdf6ec] truncate">
                        {u.username ? `@${u.username}` : (u.full_name ?? 'Unknown')}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        Current tier: {u.subscription_tier ?? 'free'}
                      </p>
                    </div>
                    <button
                      onClick={() => setFounding(u.id, !u.is_founding_member)}
                      disabled={foundingBusyId === u.id}
                      className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-60 ${
                        u.is_founding_member
                          ? 'bg-gray-100 dark:bg-[#2b241c] text-gray-600 dark:text-gray-300'
                          : 'bg-accent text-white'
                      }`}
                    >
                      {foundingBusyId === u.id ? '…' : u.is_founding_member ? 'Revoke' : 'Grant'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <p className="text-gray-500 dark:text-gray-400 text-[11px] font-semibold uppercase tracking-wide mb-2">
            Current founding members ({foundingMembers.length})
          </p>
          <div className="space-y-2">
            {foundingMembers.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">None yet</p>
            ) : (
              foundingMembers.map(u => (
                <div key={u.id} className="flex items-center gap-3 bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                      {(u.username ?? u.full_name ?? '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#15110d] dark:text-[#fdf6ec] truncate">
                      {u.username ? `@${u.username}` : (u.full_name ?? 'Unknown')}
                    </p>
                  </div>
                  <button
                    onClick={() => setFounding(u.id, false)}
                    disabled={foundingBusyId === u.id}
                    className="shrink-0 text-xs bg-gray-100 dark:bg-[#2b241c] text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-60"
                  >
                    {foundingBusyId === u.id ? '…' : 'Revoke'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Feedback tab */}
      {tab === 'feedback' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {newFeedback.length} new · {feedback.length} total
            </p>
            <button
              onClick={refreshFeedback}
              disabled={feedbackLoading}
              className="text-xs border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              {feedbackLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="space-y-3">
            {feedback.length === 0 && (
              <p className="text-gray-600 dark:text-gray-400 text-center py-12">No feedback yet</p>
            )}
            {feedback.map(f => (
              <div key={f.id} className="bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      f.status === 'new'
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                        : 'bg-white dark:bg-[#221c16] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                    }`}>
                      {f.status}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {f.profiles?.username ? `@${f.profiles.username}` : (f.profiles?.full_name ?? 'Unknown user')}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-700 dark:text-gray-300 dark:text-gray-400 shrink-0">
                    {new Date(f.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[#15110d] dark:text-[#fdf6ec] text-sm mb-2 whitespace-pre-wrap">{f.message}</p>
                {f.page_url && (
                  <p className="text-gray-700 dark:text-gray-300 dark:text-gray-400 text-[10px] mb-3">
                    Page: {f.page_url}
                  </p>
                )}
                {f.status === 'new' && (
                  <button
                    onClick={() => markFeedback(f.id, 'reviewed')}
                    className="text-xs bg-accent hover:brightness-90 text-white px-3 py-1.5 rounded-lg font-medium transition"
                  >
                    Mark reviewed
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
