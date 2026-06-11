'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Request = {
  id: string
  status: 'pending' | 'accepted' | 'declined'
  message: string
  created_at: string
  sender_id: string
  receiver_id: string
  sender: { full_name: string; username: string } | null
  receiver: { full_name: string; username: string } | null
  events: { title: string } | null
}

export default function MeetupsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<Request[]>([])
  const [outgoing, setOutgoing] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('meetup_requests')
        .select('*, sender:profiles!meetup_requests_sender_id_fkey(full_name, username), receiver:profiles!meetup_requests_receiver_id_fkey(full_name, username), events(title)')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      const all = data ?? []
      setIncoming(all.filter((r: Request) => r.receiver_id === user.id))
      setOutgoing(all.filter((r: Request) => r.sender_id === user.id))
      setLoading(false)
    }
    load()
  }, [])

  const respond = async (requestId: string, status: 'accepted' | 'declined') => {
    await supabase
      .from('meetup_requests')
      .update({ status })
      .eq('id', requestId)

    setIncoming(prev =>
      prev.map(r => r.id === requestId ? { ...r, status } : r)
    )

    // Notify the sender
    const request = incoming.find(r => r.id === requestId)
    if (request && userId) {
      const myProfile = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', userId)
        .single()

      const myName = myProfile.data?.username
        ? `@${myProfile.data.username}`
        : myProfile.data?.full_name ?? 'Someone'

      await supabase.from('notifications').insert({
        user_id: request.sender_id,
        type: status === 'accepted' ? 'meetup_accepted' : 'meetup_declined',
        title: status === 'accepted'
          ? `${myName} accepted your meetup request!`
          : `${myName} declined your meetup request`,
        body: status === 'accepted' ? 'You\'re connected — make it happen!' : null,
        link: '/meetups',
      })
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'accepted') return <span className="text-xs text-green-400 font-medium">✓ Accepted</span>
    if (status === 'declined') return <span className="text-xs text-red-400 font-medium">✗ Declined</span>
    return <span className="text-xs text-yellow-400 font-medium">⏳ Pending</span>
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">Loading...</div>
  )

  return (
    <div className="min-h-screen bg-black text-white px-4 pt-6 pb-24">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-1">1:1 Meetups</h1>
        <p className="text-gray-400 text-sm mb-6">Connect with people from your events.</p>

        {/* Incoming */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">
            Incoming ({incoming.length})
          </h2>
          {incoming.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-4 text-center text-gray-500 text-sm">
              No incoming requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {incoming.map(req => (
                <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-white">
                        {req.sender?.full_name ?? 'Someone'}
                        {req.sender?.username && (
                          <span className="text-gray-400 text-sm ml-1">@{req.sender.username}</span>
                        )}
                      </p>
                      {req.events && (
                        <p className="text-xs text-gray-500">From: {req.events.title}</p>
                      )}
                    </div>
                    {statusBadge(req.status)}
                  </div>
                  {req.message && (
                    <p className="text-sm text-gray-300 mb-3 italic">"{req.message}"</p>
                  )}
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => respond(req.id, 'accepted')}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 rounded-lg transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respond(req.id, 'declined')}
                        className="flex-1 border border-gray-700 text-gray-400 hover:text-white text-sm font-medium py-2 rounded-lg transition"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Outgoing */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3">
            Sent ({outgoing.length})
          </h2>
          {outgoing.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-4 text-center text-gray-500 text-sm">
              You haven't sent any meetup requests yet.<br />
              <span className="text-xs mt-1 block">Request meetups from the attendee list on any event.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {outgoing.map(req => (
                <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">
                        {req.receiver?.full_name ?? 'Someone'}
                        {req.receiver?.username && (
                          <span className="text-gray-400 text-sm ml-1">@{req.receiver.username}</span>
                        )}
                      </p>
                      {req.events && (
                        <p className="text-xs text-gray-500">From: {req.events.title}</p>
                      )}
                    </div>
                    {statusBadge(req.status)}
                  </div>
                  {req.message && (
                    <p className="text-sm text-gray-300 mt-2 italic">"{req.message}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
