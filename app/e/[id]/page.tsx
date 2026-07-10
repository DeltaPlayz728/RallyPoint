import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublicEvent } from '@/lib/publicEvent'
import Logo from '@/components/Logo'
import { MapPin, Clock, Users, Lock } from 'lucide-react'
import CopyLinkButton from '@/components/CopyLinkButton'
import SharedEventCta from '@/components/SharedEventCta'
import EventRulesDisplay from '@/components/EventRulesDisplay'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rally-point-eb1q.vercel.app'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await getPublicEvent(id)
  if (!event) return { title: 'Event not found' }

  const description = `${formatDate(event.starts_at)} · ${event.city} · Hosted by ${event.hostName} · ${event.attendeeCount} going`

  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      url: `${appUrl}/e/${event.id}`,
      type: 'website',
      images: [{ url: `/e/${event.id}/opengraph-image`, width: 1200, height: 630, alt: event.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: [`/e/${event.id}/opengraph-image`],
    },
  }
}

export default async function PublicEventPage({ params }: Props) {
  const { id } = await params
  const event = await getPublicEvent(id)
  if (!event) notFound()

  const isCasual = event.type === 'casual'
  const isFull = event.max_attendees !== null && event.attendeeCount >= event.max_attendees

  return (
    <div className="min-h-dvh bg-[#fdf6ec] dark:bg-[#15110d] text-[#15110d] dark:text-[#fdf6ec]">
      {/* Hero / "cover" — same gradient language as the in-app event page */}
      <div className={`relative w-full pt-14 pb-6 px-4 ${
        isCasual
          ? 'bg-gradient-to-b from-purple-100 via-[#fdf6ec] to-[#fdf6ec]'
          : 'bg-gradient-to-b from-orange-100 via-[#fdf6ec] to-[#fdf6ec]'
      }`}>
        <div className="absolute top-4 right-4">
          <Logo size={26} />
        </div>

        <div className="mb-3">
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
            isCasual ? 'bg-purple-500 text-white border-black' : 'bg-accent text-white border-black'
          }`}>
            {isCasual ? 'Casual Meetup' : 'Social Event'}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight flex-1">{event.title}</h1>
          <span className={`text-lg font-black shrink-0 mt-0.5 ${event.price > 0 ? 'text-accent' : ''}`}>
            {event.price > 0 ? `€${event.price}` : 'Free'}
          </span>
        </div>

        {event.description && (
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 leading-relaxed">{event.description}</p>
        )}

        <p className="text-gray-500 dark:text-gray-400 text-xs mt-3">Hosted by {event.hostName}</p>
      </div>

      {/* Info rows — city only, no exact address for logged-out viewers */}
      <div className="px-4 py-5 border-b border-gray-300 dark:border-gray-700 space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
            <MapPin size={16} />
          </div>
          <div>
            <p className="text-sm font-medium">{event.city}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
              <Lock size={10} className="shrink-0" /> Exact location shown after sign-in
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
          <p className="text-sm">{formatDate(event.starts_at)}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#221c16] border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <p className="text-sm">
            {event.attendeeCount} going
            {event.max_attendees ? ` · ${Math.max(0, event.max_attendees - event.attendeeCount)} spots left` : ' · Open to all'}
          </p>
        </div>
      </div>

      {event.rules.length > 0 && (
        <div className="px-4 py-5 border-b border-gray-300 dark:border-gray-700">
          <h2 className="font-semibold mb-3">Rules</h2>
          <EventRulesDisplay rules={event.rules} />
        </div>
      )}

      <div className="px-4 py-6 space-y-3">
        <SharedEventCta eventId={event.id} isFull={isFull} />
        <p className="text-center text-gray-400 dark:text-gray-500 text-xs">
          <Link href="/" className="hover:underline">RallyPoint</Link> — real places, real people.
        </p>
      </div>
    </div>
  )
}
