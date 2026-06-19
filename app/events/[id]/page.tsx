'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import FriendButton from '@/components/FriendButton'
import RatingModal from '@/components/RatingModal'
import ShareCard from '@/components/ShareCard'

const AVATAR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

type Event = {
  id: string
  title: string
  description: string
  type: 'casual' | 'social'
  location: string
  city: string
  starts_at: string
  max_attendees: number | null
  price: number
  created_by: string
  status: string
  is_suggested?: boolean
}

type MeetupRequestMap = Record<string, 'pending' | 'accepted' | 'declined'>

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ name, index, size = 'md' }: { name: string; index: number; size?: 'sm' | 'md' }) {
  const initial = (name ?? '?')[0].toUpperCase()
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const cls = size === 'sm'
    ? 'w-7 h-7 text-[9px]'
    : 'w-10 h-10 text-xs'
  return (
    <div
      className={`${cls} rounded-full border-2 border-black flex items-center justify-center font-black text-black shrink-0`}
      style={{ background: bg }}
    >
      {initial}
    </div>
  )
}

// ─── Meetup request modal ─────────────────────────────────────────────────────

function MeetupModal({
  target,
  onSend,
  onClose,
  sending,
}: {
  target: { userId: string; name: string }
  onSend: (message: string) => void
  onClose: () => void
  sending: boolean
}) {
  const [message, setMessage] = useState('')
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111] border border-gray-800 rounded-3xl w-full max-w-md p-5 z-10"
        style={{ animation: 'rpSheetUp 0.25s cubic-bezier(0.32,0.72,0,1) both' }}>
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
        <h3 className="font-bold text-lg mb-1 text-white">Request a meetup</h3>
        <p className="text-gray-400 text-sm mb-4">
          Send a 1:1 request to <span className="text-white font-medium">{target.name}</span>
        </p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Add a message (optional)"
          rows={3}
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-700 text-gray-400 font-medium py-3 rounded-xl transition hover:border-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => onSend(message)}
            disabled={sending}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [event, setEvent]               = useState<Event | null>(null)
  const [attendees, setAttendees]       = useState<any[]>([])
  const [userId, setUserId]             = useState<string | null>(null)
  const [isAttending, setIsAttending]   = useState(false)
  const [isHost, setIsHost]             = useState(false)
  const [loading, setLoading]           = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [meetupRequests, setMeetupRequests] = useState<MeetupRequestMap>({})
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null)
  const [requestModal, setRequestModal] = useState<{ userId: string; name: string } | null>(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [showRating, setShowRating]         = useState(false)
  const [showShare, setShowShare]           = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling]         = useState(false)

  // Inject animation CSS
  useEffect(() => {
    const styleId = 'rp-event-styles'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes rpSheetUp {
        from { transform: translateY(100%); opacity: 0.6; }
        to   { transform: translateY(0);    opacity: 1;   }
      }
    `
    document.head.appendChild(style)
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: eventData } = await supabase
        .from('events').select('*').eq('id', id).single()
      if (!eventData) { router.push('/feed'); return }
      setEvent(eventData)
      setIsHost(eventData.created_by === user.id)

      const { data: attendeeData } = await supabase
        .from('event_attendees')
        .select('user_id, profiles(full_name, username)')
        .eq('event_id', id)
      setAttendees(attendeeData ?? [])
      const attending = attendeeData?.some((a: any) => a.user_id === user.id) ?? false
      setIsAttending(attending)

      // Show rating prompt if: event ended 2+ hrs ago, user attended, hasn't rated yet
      if (attending && eventData) {
        const endTime = new Date(eventData.starts_at).getTime() + 2 * 60 * 60 * 1000
        if (Date.now() > endTime) {
          const { data: existingRating } = await supabase
            .from('event_ratings')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle()
          if (!existingRating) setShowRating(true)
        }
      }

      const { data: requests } = await supabase
        .from('meetup_requests')
        .select('receiver_id, status')
        .eq('event_id', id)
        .eq('sender_id', user.id)
      const requestMap: MeetupRequestMap = {}
      for (const r of requests ?? []) requestMap[r.receiver_id] = r.status
      setMeetupRequests(requestMap)

      setLoading(false)
    }
    load()
  }, [id])

  // Handle Stripe return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'cancelled') setPaymentStatus('cancelled')
    if (params.get('payment') === 'success' && userId && event) {
      setPaymentStatus('success')
      supabase.from('event_attendees')
        .upsert({ event_id: event.id, user_id: userId }, { onConflict: 'event_id,user_id' })
        .then(() => {
          setIsAttending(true)
          supabase.from('event_chats').upsert({ event_id: event.id }, { onConflict: 'event_id' })
        })
    }
  }, [userId, event])

  const handleJoin = async () => {
    if (!userId || !event) return
    setActionLoading(true)
    if (event.price > 0) {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, eventTitle: event.title, price: event.price, userId }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
      setActionLoading(false)
      return
    }
    const { error } = await supabase.from('event_attendees').insert({ event_id: event.id, user_id: userId })
    if (!error) {
      setIsAttending(true)
      setAttendees(prev => [...prev, { user_id: userId, profiles: null }])
      await supabase.from('event_chats').upsert({ event_id: event.id }, { onConflict: 'event_id' })
    }
    setActionLoading(false)
  }

  const handleLeave = async () => {
    if (!userId || !event || isHost) return
    setActionLoading(true)
    await supabase.from('event_attendees').delete().eq('event_id', event.id).eq('user_id', userId)
    setIsAttending(false)
    setAttendees(prev => prev.filter(a => a.user_id !== userId))
    setActionLoading(false)
  }

  const handleCancelEvent = async () => {
    if (!event || !userId || !isHost) return
    setCancelling(true)

    const { error } = await supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', event.id)
      .eq('created_by', userId)

    if (error) {
      setCancelling(false)
      return
    }

    // Let everyone who joined know it's off
    const others = attendees.filter((a: any) => a.user_id !== userId)
    if (others.length > 0) {
      await supabase.from('notifications').insert(
        others.map((a: any) => ({
          user_id: a.user_id,
          type: 'event_cancelled',
          title: `"${event.title}" was cancelled`,
          body: 'The host cancelled this event.',
          link: '/events',
        }))
      )
    }

    setCancelling(false)
    setShowCancelConfirm(false)
    router.push('/events')
  }

  const sendMeetupRequest = async (message: string) => {
    if (!requestModal || !userId || !event) return
    setSendingRequest(true)
    const { error } = await supabase.from('meetup_requests').insert({
      sender_id: userId,
      receiver_id: requestModal.userId,
      event_id: event.id,
      message: message.trim() || null,
      status: 'pending',
    })
    if (!error) {
      setMeetupRequests(prev => ({ ...prev, [requestModal.userId]: 'pending' }))
      const { data: senderProfile } = await supabase
        .from('profiles').select('full_name, username').eq('id', userId).single()
      const senderName = senderProfile?.username
        ? `@${senderProfile.username}`
        : senderProfile?.full_name ?? 'Someone'
      await supabase.from('notifications').insert({
        user_id: requestModal.userId,
        type: 'meetup_request',
        title: `${senderName} wants to meet up`,
        body: message.trim() || `From the event: ${event.title}`,
        link: '/meetups',
      })
    }
    setRequestModal(null)
    setSendingRequest(false)
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        {/* Hero skeleton */}
        <div className="h-52 bg-gray-900 animate-pulse" />
        <div className="px-4 pt-5 space-y-4">
          <div className="h-4 w-24 bg-gray-800 rounded-full animate-pulse" />
          <div className="h-7 w-3/4 bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!event) return null

  const isFull = event.max_attendees !== null && attendees.length >= event.max_attendees
  const isCasual = event.type === 'casual'

  return (
    <div className="min-h-screen bg-black text-white pb-48">

      {/* Post-event rating modal */}
      {showRating && event && (
        <RatingModal
          eventId={event.id}
          eventTitle={event.title}
          onDone={() => { setShowRating(false); setShowShare(true) }}
        />
      )}

      {/* Share card — shows after rating, or manually triggered */}
      {showShare && event && (
        <ShareCard
          eventTitle={event.title}
          eventLocation={event.location}
          eventDate={event.starts_at}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Meetup request modal */}
      {requestModal && (
        <MeetupModal
          target={requestModal}
          onSend={sendMeetupRequest}
          onClose={() => setRequestModal(null)}
          sending={sendingRequest}
        />
      )}

      {/* Cancel event confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative bg-[#111] border border-gray-800 rounded-3xl w-full max-w-md p-5 z-10"
            style={{ animation: 'rpSheetUp 0.25s cubic-bezier(0.32,0.72,0,1) both' }}>
            <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-lg mb-1 text-white">Cancel this event?</h3>
            <p className="text-gray-400 text-sm mb-4">
              {attendees.length > 1
                ? `${attendees.length - 1} other ${attendees.length - 1 === 1 ? 'person' : 'people'} joined — they'll be notified it's cancelled. This can't be undone.`
                : "This can't be undone."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 border border-gray-700 text-gray-400 font-medium py-3 rounded-xl transition hover:border-gray-500"
              >
                Keep event
              </button>
              <button
                onClick={handleCancelEvent}
                disabled={cancelling}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Cancel event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className={`relative w-full pt-14 pb-6 px-4 ${
        isCasual
          ? 'bg-gradient-to-b from-green-950 via-[#0a1a0a] to-black'
          : 'bg-gradient-to-b from-orange-950 via-[#1a0a00] to-black'
      }`}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white/80 hover:text-white border border-white/10 transition"
        >
          ←
        </button>

        {/* Payment banners */}
        {paymentStatus === 'success' && (
          <div className="mb-4 bg-green-900/40 border border-green-500/30 text-green-400 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
            ✅ Payment successful — you're in!
          </div>
        )}
        {paymentStatus === 'cancelled' && (
          <div className="mb-4 bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-xl">
            Payment cancelled. Try again below.
          </div>
        )}

        {/* Type badge */}
        <div className="mb-3">
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
            isCasual
              ? 'bg-green-950/80 text-green-400 border-green-800/60'
              : 'bg-orange-950/80 text-orange-400 border-orange-800/60'
          }`}>
            {isCasual ? '😊 Casual Meetup' : '🎳 Social Event'}
          </span>
          {event.is_suggested && (
            <span className="ml-2 text-xs px-3 py-1.5 rounded-full font-semibold border bg-orange-500/10 text-orange-400 border-orange-500/30">
              ✨ Suggested by RallyPoint
            </span>
          )}
        </div>

        {/* Title + price */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-white leading-tight flex-1">
            {event.title}
          </h1>
          <span className={`text-lg font-black shrink-0 mt-0.5 ${
            event.price > 0 ? 'text-orange-400' : 'text-green-400'
          }`}>
            {event.price > 0 ? `€${event.price}` : 'Free'}
          </span>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">{event.description}</p>
        )}
      </div>

      {/* ── Info rows ────────────────────────────────────────────────────── */}
      <div className="px-4 py-5 border-b border-gray-900 space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-base shrink-0">
            📍
          </div>
          <div>
            <p className="text-white text-sm font-medium">{event.location}</p>
            <p className="text-gray-500 text-xs">{event.city}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-base shrink-0">
            🕐
          </div>
          <p className="text-white text-sm">{formatDate(event.starts_at)}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-base shrink-0">
            👥
          </div>
          <p className="text-white text-sm">
            {attendees.length} going
            {event.max_attendees
              ? ` · ${Math.max(0, event.max_attendees - attendees.length)} spots left`
              : ' · Open to all'}
          </p>
        </div>
      </div>

      {/* ── Attendees ────────────────────────────────────────────────────── */}
      {attendees.length > 0 && (
        <div className="px-4 py-5 border-b border-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Who's going</h2>
            {event.max_attendees && (
              <span className="text-gray-600 text-xs">
                {attendees.length} / {event.max_attendees}
              </span>
            )}
          </div>

          {/* Avatar stack */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex -space-x-2.5">
              {attendees.slice(0, 6).map((a: any, i) => {
                const name = a.profiles?.full_name ?? a.profiles?.username ?? '?'
                return (
                  <Avatar key={a.user_id} name={name} index={i} size="md" />
                )
              })}
            </div>
            {attendees.length > 6 && (
              <span className="text-gray-500 text-sm">+{attendees.length - 6} more</span>
            )}
          </div>

          {/* Individual rows with meetup buttons */}
          <div className="space-y-2.5">
            {attendees.map((a: any, i: number) => {
              const isMe        = a.user_id === userId
              const isEventHost = a.user_id === event.created_by
              const name        = a.profiles?.username
                ? `@${a.profiles.username}`
                : a.profiles?.full_name ?? 'Someone'
              const requestStatus = meetupRequests[a.user_id]

              return (
                <div key={a.user_id} className="flex items-center justify-between gap-2">
                  <Link
                    href={isMe ? '/profile' : `/profile/${a.user_id}`}
                    className="flex items-center gap-2.5 hover:opacity-75 transition min-w-0"
                  >
                    <Avatar name={a.profiles?.full_name ?? '?'} index={i} size="sm" />
                    <span className="text-sm text-white truncate">
                      {name}
                      {isEventHost && (
                        <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isCasual ? 'bg-green-900/60 text-green-400' : 'bg-orange-900/60 text-orange-400'
                        }`}>host</span>
                      )}
                      {isMe && <span className="ml-1.5 text-[10px] text-gray-600">you</span>}
                    </span>
                  </Link>

                  {(isAttending || isHost) && !isMe && userId && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <FriendButton
                        currentUserId={userId}
                        targetUserId={a.user_id}
                        size="sm"
                      />
                      {requestStatus === 'pending' ? (
                        <span className="text-xs text-yellow-500 bg-yellow-950/40 px-2 py-1 rounded-full border border-yellow-900/40">Meetup sent</span>
                      ) : requestStatus === 'accepted' ? (
                        <span className="text-xs text-green-400 bg-green-950/40 px-2 py-1 rounded-full border border-green-900/40">✓ Met</span>
                      ) : requestStatus !== 'declined' ? (
                        <button
                          onClick={() => setRequestModal({ userId: a.user_id, name })}
                          className="text-xs text-gray-400 border border-gray-700 hover:border-orange-500 hover:text-orange-400 px-2 py-1 rounded-full transition"
                        >
                          Meetup
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Fixed bottom CTA bar — sits above the bottom nav (which is z-50 and
            would otherwise swallow clicks meant for this bar) ──────────────── */}
      <div className="fixed bottom-20 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-t border-gray-900 px-4 pt-3 pb-4">
        {isHost ? (
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-500 text-center">
              You're hosting this event
            </div>
            <Link
              href={`/events/${event.id}/chat`}
              className="flex items-center justify-center gap-1.5 px-4 bg-gray-900 border border-gray-700 hover:border-orange-500 text-white rounded-2xl transition text-sm font-medium"
            >
              💬
            </Link>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center justify-center px-4 border border-red-900/60 text-red-400 hover:bg-red-950/40 rounded-2xl transition text-sm font-medium"
              title="Cancel event"
            >
              Cancel
            </button>
          </div>
        ) : isAttending ? (
          <div className="flex gap-2">
            <Link
              href={`/events/${event.id}/chat`}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-900 border border-gray-700 hover:border-orange-500 text-white font-semibold py-3.5 rounded-2xl transition text-sm"
            >
              💬 Group Chat
            </Link>
            <button
              onClick={() => setShowShare(true)}
              className="px-4 border border-gray-700 hover:border-orange-500 text-gray-300 hover:text-orange-400 rounded-2xl transition text-lg"
              title="Share this event"
            >
              📤
            </button>
            <button
              onClick={handleLeave}
              disabled={actionLoading}
              className="px-4 border border-red-900/60 text-red-400 hover:bg-red-950/40 rounded-2xl transition disabled:opacity-50 text-sm font-medium"
            >
              Leave
            </button>
          </div>
        ) : isFull ? (
          <button disabled className="w-full bg-gray-900 border border-gray-800 text-gray-600 font-semibold py-3.5 rounded-2xl cursor-not-allowed">
            Event Full
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={actionLoading}
            className={`w-full font-bold py-3.5 rounded-2xl transition active:scale-[0.98] disabled:opacity-50 ${
              isCasual
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-orange-500 hover:bg-orange-400 text-white'
            }`}
          >
            {actionLoading
              ? 'Joining…'
              : event.price > 0
              ? `Pay €${event.price} & Join →`
              : `Join ${isCasual ? 'Meetup' : 'Event'} →`}
          </button>
        )}
      </div>
    </div>
  )
}
