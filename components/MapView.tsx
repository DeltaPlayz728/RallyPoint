'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type EventPin = {
  id: string
  title: string
  type: string
  location: string
  price: number
  starts_at: string
  lat: number
  lng: number
  attendee_count: number
}

export type Venue = {
  id: string
  place_id: string
  name: string
  lat: number
  lng: number
  types: string[]
  vicinity: string
  city: string
}

interface MapViewProps {
  events: EventPin[]
  venues: Venue[]
  selectedVenueId: string | null
  onVenueClick: (venue: Venue) => void
  onEventClick: (event: EventPin) => void
}

// ─── Icon helpers ────────────────────────────────────────────────────────────

function getVenueEmoji(types: string[]): string {
  if (types.includes('bowling_alley'))  return '🎳'
  if (types.includes('night_club'))     return '🎵'
  if (types.includes('bar'))            return '🍺'
  if (types.includes('cafe'))           return '☕'
  if (types.includes('park'))           return '🌳'
  if (types.includes('gym'))            return '💪'
  if (types.includes('movie_theater'))  return '🎬'
  if (types.includes('amusement_park')) return '🎡'
  if (types.includes('stadium'))        return '🏟️'
  if (types.includes('restaurant'))     return '🍽️'
  return '📍'
}

function createVenueIcon(types: string[], selected: boolean) {
  const emoji = getVenueEmoji(types)
  const border = selected ? '#f97316' : '#374151'
  const bg     = selected ? '#1c0a00' : '#111827'
  const shadow = selected
    ? '0 0 0 3px rgba(249,115,22,0.3), 0 3px 10px rgba(0,0,0,0.6)'
    : '0 2px 8px rgba(0,0,0,0.5)'

  return L.divIcon({
    className: '',
    html: `
      <div class="rp-venue-pin" style="
        width: 38px; height: 38px;
        background: ${bg};
        border: 2px solid ${border};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: ${shadow};
        transition: border-color 0.2s, box-shadow 0.2s;
        cursor: pointer;
      ">${emoji}</div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function createEventIcon(type: string, attendeeCount: number) {
  const color = type === 'casual' ? '#22c55e' : '#f97316'
  const bg    = type === 'casual' ? '#052e16' : '#1c0a00'

  return L.divIcon({
    className: '',
    html: `
      <div style="position: relative; width: 36px; height: 44px;">
        <div style="
          width: 36px; height: 36px;
          background: ${bg};
          border: 2.5px solid ${color};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 3px 10px rgba(0,0,0,0.5);
        "></div>
        ${attendeeCount > 0 ? `
          <div style="
            position: absolute;
            top: -6px; right: -8px;
            background: ${color};
            color: #000;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 5px;
            min-width: 17px;
            text-align: center;
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            line-height: 1.4;
          ">${attendeeCount > 99 ? '99+' : attendeeCount}</div>
        ` : ''}
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  })
}

// ─── Map recenter helper ──────────────────────────────────────────────────────

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])
  return null
}

// ─── Inject animation CSS once ───────────────────────────────────────────────

function useMapAnimations() {
  useEffect(() => {
    const id = 'rp-map-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes rpFlagDrop {
        0%   { transform: translateY(-16px) scale(0.6); opacity: 0; }
        65%  { transform: translateY(5px)   scale(1.08); opacity: 1; }
        100% { transform: translateY(0)     scale(1);    opacity: 1; }
      }
      .rp-venue-pin {
        animation: rpFlagDrop 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      /* Override Leaflet popup styles */
      .leaflet-popup-content-wrapper,
      .leaflet-popup-tip {
        background: #111 !important;
        color: #fff !important;
        border: 1px solid #333 !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
      }
      .leaflet-popup-content { margin: 0 !important; }
    `
    document.head.appendChild(style)
  }, [])
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapView({
  events,
  venues,
  selectedVenueId,
  onVenueClick,
  onEventClick,
}: MapViewProps) {
  useMapAnimations()

  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  const defaultCenter: [number, number] = [51.5719, 4.7683]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={14}
      style={{ height: '100%', width: '100%', background: '#0d0d0d' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Heat zones — semi-transparent circles that stack where events cluster */}
      {events.map((event) => (
        <Circle
          key={`zone-${event.id}`}
          center={[event.lat, event.lng]}
          radius={280}
          interactive={false}
          pathOptions={{
            fillColor: '#f59e0b',
            fillOpacity: 0.13,
            stroke: false,
          }}
        />
      ))}

      {/* Venue markers */}
      {venues.map((venue) => (
        <Marker
          key={venue.place_id}
          position={[venue.lat, venue.lng]}
          icon={createVenueIcon(venue.types, venue.place_id === selectedVenueId)}
          eventHandlers={{
            click: () => onVenueClick(venue),
          }}
        />
      ))}

      {/* Event markers */}
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.lat, event.lng]}
          icon={createEventIcon(event.type, event.attendee_count)}
          eventHandlers={{
            click: () => onEventClick(event),
          }}
        />
      ))}
    </MapContainer>
  )
}
