import { ImageResponse } from 'next/og'
import { getPublicEvent } from '@/lib/publicEvent'

export const runtime = 'nodejs'
export const alt = 'RallyPoint event'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await getPublicEvent(id)

  const accent = event?.type === 'casual' ? '#a855f7' : '#f97316'
  const badge = event?.type === 'casual' ? 'Casual Meetup' : 'Social Event'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: '#fdf6ec',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#f97316',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 900, fontSize: 20,
          }}>RP</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#15110d' }}>
            Rally<span style={{ color: '#f97316' }}>Point</span>
          </div>
        </div>

        {event ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{
              display: 'flex', alignSelf: 'flex-start', padding: '8px 20px', borderRadius: 999,
              background: accent, color: 'white', fontSize: 22, fontWeight: 700,
            }}>{badge}</div>
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: '#15110d', lineHeight: 1.1 }}>
              {event.title}
            </div>
            <div style={{ display: 'flex', fontSize: 28, color: '#57534e' }}>
              {formatDate(event.starts_at)} · {event.city}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: '#57534e' }}>
              Hosted by {event.hostName} · {event.attendeeCount} going
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 48, fontWeight: 800, color: '#15110d' }}>
            This event is no longer available
          </div>
        )}

        <div style={{ display: 'flex', fontSize: 22, color: '#a8a29e' }}>
          Real places. Real people. No swiping required.
        </div>
      </div>
    ),
    { ...size }
  )
}
