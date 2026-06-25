'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { moderateEvent } from '@/lib/contentModeration'
import Logo from '@/components/Logo'

const PRICE_MAP: Record<string, number> = {
  small: 10,
  medium: 25,
  large: 75,
}

function CreateEventForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [type, setType] = useState<'casual' | 'social'>('casual')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [city, setCity] = useState('')
  const [prefillLat, setPrefillLat] = useState<number | null>(null)
  const [prefillLng, setPrefillLng] = useState<number | null>(null)
  const [startsAt, setStartsAt] = useState('')
  const [maxAttendees, setMaxAttendees] = useState('')
  const [sizebracket, setSizeBracket] = useState('small')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Pre-fill location if coming from map venue pin
  useEffect(() => {
    const venue = searchParams.get('venue')
    const lat   = searchParams.get('lat')
    const lng   = searchParams.get('lng')
    if (venue) setLocation(venue)
    if (lat)   setPrefillLat(parseFloat(lat))
    if (lng)   setPrefillLng(parseFloat(lng))
  }, [searchParams])

  const price = type === 'social' ? PRICE_MAP[sizebracket] : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Content moderation check
    const modResult = moderateEvent(title, description)
    if (!modResult.allowed) {
      if (modResult.action === 'block') {
        setError('This event cannot be created. Please review your title and description.')
        setLoading(false)
        return
      }
      // 'hold' — create event but mark as pending_review
    }

    const max = maxAttendees ? parseInt(maxAttendees) : null

    // Use pre-filled coords from map venue pin if available, otherwise geocode
    let lat: number | null = prefillLat
    let lng: number | null = prefillLng
    if (!lat || !lng) {
      try {
        const query = encodeURIComponent(`${location}, ${city}`)
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
        const geoData = await geoRes.json()
        if (geoData.length > 0) {
          lat = parseFloat(geoData[0].lat)
          lng = parseFloat(geoData[0].lon)
        }
      } catch {}
    }

    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        created_by: user.id,
        title,
        description,
        type,
        location,
        city,
        starts_at: new Date(startsAt).toISOString(),
        max_attendees: max,
        price,
        lat,
        lng,
        status: (!modResult.allowed && modResult.action === 'hold') ? 'pending_review' : 'active',
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Auto-join as host
    await supabase.from('event_attendees').insert({
      event_id: data.id,
      user_id: user.id,
    })

    // Auto-create chat room
    await supabase.from('event_chats').insert({ event_id: data.id })

    router.push(`/events/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec] px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold">Create an Event</h1>
          <Logo size={26} />
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Get people together.</p>

        {/* Event Type Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setType('casual')}
            className={`flex-1 py-3 rounded-lg font-medium border transition ${
              type === 'casual'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            😊 Casual Meetup
            <div className="text-xs font-normal opacity-75 mt-0.5">Free · Spontaneous</div>
          </button>
          <button
            type="button"
            onClick={() => setType('social')}
            className={`flex-1 py-3 rounded-lg font-medium border transition ${
              type === 'social'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            🎳 Social Event
            <div className="text-xs font-normal opacity-75 mt-0.5">Coordinated · Paid</div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Event Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              placeholder={type === 'casual' ? 'e.g. Grabbing coffee near downtown' : 'e.g. Bowling night at Lucky Lanes'}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Description <span className="text-gray-600 dark:text-gray-400">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 resize-none"
              placeholder="What's the vibe? What should people expect?"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              placeholder="e.g. Blue Bottle Coffee, Main St"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              placeholder="e.g. New York"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Max Attendees <span className="text-gray-600 dark:text-gray-400">(optional)</span></label>
            <input
              type="number"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              min="2"
              className="w-full bg-white dark:bg-[#221c16] text-[#15110d] dark:text-[#fdf6ec] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              placeholder="Leave blank for unlimited"
            />
          </div>

          {/* Social event pricing */}
          {type === 'social' && (
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Event Size & Fee</label>
              <div className="space-y-2">
                {[
                  { id: 'small', label: 'Small (1–10 people)', price: '$10' },
                  { id: 'medium', label: 'Medium (11–50 people)', price: '$25' },
                  { id: 'large', label: 'Large (51–200 people)', price: '$75' },
                ].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSizeBracket(option.id)}
                    className={`w-full flex justify-between items-center px-4 py-3 rounded-lg border transition ${
                      sizebracket === option.id
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className="font-semibold">{option.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'casual' && (
            <div className="bg-white dark:bg-[#221c16] rounded-lg px-4 py-3 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
              ✅ Casual meetups are always <span className="text-[#15110d] dark:text-[#fdf6ec] font-medium">free</span> for everyone.
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating...' : `Create ${type === 'casual' ? 'Meetup' : 'Event'} →`}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CreateEventPage() {
  return (
    <Suspense>
      <CreateEventForm />
    </Suspense>
  )
}
